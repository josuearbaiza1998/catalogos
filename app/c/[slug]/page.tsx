import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PublicCatalog, type PublicItem } from "@/components/PublicCatalog";
import { sql } from "@/lib/server/db";
import { dbEnabled, env } from "@/lib/server/env";

// Página estática regenerada (ISR): la sirve el CDN y se invalida en cada sincronización.
export const revalidate = 300;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

const load = cache(async (slug: string) => {
  if (!dbEnabled()) return null;
  const db = sql();
  const [catalog] = await db`
    select id, name, distributor, whatsapp, message from catalogs where slug = ${slug}`.catch(() => []);
  if (!catalog) return null;
  const items = await db<PublicItem[]>`
    select key, code, brand, colors, sizes,
           case when cardinality(image_urls) > 0 then image_urls
                when cover_url is not null then array[cover_url] else '{}' end as images
    from products
    where catalog_id = ${catalog.id} and existencia
    order by position`;
  return { catalog, items };
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const data = await load((await params).slug);
  if (!data) return { title: "Catálogo" };
  const title = `${data.catalog.name}${data.catalog.distributor ? ` · ${data.catalog.distributor}` : ""}`;
  const cover = data.items.find((i) => i.images[0])?.images[0];
  return { title, description: data.catalog.message, openGraph: { title, description: data.catalog.message, images: cover ? [cover] : [] } };
}

export default async function CatalogPage({ params }: { params: Promise<{ slug: string }> }) {
  const data = await load((await params).slug);
  if (!data) notFound();
  return (
    <PublicCatalog
      title={data.catalog.name}
      distributor={data.catalog.distributor}
      whatsapp={data.catalog.whatsapp}
      items={data.items}
      optimized={!!env.assetsBaseUrl}
    />
  );
}
