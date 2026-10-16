import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { checkEditKey, ensureSchema, hashKey, sql } from "@/lib/server/db";
import { dbEnabled } from "@/lib/server/env";
import type { SyncPayload } from "@/lib/shared/domain";
import { slugify } from "@/lib/shared/slug";

export const runtime = "nodejs";

const UUID = /^[0-9a-f-]{36}$/i;
const clip = (s: unknown, n = 200) => String(s ?? "").slice(0, n);
const list = (a: unknown) => (Array.isArray(a) ? a.slice(0, 50).map((x) => clip(x, 60)) : []);

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!dbEnabled()) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "bad_id" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as SyncPayload | null;
  if (!body?.editKey || !body.catalog || !Array.isArray(body.upserts) || body.upserts.length > 500) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  await ensureSchema();
  const auth = await checkEditKey(id, body.editKey);
  if (auth === "forbidden") return NextResponse.json({ error: "forbidden" }, { status: 401 });

  const db = sql();
  const c = body.catalog;
  const slug = slugify(c.slug || c.distributor || c.name) || `catalogo-${id.slice(0, 6)}`;

  try {
    await db.begin(async (tx) => {
      await tx`
        insert into catalogs (id, slug, name, distributor, whatsapp, message, edit_key_hash)
        values (${id}, ${slug}, ${clip(c.name)}, ${clip(c.distributor)}, ${clip(c.whatsapp, 40)}, ${clip(c.message, 1000)}, ${hashKey(body.editKey)})
        on conflict (id) do update set
          slug = excluded.slug, name = excluded.name, distributor = excluded.distributor,
          whatsapp = excluded.whatsapp, message = excluded.message, updated_at = now()`;

      if (body.upserts.length) {
        const rows = body.upserts.map((p) => ({
          key: clip(p.key, 80),
          code: clip(p.code, 80),
          brand: clip(p.brand, 120),
          colors: list(p.colors),
          sizes: list(p.sizes),
          existencia: !!p.existencia,
          attrs: p.attrs && typeof p.attrs === "object" ? p.attrs : {},
          cover_url: p.coverUrl ? clip(p.coverUrl, 600) : null,
          image_urls: Array.isArray(p.imageUrls) ? p.imageUrls.slice(0, 20).map((u) => clip(u, 600)) : [],
          position: Number.isFinite(p.position) ? Math.trunc(p.position) : 0,
          updated_at: Number(p.updatedAt) || Date.now(),
        }));
        // Un solo INSERT … SELECT para todo el lote: una ida y vuelta a la base.
        await tx`
          insert into products (catalog_id, key, code, brand, colors, sizes, existencia, attrs, cover_url, image_urls, position, updated_at)
          select ${id}, x.key, x.code, x.brand, x.colors, x.sizes, x.existencia, x.attrs, x.cover_url, x.image_urls, x.position,
                 to_timestamp(x.updated_at / 1000.0)
          from jsonb_to_recordset(${tx.json(rows)}::jsonb) as x(
            key text, code text, brand text, colors text[], sizes text[], existencia boolean,
            attrs jsonb, cover_url text, image_urls text[], position int, updated_at bigint)
          on conflict (catalog_id, key) do update set
            code = excluded.code, brand = excluded.brand, colors = excluded.colors, sizes = excluded.sizes,
            existencia = excluded.existencia, attrs = excluded.attrs, cover_url = excluded.cover_url,
            image_urls = excluded.image_urls, position = excluded.position, updated_at = excluded.updated_at
          where products.updated_at <= excluded.updated_at`;
      }

      if (Array.isArray(body.deletes) && body.deletes.length) {
        await tx`delete from products where catalog_id = ${id} and key = any(${body.deletes.slice(0, 1000).map((k) => clip(k, 80))})`;
      }
    });
  } catch (err) {
    if ((err as { code?: string }).code === "23505") return NextResponse.json({ error: "slug_taken" }, { status: 409 });
    throw err;
  }

  // El catálogo público se sirve cacheado (ISR); se invalida al recibir cambios.
  revalidatePath(`/c/${slug}`);
  return NextResponse.json({ ok: true, slug, created: auth === "missing" });
}
