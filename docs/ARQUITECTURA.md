# catalogos · Arquitectura

SaaS de catálogos B2B para distribuidoras (empezando por ropa). Reemplaza el envío masivo de fotos por WhatsApp con **un enlace** que siempre muestra sólo lo que hay en existencia.

La restricción de diseño que manda sobre todas las demás es la **fricción cero para la vendedora**: arrastrar fotos y un Excel a un lienzo, sin formularios, sin botón "Guardar" y sin esperas. Si el sistema le agrega trabajo, no lo va a adoptar, aunque el resultado sea mejor.

---

## 1. Stack y por qué

| Capa | Elección | Por qué reduce latencia o mejora la resiliencia |
|---|---|---|
| Frontend + API | **Next.js 15 (App Router, TypeScript) en Vercel** | Una sola base de código y un solo despliegue. El editor es una SPA cliente; el catálogo público se sirve como **página estática regenerada (ISR)** desde el CDN de Vercel, así la clienta final nunca espera a la base de datos. |
| Estado del editor | **Zustand** con estado normalizado | Mapas por id: actualizar el progreso de 1 foto entre 300 re-renderiza sólo esa tarjeta. Sin reducers ni contexto que despierten todo el árbol. |
| Trabajo pesado en cliente | **Web Workers** (pool de hasta 4) | Decodificar, rotar (EXIF), redimensionar, comprimir a WebP, calcular SHA‑256 y leer el Excel ocurren fuera del hilo principal. La UI sigue a 60 fps con 100+ fotos. |
| Persistencia local | **IndexedDB** (`idb`) | Autoguardado de cada cambio y de cada foto. Es lo que permite no tener botón Guardar y sobrevivir a cierres de pestaña, recargas y cortes de señal. |
| Almacenamiento de imágenes | **Cloudflare R2** (o S3; el código usa la API S3) | R2 no cobra egreso: un catálogo que se ve miles de veces no dispara la factura. Subida directa desde el navegador con **URL prefirmada**, el servidor nunca toca los bytes. |
| Base de datos | **PostgreSQL serverless (Neon / Supabase / Vercel Postgres)** | Relacional y transaccional para las escrituras del editor; arrays nativos (`text[]`) e índices GIN para colores y tallas; índice parcial `where existencia` para la lectura pública. |
| Variantes de imagen | **Vercel Image Optimization** (`next/image`, AVIF/WebP) sobre el original ya comprimido | Tamaño exacto por dispositivo, generado y cacheado en el edge la primera vez. Cero infraestructura propia. |
| Colas | **No hacen falta en la v1.** Ver §6 para cuándo agregar una. | La "cola" de subidas vive en el navegador (persistida en IndexedDB) y el bucket recibe las subidas directamente. Un broker en medio sólo agregaría latencia y un punto de falla. |

**Modo degradado.** Si no hay variables de entorno, la app arranca igual: todo funciona en el navegador (lienzo, Excel, matching, filtros, vista cliente) y el indicador dice "Guardado en este equipo". Al configurar el bucket y la base, las fotos pendientes se suben solas. Esto hace que el despliegue nunca se rompa por configuración faltante.

```
 Vendedora (navegador)                               Nube
 ┌──────────────────────────────────────┐
 │ Lienzo (React)  ◄── Zustand store     │
 │      ▲               ▲   │            │
 │      │               │   ▼            │
 │  Web Workers     IndexedDB (fotos,    │
 │  · optimizar      datos, cola)        │
 │  · SHA-256            │               │
 │  · leer Excel         ▼               │      POST /api/uploads/presign
 │                 Cola de subida ───────┼───► (Vercel Function) ──► URL firmada
 │                  (3 en paralelo,      │
 │                   backoff+jitter) ────┼───► PUT directo ──► R2 / S3
 │                                       │
 │                 Sync de metadatos ────┼───► POST /api/catalogs/:id/sync ──► Postgres
 │                  (lotes, debounce)    │                                   │
 └──────────────────────────────────────┘                     revalidatePath │
                                                                             ▼
 Clienta final ◄────────── /c/:slug (ISR en CDN) ◄── next/image (AVIF/WebP en el edge)
```

