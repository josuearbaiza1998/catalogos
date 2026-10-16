import "server-only";

export const env = {
  s3: {
    bucket: process.env.S3_BUCKET,
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
  assetsBaseUrl: process.env.NEXT_PUBLIC_ASSETS_BASE_URL?.replace(/\/$/, ""),
  databaseUrl: process.env.DATABASE_URL || process.env.POSTGRES_URL,
};

export const uploadsEnabled = () =>
  !!(env.s3.bucket && env.s3.accessKeyId && env.s3.secretAccessKey && env.assetsBaseUrl);

export const dbEnabled = () => !!env.databaseUrl;
