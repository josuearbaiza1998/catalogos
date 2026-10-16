// Modelo de dominio compartido entre cliente y servidor.

export type UploadStatus =
  | "processing" // optimizando en el worker (miniatura + versión de subida)
  | "queued" // listo, esperando turno en la cola
  | "uploading" // PUT en curso contra la URL prefirmada
  | "uploaded" // en el bucket, con URL pública
  | "local" // sin backend configurado: vive sólo en este navegador
  | "error"; // agotó los reintentos automáticos

export interface ImageAsset {
  id: string;
  fileName: string;
  /** Nombre del archivo sin extensión, tal como lo escribió la vendedora. */
  stem: string;
  /** Clave del producto al que pertenece (código normalizado). */
  productKey: string;
  width?: number;
  height?: number;
  originalBytes: number;
  optimizedBytes?: number;
  mime?: string;
  sha256?: string;
  status: UploadStatus;
  progress: number;
  attempts: number;
  remoteUrl?: string;
  storageKey?: string;
  error?: string;
  /** El navegador no pudo decodificarla (p. ej. HEIC en Chrome): se sube el original. */
  undecodable?: boolean;
  /** Asignada a mano (soltada sobre una tarjeta): el matching automático no la mueve. */
  pinned?: boolean;
  addedAt: number;
}

export interface Product {
  /** Código normalizado: clave única dentro del catálogo. */
  key: string;
  /** Código tal como se muestra. */
  code: string;
  brand: string;
  colors: string[];
  sizes: string[];
  existencia: boolean;
  /** Columnas extra del Excel (material, categoría…), para distribuidoras no textiles. */
  attrs: Record<string, string>;
  /** "image": creado desde una foto sin fila de Excel todavía. */
  source: "image" | "excel" | "manual";
  /** Orden en el lienzo. */
  position: number;
  updatedAt: number;
}

export interface CatalogMeta {
  id: string;
  /** Secreto local que autoriza escrituras sobre este catálogo en el backend. */
  editKey: string;
  slug: string;
  name: string;
  distributor: string;
  whatsapp: string;
  message: string;
}

export interface BackendCapabilities {
  uploads: boolean;
  db: boolean;
  publicBaseUrl?: string;
}

/** Payload que el cliente manda al endpoint de sincronización. */
export interface SyncPayload {
  editKey: string;
  catalog: Omit<CatalogMeta, "id" | "editKey">;
  upserts: Array<Omit<Product, "updatedAt"> & { updatedAt: number; coverUrl?: string; imageUrls: string[] }>;
  deletes: string[];
}
