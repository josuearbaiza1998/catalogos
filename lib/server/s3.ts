import "server-only";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./env";

let client: S3Client | null = null;
function s3() {
  client ??= new S3Client({
    region: env.s3.region,
    endpoint: env.s3.endpoint,
    forcePathStyle: !!env.s3.endpoint,
    credentials: { accessKeyId: env.s3.accessKeyId!, secretAccessKey: env.s3.secretAccessKey! },
  });
  return client;
}

const EXT: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/gif": "gif",
};

export function extensionFor(contentType: string) {
  return EXT[contentType] ?? "bin";
}

/** Clave direccionada por contenido: misma foto ⇒ misma clave ⇒ no se sube dos veces. */
export function storageKeyFor(catalogId: string, sha256: string, contentType: string) {
  return `catalogs/${catalogId}/originals/${sha256}.${extensionFor(contentType)}`;
}

export async function objectExists(key: string) {
  try {
    await s3().send(new HeadObjectCommand({ Bucket: env.s3.bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

export async function presignPut(key: string, contentType: string, size: number) {
  return getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: env.s3.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
      CacheControl: "public, max-age=31536000, immutable",
    }),
    { expiresIn: 600 },
  );
}

export const publicUrlFor = (key: string) => `${env.assetsBaseUrl}/${key}`;