---

## 2. Estado y flujo de carga asíncrona

### 2.1 Modelo en el cliente

```ts
products: Record<codigoNormalizado, Product>   // una tarjeta por prenda
images:   Record<uuid, ImageAsset>             // cada foto, con su estado de subida
previews: Record<uuid, objectURL>              // miniatura local para pintar
```

La foto **no** guarda la URL del producto ni el producto guarda URLs locales: la foto apunta a su producto por **código** (`productKey`). Esta decisión es la que hace que el matching con el Excel sea independiente del estado de la subida (ver §3).

`ImageAsset.status` es una máquina de estados simple:

```
processing ─► queued ─► uploading ─► uploaded
                 ▲          │
                 └─ backoff ┘──► error (tras 8 intentos; se reintenta al volver la red o con un clic)
local  = no hay bucket configurado: la foto vive en el navegador
```

### 2.2 Lo que pasa al soltar 100 fotos

1. **0 ms**: por cada archivo se crea un `objectURL` y una tarjeta. Ya se puede seleccionar, filtrar y editar. No se lee el archivo en el hilo principal.
2. El original se guarda en IndexedDB (para poder reanudar si se cierra la pestaña) y se envía al **pool de workers**.
3. Cada worker: `createImageBitmap(file, { imageOrientation: "from-image" })` → miniatura de 480 px (para el lienzo) → versión de subida de máx. 2048 px en WebP (JPEG en Safari, que no codifica WebP desde canvas) → SHA‑256.
4. La miniatura reemplaza al original en la tarjeta y se libera el `objectURL` pesado: la memoria se mantiene baja aunque haya cientos de fotos.
5. La foto entra a la **cola de subida**.

Solo se montan las tarjetas visibles (virtualización por filas y columnas del lienzo), y el pan/zoom se aplica con `transform` directo al DOM sin pasar por React.

### 2.3 Estrategia de subida: URL prefirmada por archivo, sin chunking

* `POST /api/uploads/presign` recibe `{catalogId, editKey, sha256, contentType, size}` y devuelve una URL `PUT` firmada por 10 min, con `Content-Type` y `Content-Length` firmados (no se puede subir otra cosa ni más grande).
* La clave en el bucket es **direccionada por contenido**: `catalogs/{id}/originals/{sha256}.webp`. Si ya existe (`HEAD`), la respuesta trae `exists: true` y el navegador no sube nada. Arrastrar dos veces la misma carpeta no cuesta datos.
* **Sin chunking ni multipart**: tras la compresión en el cliente una foto de teléfono pesa 200–600 KB. Un `PUT` único es más rápido y más simple que partirlo. Multipart (S3 `CreateMultipartUpload` con partes de 5 MB y reanudación por parte) sólo se justifica para archivos > 20 MB, como video, y queda como extensión.
* Concurrencia de **3** subidas: suficiente para saturar un 4G sin pelearse con la UI ni con WhatsApp.
* El servidor nunca recibe los bytes: no hay límite de cuerpo de Vercel (4.5 MB) ni tiempo de función gastado en transferir.

### 2.4 Reintentos automáticos si falla la red

* **Backoff exponencial con jitter** ("equal jitter"): 1 s, 2 s, 4 s… hasta 30 s, aleatorizado para que 100 fotos no reintenten en el mismo instante. Máximo 8 intentos.
* Se reintentan errores de red, timeouts, 5xx, 408, 429 y 403 (firma vencida: cada intento pide una URL nueva). Un 4xx de validación (archivo no es imagen, demasiado grande) no se reintenta.
* Con `navigator.onLine === false` la cola **se pausa**; con el evento `online` se reanuda todo de inmediato, incluidas las fotos en espera de backoff y las que habían agotado sus intentos.
* Los metadatos se sincronizan aparte, en lotes de hasta 200 prendas con debounce de ~1 s, con el mismo backoff. Cada prenda lleva una firma (`updatedAt|posición|urls`) y sólo viaja lo que cambió. El servidor hace *last-write-wins* por `updated_at`.

