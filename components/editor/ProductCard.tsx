"use client";

import { memo, useEffect, useState } from "react";
import { addImages, isImageFile, select, setExistencia } from "@/lib/client/actions";
import { hasFiles } from "@/lib/client/files";
import { hasData } from "@/lib/client/selectors";
import { useEditor } from "@/lib/client/store";
import type { ImageAsset, Product } from "@/lib/shared/domain";
import { Swatch } from "@/components/PublicCatalog";
import { IconAlert, IconCheck, IconCloudOff, IconImage } from "@/components/icons";

export const CARD_W = 232;
export const CARD_H = 396;

interface Props {
  product: Product;
  images: ImageAsset[];
  selected: boolean;
  x: number;
  y: number;
  delay: number;
}

function ProductCardImpl({ product, images, selected, x, y, delay }: Props) {
  const cover = images[0];
  const preview = useEditor((s) => (cover ? s.previews[cover.id] : undefined));
  const [dropping, setDropping] = useState(false);
  const [broken, setBroken] = useState(false);
  const out = !product.existencia;
  useEffect(() => setBroken(false), [preview]);
  const fresh = Date.now() - Math.max(product.updatedAt, cover?.addedAt ?? 0) < 4000;

  return (
    <div
      className={`card absolute ${fresh ? "animate-pop" : ""} flex cursor-pointer select-none flex-col overflow-hidden`}
      data-selected={selected}
      data-card
      style={{ width: CARD_W, height: CARD_H, left: x, top: y, animationDelay: `${delay}ms` }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => select(product.key, e.shiftKey || e.metaKey || e.ctrlKey)}
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.stopPropagation();
        setDropping(true);
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={(e) => {
        const files = [...e.dataTransfer.files].filter(isImageFile);
        setDropping(false);
        if (!files.length) return;
        e.preventDefault();
        e.stopPropagation();
        addImages(files, product.key);
      }}
    >
      <div className="relative h-[290px] shrink-0 overflow-hidden bg-slate-100">
        {preview && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt={product.code}
            draggable={false}
            decoding="async"
            onError={() => setBroken(true)}
            className={`h-full w-full object-cover transition duration-300 ${out ? "opacity-40 grayscale" : ""}`}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
            <IconImage size={28} />
            <span className="text-[11px] font-medium">{cover ? (cover.undecodable ? "Formato HEIC: se procesa en la nube" : "Sin vista previa") : "Sin foto · suelta una aquí"}</span>
          </div>
        )}

        {product.brand && <span className="pill absolute left-2 top-2 max-w-[120px] truncate bg-white/90 text-slate-900 backdrop-blur-sm">{product.brand}</span>}

        <label
          className="absolute right-2 top-2 flex items-center gap-1.5 rounded-xl border border-slate-100 bg-white/95 px-1.5 py-1 shadow-md backdrop-blur"
          onClick={(e) => e.stopPropagation()}
          title="Si está apagado, la clienta no ve esta prenda"
        >
          <span className={`text-[9px] font-bold uppercase tracking-wider ${out ? "text-slate-400" : "text-primary"}`}>{out ? "Oculto" : "Existencia"}</span>
          <input type="checkbox" className="peer sr-only" checked={product.existencia} onChange={(e) => setExistencia([product.key], e.target.checked)} />
          <span className="relative h-4 w-7 rounded-full bg-slate-300 transition peer-checked:bg-primary peer-checked:shadow-[0_0_10px_rgba(37,99,235,0.3)] after:absolute after:left-[2px] after:top-[2px] after:h-3 after:w-3 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-3" />
        </label>

        {out && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded-md bg-slate-900/90 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-white">Agotado</span>
          </div>
        )}

        <div className="absolute bottom-2 left-2 flex gap-1">
          {images.length > 1 && <span className="pill bg-slate-900/80 text-white">{images.length} fotos</span>}
          {!hasData(product) && (
            <span className="pill bg-amber-100 text-amber-800" title="Esta foto aún no tiene fila en el Excel">
              Sin datos
            </span>
          )}
        </div>
        <div className="absolute bottom-2 right-2">
          <SyncBadge images={images} />
        </div>

        {dropping && (
          <div className="absolute inset-0 grid place-items-center bg-primary/15 ring-2 ring-inset ring-primary">
            <span className="rounded-lg bg-primary px-2 py-1 text-[11px] font-bold text-white">Agregar a {product.code}</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between gap-2 p-3">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="truncate font-mono text-xs font-bold uppercase tracking-tight text-slate-900">{product.code}</h4>
            {Object.keys(product.attrs).length > 0 && <span className="shrink-0 text-[10px] text-slate-400">{Object.values(product.attrs)[0]}</span>}
          </div>
          <div className="mt-1.5 flex h-[18px] flex-wrap gap-1 overflow-hidden">
            {product.colors.map((c) => (
              <span key={c} className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                <Swatch name={c} size={8} />
                {c}
              </span>
            ))}
            {!product.colors.length && <span className="text-[10px] text-slate-300">Sin colores</span>}
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[10px]">
          <span className="font-medium text-slate-400">Tallas</span>
          <div className="flex h-[16px] flex-wrap justify-end gap-1 overflow-hidden">
            {product.sizes.map((s) => (
              <span key={s} className="rounded border border-slate-200 px-1 font-mono text-[10px] text-slate-500">
                {s}
              </span>
            ))}
            {!product.sizes.length && <span className="text-slate-300">—</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Estado agregado de las fotos de la prenda: discreto, porque la subida es "bajo el agua". */
function SyncBadge({ images }: { images: ImageAsset[] }) {
  if (!images.length) return null;
  if (images.some((i) => i.status === "error"))
    return (
      <span className="grid h-6 w-6 place-items-center rounded-full bg-red-500 text-white shadow" title={images.find((i) => i.error)?.error ?? "Error al subir"}>
        <IconAlert size={13} />
      </span>
    );
  if (images.every((i) => i.status === "uploaded"))
    return (
      <span className="grid h-6 w-6 place-items-center rounded-full bg-white/95 text-emerald shadow" title="En la nube">
        <IconCheck size={13} />
      </span>
    );
  if (images.every((i) => i.status === "local"))
    return (
      <span className="grid h-6 w-6 place-items-center rounded-full bg-white/95 text-slate-400 shadow" title="Guardada en este navegador">
        <IconCloudOff size={13} />
      </span>
    );
  const progress = images.reduce((a, i) => a + (i.status === "uploaded" ? 1 : i.status === "uploading" ? i.progress : 0), 0) / images.length;
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <span className="grid h-6 w-6 place-items-center rounded-full bg-white/95 shadow" title={images.some((i) => i.status === "processing") ? "Optimizando…" : "Subiendo…"}>
      <svg width="20" height="20" viewBox="0 0 24 24" className="-rotate-90">
        <circle cx="12" cy="12" r={r} fill="none" stroke="#E2E8F0" strokeWidth="3" />
        <circle cx="12" cy="12" r={r} fill="none" stroke="#2563EB" strokeWidth="3" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0.08, progress))} strokeLinecap="round" className="transition-all duration-300" />
      </svg>
    </span>
  );
}

const sameImages = (a: ImageAsset[], b: ImageAsset[]) => a.length === b.length && a.every((x, i) => x === b[i]);

export const ProductCard = memo(
  ProductCardImpl,
  (a, b) => a.product === b.product && a.selected === b.selected && a.x === b.x && a.y === b.y && sameImages(a.images, b.images),
);
