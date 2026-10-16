import { NextResponse, type NextRequest } from "next/server";
import { checkEditKey, ensureSchema, sql } from "@/lib/server/db";
import { dbEnabled, uploadsEnabled } from "@/lib/server/env";
import { objectExists, presignPut, publicUrlFor, storageKeyFor } from "@/lib/server/s3";

export const runtime = "nodejs";

const MAX_BYTES = 25 * 1024 * 1024;
const UUID = /^[0-9a-f-]{36}$/i;
const SHA = /^[0-9a-f]{64}$/;

export async function POST(req: NextRequest) {
  if (!uploadsEnabled()) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as {
    catalogId?: string;
    editKey?: string;
    sha256?: string;
    contentType?: string;
    size?: number;
  } | null;
  const { catalogId, editKey, sha256, contentType, size } = body ?? {};
  if (!catalogId || !UUID.test(catalogId) || !editKey || !sha256 || !SHA.test(sha256) || !contentType || !size) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!contentType.startsWith("image/")) return NextResponse.json({ error: "only_images" }, { status: 415 });
  if (size > MAX_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });

  if (dbEnabled()) {
    await ensureSchema();
    if ((await checkEditKey(catalogId, editKey)) === "forbidden") {
      return NextResponse.json({ error: "forbidden" }, { status: 401 });
    }
  }

  const storageKey = storageKeyFor(catalogId, sha256, contentType);
  const publicUrl = publicUrlFor(storageKey);
  if (await objectExists(storageKey)) {
    return NextResponse.json({ exists: true, storageKey, publicUrl, uploadUrl: null });
  }
  const uploadUrl = await presignPut(storageKey, contentType, size);

  if (dbEnabled()) {
    // Registro best-effort; si el catálogo aún no existe, se registra en la próxima subida.
    await sql()`
      insert into assets (catalog_id, sha256, storage_key, content_type, bytes)
      select ${catalogId}, ${sha256}, ${storageKey}, ${contentType}, ${size}
      where exists (select 1 from catalogs where id = ${catalogId})
      on conflict do nothing`.catch(() => undefined);
  }

  return NextResponse.json({ exists: false, storageKey, publicUrl, uploadUrl });
}
