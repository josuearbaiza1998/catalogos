# catalogos

Catálogos B2B para distribuidoras, con fricción cero: la vendedora arrastra sus fotos y su Excel a un lienzo infinito, todo aparece al instante y se sube solo en segundo plano. La clienta recibe **un enlace** que sólo muestra lo que hay en existencia y pide por WhatsApp.

* Arquitectura completa y decisiones: [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md)
* Esquema de base de datos: [`db/schema.sql`](db/schema.sql)

## Cómo se usa

1. Arrastra las fotos (o una carpeta entera) al lienzo. Cada foto se llama como el código de la prenda: `VMD-802.jpg`, `VMD-802 (1).jpg`, `vmd802_frente.jpg` sirven igual.
2. Arrastra el Excel con columnas **Marca, Código, Colores, Tallas, Existencia** (acepta sinónimos y filas de título arriba). Hay una [plantilla](public/plantilla-catalogo.csv).
3. Ajusta lo que quieras en el inspector de la derecha o con el interruptor **Existencia** de cada tarjeta.
4. **Enviar catálogo** copia el enlace y abre WhatsApp con tu mensaje.

Atajos: `E` alterna existencia de lo seleccionado, `Shift+clic` selecciona varias, `⌘/Ctrl + rueda` hace zoom, `0` encuadra todo, `Supr` elimina.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # matching y lectura de Excel
npm run build
```

Sin variables de entorno la app funciona completa en **modo local** (todo se guarda en el navegador).

## Despliegue en Vercel

1. Importa el repositorio en Vercel (framework: Next.js, sin cambios en la configuración de build).
2. Despliega. Ya funciona en modo local.
3. Para subir fotos a la nube y publicar enlaces, agrega las variables de [`.env.example`](.env.example) en *Settings › Environment Variables* y vuelve a desplegar:
   * **Base de datos**: crea una base Postgres (Neon desde el Marketplace de Vercel es lo más rápido) y define `DATABASE_URL`. Las tablas se crean solas.
   * **Imágenes**: crea un bucket en Cloudflare R2 (o S3), un token con permiso de escritura, y activa el dominio público del bucket. Define `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` y `NEXT_PUBLIC_ASSETS_BASE_URL`.
4. Configura CORS en el bucket para que el navegador pueda subir directo:

```json
[
  {
    "AllowedOrigins": ["https://TU-PROYECTO.vercel.app"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

Las fotos que se hayan agregado en modo local se suben solas cuando el bucket queda configurado.