### 2.5 ¿Y si cierra la pestaña con cargas pendientes?

Defensa en tres capas:

1. **`beforeunload`**: si hay fotos optimizándose o subiendo, o metadatos sin sincronizar, el navegador muestra su diálogo nativo de "¿Salir del sitio?".
2. **Nada se pierde aunque cierre igual**: el original, la versión optimizada y el estado de cada foto ya están en IndexedDB. Al volver a abrir la app, `boot()` reprocesa lo que quedó a medias y re-encola lo pendiente. La vendedora no tiene que hacer nada.
3. **`pagehide` / `visibilitychange`**: se fuerza el guardado local y se envía el último lote de metadatos con `fetch(..., { keepalive: true })`, que el navegador completa aunque la página ya se haya cerrado.

Extensión posible: un Service Worker con **Background Sync** para seguir subiendo con la pestaña cerrada (sólo Chromium; Safari no lo soporta, por eso no es la base del diseño).

---

## 3. Excel y matching

### 3.1 ¿Parsear en el cliente o en un worker del servidor?

**En el cliente, dentro de un Web Worker, y se envía JSON estructurado.**

* **Respuesta instantánea**: los datos aparecen en las tarjetas en cuanto se suelta el archivo, sin ida y vuelta al servidor y aunque no haya señal.
* **Menos superficie de ataque y menos costo**: el servidor no parsea archivos binarios arbitrarios (zip bombs, fórmulas, macros); recibe JSON validado y recortado campo por campo.
* **Escala sola**: el CPU de parseo es el del dispositivo de cada vendedora.
* El JSON resultante es diminuto comparado con el `.xlsx`.

Cuándo sí haría falta procesarlo en el servidor: importaciones programadas desde un ERP o un Excel en Google Drive. Para eso el mismo módulo puro (`lib/shared/excel.ts`) corre en Node sin cambios.

Formatos: `.xlsx`/`.xlsm` (lector `read-excel-file`, ligero) y `.csv`/`.tsv` con detección de separador (`,` `;` tab, típico del Excel en español). `.xls` antiguo se rechaza con un mensaje claro.

### 3.2 Lectura tolerante

Las vendedoras no van a usar una plantilla perfecta, así que el lector se adapta:

* **Cabecera detectada**, no asumida: busca en las 15 primeras filas la que más se parece a una cabecera (los inventarios suelen tener un título arriba).
* **Sinónimos**: `Código|Cod|SKU|Ref|Modelo|Artículo`, `Marca|Brand|Proveedor`, `Colores|Color|Tono`, `Tallas|Talla|Size|Números`, `Existencia|Stock|Disponible|Activo`. Sin acentos ni mayúsculas.
* **Listas**: `"Blanco, beige"`, `"S/M/L"`, `"Rojo y negro"` → arrays sin duplicados.
* **Existencia**: `Sí, si, x, ✓, 1, disponible, true` → verdadero; `No, 0, agotado, false` → falso. Celda vacía o columna ausente → se conserva el valor actual (por defecto, visible).
* **Columnas extra** (Material, Categoría…) se guardan en `attrs` (jsonb). Así el mismo sistema sirve para distribuidoras de otros rubros sin migraciones.
* Códigos repetidos: gana la última fila y se avisa.

### 3.3 Algoritmo de matching

Todo código se **normaliza** igual: sin acentos, mayúsculas, sólo `[A-Z0-9]`. `"vmd-802 "` y `VMD802` son el mismo.

Para cada foto se prueba, en orden:

1. **Exacto** con el nombre del archivo sin extensión.
2. **Exacto sin sufijos de copia** que agregan los teléfonos y el sistema: `(1)`, `_2`, ` 3`, `copia`, `-frente`, `-espalda`, `-detalle`. (No se quita `-802`, que suele ser parte del código.)
3. **Sin ceros a la izquierda**: Excel convierte `00123` en `123`.
4. **Prefijo más largo con frontera**: `VMD802FRENTE2` → `VMD802`. Si el código termina en dígito, lo que sigue no puede ser dígito (evita que `VMD80` capture `VMD802`).

