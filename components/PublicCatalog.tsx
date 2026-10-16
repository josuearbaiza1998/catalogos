"use client";
// Vista que recibe la clienta final. Se usa en /c/[slug] y en la "Vista cliente" del editor.

import Image from "next/image";
import { useMemo, useState } from "react";
import { colorHex, facets } from "@/lib/client/selectors";
import { whatsappLink } from "@/lib/shared/slug";
import type { Product } from "@/lib/shared/domain";
import { IconWhatsapp } from "@/components/icons";

export interface PublicItem {
  key: string;
  code: string;
  brand: string;
  colors: string[];
  sizes: string[];
  images: string[];
}

interface Props {
  title: string;
  distributor: string;
  whatsapp: string;
  items: PublicItem[];
  optimized?: boolean;
}

export function PublicCatalog({ title, distributor, whatsapp, items, optimized = false }: Props) {
  const [brand, setBrand] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [open, setOpen] = useState<PublicItem | null>(null);
  const f = useMemo(() => facets(items as unknown as Product[]), [items]);
  const shown = items.filter(
    (i) => (!brand || i.brand === brand) && (!color || i.colors.some((c) => c.toLowerCase() === color.toLowerCase())) && (!size || i.sizes.includes(size)),
  );

  const ask = (i: PublicItem) =>
    whatsappLink(whatsapp, `Hola${distributor ? ` ${distributor}` : ""}, me interesa la prenda ${i.code}${i.brand ? ` (${i.brand})` : ""}. ¿Me pasas precio?`);

  return (
    <div className="@container min-h-full bg-canvas canvas-dots">
      <header className="sticky top-0 z-20 bg-obsidian text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-blue-300">{distributor || "Catálogo"}</p>
            <h1 className="font-display truncate text-lg font-bold">{title}</h1>
          </div>
          <span className="shrink-0 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-300">
            {items.length} disponibles
          </span>
        </div>
        <div className="no-scrollbar mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-3">
          <Chip active={!brand && !color && !size} onClick={() => (setBrand(null), setColor(null), setSize(null))}>
            Todo
          </Chip>
          {f.brands.map((b) => (
            <Chip key={b} active={brand === b} onClick={() => setBrand(brand === b ? null : b)}>
              {b}
            </Chip>
          ))}
          {f.colors.map((c) => (
            <Chip key={c} active={color === c} onClick={() => setColor(color === c ? null : c)}>
              <Swatch name={c} /> {c}
            </Chip>
          ))}
          {f.sizes.map((s) => (
            <Chip key={s} active={size === s} onClick={() => setSize(size === s ? null : s)}>
              {s}
            </Chip>
          ))}
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-2 gap-3 p-4 @xl:grid-cols-3 @xl:gap-4 @4xl:grid-cols-4">
        {shown.map((i) => (
          <article key={i.key} className="card overflow-hidden">
            <button className="relative block aspect-[3/4] w-full bg-slate-100" onClick={() => setOpen(i)} aria-label={`Ver ${i.code}`}>
              {i.images[0] ? (
                optimized ? (
                  <Image src={i.images[0]} alt={i.code} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" className="object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.images[0]} alt={i.code} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                )
              ) : (
                <span className="absolute inset-0 grid place-items-center text-xs text-slate-400">Sin foto</span>
              )}
              {i.brand && <span className="pill absolute left-2 top-2 bg-white/90 text-slate-900">{i.brand}</span>}
              {i.images.length > 1 && <span className="pill absolute bottom-2 right-2 bg-slate-900/80 text-white">{i.images.length} fotos</span>}
            </button>
            <div className="space-y-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="truncate font-mono text-xs font-bold uppercase text-slate-900">{i.code}</h2>
                <div className="flex -space-x-1">
                  {i.colors.slice(0, 5).map((c) => (
                    <Swatch key={c} name={c} />
                  ))}
                </div>
              </div>
              {i.sizes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {i.sizes.map((s) => (
                    <span key={s} className="rounded border border-slate-200 px-1.5 font-mono text-[10px] text-slate-500">
                      {s}
                    </span>
                  ))}
                </div>
              )}
              <a href={ask(i)} target="_blank" rel="noreferrer" className="btn-primary w-full justify-center !px-2 !py-1.5 !text-xs">
                <IconWhatsapp size={13} /> Pedir info
              </a>
            </div>
          </article>
        ))}
        {shown.length === 0 && <p className="col-span-full py-16 text-center text-sm text-slate-500">No hay prendas con esos filtros.</p>}
      </main>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={() => setOpen(null)}>
          <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto">
              {open.images.map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src} src={src} alt={open.code} className="aspect-[3/4] w-full shrink-0 snap-center object-cover" />
              ))}
            </div>
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-sm font-bold uppercase">{open.code}</h3>
                <span className="text-xs text-slate-500">{open.brand}</span>
              </div>
              <p className="text-xs text-slate-600">
                {open.colors.join(", ")}
                {open.sizes.length ? ` · Tallas ${open.sizes.join(", ")}` : ""}
              </p>
              <div className="flex gap-2">
                <a href={ask(open)} target="_blank" rel="noreferrer" className="btn-primary flex-1 justify-center">
                  <IconWhatsapp size={15} /> Consultar por WhatsApp
                </a>
                <button className="btn-secondary" onClick={() => setOpen(null)}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
        active ? "bg-primary text-white" : "bg-white/10 text-slate-200 hover:bg-white/20"
      }`}
    >
      {children}
    </button>
  );
}

export function Swatch({ name, size = 12 }: { name: string; size?: number }) {
  const hex = colorHex(name);
  return (
    <span
      title={name}
      className="inline-block shrink-0 rounded-full border border-slate-300"
      style={{ width: size, height: size, background: hex ?? "repeating-linear-gradient(45deg,#e2e8f0 0 3px,#fff 3px 6px)" }}
    />
  );
}
