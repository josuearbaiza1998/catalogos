import type { NextConfig } from "next";

const publicHost = process.env.NEXT_PUBLIC_ASSETS_BASE_URL
  ? new URL(process.env.NEXT_PUBLIC_ASSETS_BASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // El esquema SQL se lee en runtime para auto-migrar la base en el primer request.
  outputFileTracingIncludes: { "/api/**": ["./db/schema.sql"], "/c/**": ["./db/schema.sql"] },
  images: {
    // Las variantes AVIF/WebP del catálogo público se generan en el edge de Vercel
    // a partir del original ya comprimido en el bucket.
    formats: ["image/avif", "image/webp"],
    remotePatterns: publicHost ? [{ protocol: "https", hostname: publicHost }] : [],
  },
};

export default nextConfig;