Varias fotos del mismo código se agrupan en una prenda (la primera es la portada, se puede cambiar). Soltar una foto **sobre una tarjeta** la asigna a esa prenda a mano y el matching automático ya no la mueve.

### 3.4 Fotos ya subidas, subiéndose o que llegan después

La unión es **por código, no por URL**, y el producto es la entidad estable:

* **Foto antes que Excel**: la foto crea una tarjeta provisional con el código sacado de su nombre ("Sin datos"). Al llegar el Excel, cada fila se fusiona con su tarjeta, se re-evalúan *todas* las fotos contra los códigos nuevos y las tarjetas provisionales que quedaron vacías desaparecen.
* **Excel antes que fotos**: las filas crean tarjetas "Sin foto". Cada foto que llega se resuelve contra los códigos ya conocidos y se acomoda en su tarjeta.
* **Foto subiéndose mientras llega el Excel**: no importa. El matching cambia `productKey` de la foto; la subida sigue su curso y cuando termina rellena `remoteUrl`. El siguiente lote de sincronización envía la prenda con sus URLs.

En el servidor rige la misma idea: `products` tiene la clave `(catalog_id, key)` y las URLs se desnormalizan en la fila de la prenda cuando existen.

El resultado se resume en un aviso: *"48 prendas: 45 con foto · 3 sin foto · 5 fotos sin fila"*, y el filtro **Estado** del dock lleva directo a lo que falta.

---

## 4. Base de datos y modelo de dominio

PostgreSQL. Esquema completo en [`db/schema.sql`](../db/schema.sql) (idempotente, se aplica solo).

```sql
catalogs (
  id uuid pk, tenant_id uuid, slug text unique,
  name, distributor, whatsapp, message text,
  edit_key_hash text,                 -- quien tiene la llave puede escribir
  created_at, updated_at timestamptz
)

products (
  catalog_id uuid fk, key text,       -- código normalizado: PK compuesta (catalog_id, key)
  code text,                          -- como lo escribió la distribuidora
  brand text,
  colors text[], sizes text[],
  existencia boolean not null default true,
  attrs jsonb,                        -- columnas extra del Excel
  cover_url text, image_urls text[],  -- desnormalizado para lectura en 1 consulta
  position int, updated_at timestamptz
)

assets (catalog_id, sha256 pk, storage_key, content_type, bytes)  -- dedupe y auditoría
tenants (id, name)                                                  -- multi-tenant
```

**Optimizado para lectura masiva**:

* El catálogo público hace **una** consulta: `select … from products where catalog_id = $1 and existencia order by position`, servida por el índice parcial `products_public_idx (catalog_id, position) where existencia`. Las prendas agotadas ni siquiera están en el índice.
* Portada y galería viven en la misma fila (`cover_url`, `image_urls`): sin joins en la ruta caliente.
* `colors` y `sizes` como `text[]` con índices **GIN** para filtrar del lado del servidor cuando un catálogo crezca a miles de prendas (`where colors @> '{Negro}'`).
* Encima de todo esto está el **CDN**: `/c/[slug]` es ISR (`revalidate = 300`) y cada sincronización llama a `revalidatePath`. En la práctica, la base recibe una lectura por cambio, no una por visita.
* Escrituras en lote: un solo `INSERT … SELECT FROM jsonb_to_recordset(...) ON CONFLICT DO UPDATE WHERE updated_at <=` por lote de 200 prendas.

Seguridad en la v1: cada catálogo nace en el navegador con un id y una **llave de edición** aleatoria; el servidor guarda su hash y exige la llave para escribir. Es suficiente para un piloto; para comercializar se reemplaza por cuentas (Auth.js o Clerk) con `tenant_id` y Row Level Security en Postgres.

---

## 5. Imágenes: compresión, tamaño y formatos

Las fotos de teléfono llegan de 3–12 MB, en JPEG o HEIC, a 4000 px y con la orientación en EXIF. El trabajo se reparte en dos puntos, ninguno visible para la vendedora:

**1) En el navegador, antes de subir** (worker):

* Corrige la orientación EXIF.
* Redimensiona a máx. 2048 px de lado y comprime a **WebP calidad 0.86** (JPEG en Safari).
* Una foto de 4 MB queda en ~300 KB: **10× menos datos móviles** y subidas 10× más rápidas, que es justo lo que más fricción quita. Si el original ya era más liviano, se sube tal cual.
* Si el navegador no puede decodificarla (HEIC en Chrome/Android), sube el original y la tarjeta lo indica; la conversión ocurre en el paso 2.

**2) En el edge, al servir** (`next/image` + Vercel Image Optimization):

* Genera **AVIF o WebP** según lo que acepte el teléfono de la clienta, al ancho exacto que necesita (`sizes`), y lo cachea en el CDN.
* `loading="lazy"` y `decoding="async"` en la cuadrícula; galería completa sólo al abrir una prenda.

Por qué no un pipeline de colas con `sharp` en una Lambda desde el día uno: el original ya llega optimizado y la optimización por dispositivo la da el edge sin código. Cuando el volumen lo pida (ver §6), el siguiente paso es un evento del bucket (R2 Event Notifications → Queue, o S3 → SQS → Lambda con `sharp`) que pre-genere variantes 320/640/1080 en AVIF y WebP, convierta HEIC y escriba un placeholder borroso (`blurhash`) en `assets`.

---

## 6. Escalabilidad

* **Cuello de botella del editor**: el dispositivo de la vendedora. Mitigado con workers, virtualización y miniaturas. Probado con 150 fotos de 1200×1600: la primera tarjeta aparece en < 1 s y la subida completa termina sola aunque se corte la red y el bucket falle 300 veces.
* **Cuello de botella del catálogo público**: ninguno práctico; es estático en CDN y las imágenes también.
* **Base**: escrituras pequeñas y en lote; lecturas casi siempre absorbidas por ISR. Neon/Supabase escalan con pooling (`prepare: false` para poolers en modo transacción).
* **Cuándo agregar un broker** (Cloudflare Queues, SQS o Inngest): variantes pre-generadas, conversión de HEIC en servidor, importaciones desde ERP, notificaciones a clientas cuando vuelve a haber existencia de una prenda. Todos son trabajos asíncronos que no deben bloquear una request; no lo son subir fotos ni guardar datos.
* **Multi-pestaña**: hoy cada pestaña tiene su propia cola. Se puede coordinar con `navigator.locks` o `BroadcastChannel` si se vuelve un caso real.

---

## 7. Mapa del código

| Ruta | Qué hace |
|---|---|
| `lib/shared/matching.ts` | Normalización de códigos y `CodeIndex` (matching foto ↔ fila). Con tests. |
| `lib/shared/excel.ts` | Cabecera tolerante, sinónimos, listas, booleanos y CSV. Con tests. |
| `lib/client/workers/image.worker.ts` | Miniatura, versión de subida, EXIF, WebP/JPEG y SHA‑256. |
| `lib/client/workers/excel.worker.ts` | Lee `.xlsx`/`.csv` fuera del hilo principal. |
| `lib/client/store.ts` · `actions.ts` | Estado normalizado y operaciones (soltar, importar, fusionar, renombrar). |
| `lib/client/uploader.ts` | Cola de subida: concurrencia, backoff, offline, `beforeunload`. |
| `lib/client/persistence.ts` | IndexedDB: autoguardado diferencial y reanudación. |
| `lib/client/sync.ts` | Sincronización de metadatos en lotes con firmas. |
| `components/editor/*` | Lienzo infinito, tarjetas, inspector, panel de catálogo, dock de filtros. |
| `components/PublicCatalog.tsx` | Vista de la clienta (enlace público y "Vista cliente"). |
| `app/api/uploads/presign` | URLs prefirmadas con dedupe por hash. |
| `app/api/catalogs/[id]/sync` | Upsert en lote y revalidación del catálogo público. |
| `app/c/[slug]` | Catálogo público ISR, sólo prendas en existencia, pedido por WhatsApp. |
