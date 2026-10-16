"use client";

import { useEffect, useMemo, useState } from "react";
import { makeCover, removeImage, removeProducts, renameProduct, select, setExistencia, togglePanel, updateProduct } from "@/lib/client/actions";
import { facets, sortedProducts } from "@/lib/client/selectors";
import { useEditor } from "@/lib/client/store";
import type { ImageAsset, Product } from "@/lib/shared/domain";
import { Swatch } from "@/components/PublicCatalog";
import { IconImage, IconStar, IconTrash, IconX } from "@/components/icons";

const COMMON_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "UNITALLA"];

export function Inspector() {
  const open = useEditor((s) => s.panels.inspector);
  const selection = useEditor((s) => s.selection);
  const products = useEditor((s) => s.products);
  const selected = selection.map((k) => products[k]).filter(Boolean);

  return (
    <aside
      className={`absolute inset-y-0 right-0 z-30 flex w-full flex-col border-l border-line bg-white/95 shadow-[var(--shadow-panel)] backdrop-blur-md transition-transform duration-300 sm:w-[380px] lg:relative lg:shrink-0 lg:bg-white lg:shadow-none ${open ? "translate-x-0" : "translate-x-full lg:hidden"}`}
      aria-hidden={!open}
    >
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 p-4">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
            {selected.length > 1 ? `${selected.length} prendas seleccionadas` : "Inspector de prenda"}
          </span>
        </div>
        <button className="rounded-md p-1 text-slate-400 hover:text-slate-700" onClick={() => togglePanel("inspector", false)}>
          <IconX size={18} />
        </button>
      </div>
      {selected.length === 0 && <Placeholder />}
      {selected.length === 1 && <ProductEditor key={selected[0].key} product={selected[0]} />}
      {selected.length > 1 && <BulkEditor products={selected} />}
    </aside>
  );
}

function Placeholder() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-slate-400">
      <IconImage size={36} />
      <p className="max-w-[240px] text-xs font-medium">
        Haz clic en cualquier prenda del lienzo para ver y editar sus datos. Con <kbd className="rounded border px-1">Shift</kbd> seleccionas varias.
      </p>
    </div>
  );
}

function ProductEditor({ product }: { product: Product }) {
  const allImages = useEditor((s) => s.images);
  const previews = useEditor((s) => s.previews);
  const products = useEditor((s) => s.products);
  const images = useMemo(() => Object.values(allImages).filter((i) => i.productKey === product.key).sort((a, b) => a.addedAt - b.addedAt), [allImages, product.key]);
  const known = useMemo(() => facets(sortedProducts(products)), [products]);
  const [active, setActive] = useState(0);
  const [code, setCode] = useState(product.code);
  useEffect(() => setCode(product.code), [product.code]);
  const cover = images[Math.min(active, images.length - 1)];

  const commitCode = () => {
    if (code.trim() && code.trim() !== product.code) renameProduct(product.key, code.trim());
    else setCode(product.code);
  };

  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-4 text-xs">
      <div className="relative flex aspect-[4/5] max-h-60 w-full items-center justify-center overflow-hidden rounded-xl border border-line bg-slate-100">
        {cover && previews[cover.id] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previews[cover.id]} alt={product.code} className="h-full w-full object-contain" />
        ) : (
          <span className="text-slate-400">Sin foto. Suelta una sobre la tarjeta.</span>
        )}
        {cover && (
          <span className="absolute bottom-2 left-2 rounded bg-slate-950/70 px-2 py-0.5 font-mono text-[10px] text-white backdrop-blur-sm">
            {cover.width ? `${cover.width}×${cover.height}` : cover.fileName} · {statusLabel(cover)}
          </span>
        )}
      </div>

      {images.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <div key={img.id} className={`group relative h-16 w-12 shrink-0 overflow-hidden rounded-lg border-2 ${i === active ? "border-primary" : "border-transparent"}`}>
              <button className="h-full w-full" onClick={() => setActive(i)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {previews[img.id] && <img src={previews[img.id]} alt="" className="h-full w-full object-cover" />}
              </button>
              <div className="absolute inset-x-0 bottom-0 hidden justify-between bg-slate-900/70 p-0.5 group-hover:flex">
                <button title="Usar como portada" className="text-white" onClick={() => (makeCover(img.id), setActive(0))}>
                  <IconStar size={11} />
                </button>
                <button title="Quitar foto" className="text-white" onClick={() => removeImage(img.id)}>
                  <IconTrash size={11} />
                </button>
              </div>
              {i === 0 && <span className="absolute left-0.5 top-0.5 rounded bg-primary px-1 text-[8px] font-bold text-white">PORTADA</span>}
            </div>
          ))}
        </div>
      )}

      <label className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 ${product.existencia ? "border-blue-100 bg-blue-50/60" : "border-slate-200 bg-slate-50"}`}>
        <div>
          <span className="block text-xs font-bold text-slate-900">Existencia</span>
          <span className={`text-[11px] font-medium ${product.existencia ? "text-primary" : "text-slate-500"}`}>
            {product.existencia ? "Visible para tus clientas" : "Agotada: oculta en el catálogo"}
          </span>
        </div>
        <input type="checkbox" className="peer sr-only" checked={product.existencia} onChange={(e) => setExistencia([product.key], e.target.checked)} />
        <span className="relative h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-primary peer-checked:shadow-[0_0_10px_rgba(37,99,235,0.3)] after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
      </label>

      <div className="space-y-3">
        <div>
          <span className="field-label">Código / ID de prenda</span>
          <input
            className="field font-mono font-semibold uppercase"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onBlur={commitCode}
            onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
          />
          <p className="mt-1 text-[10px] text-slate-400">Es la llave para emparejar con el Excel y el nombre de la foto.</p>
        </div>
        <div>
          <span className="field-label">Marca</span>
          <input className="field" list="brands" value={product.brand} placeholder="Ej. Zara" onChange={(e) => updateProduct(product.key, { brand: e.target.value })} />
          <datalist id="brands">
            {known.brands.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </div>
        <div>
          <span className="field-label">Colores</span>
          <TagInput
            values={product.colors}
            suggestions={known.colors}
            placeholder="Escribe y presiona Enter"
            render={(c) => (
              <>
                <Swatch name={c} size={9} /> {c}
              </>
            )}
            onChange={(colors) => updateProduct(product.key, { colors })}
          />
        </div>
        <div>
          <span className="field-label">Tallas</span>
          <div className="flex flex-wrap gap-1.5">
            {[...new Set([...COMMON_SIZES, ...known.sizes, ...product.sizes])].map((s) => {
              const on = product.sizes.includes(s);
              return (
                <button
                  key={s}
                  className={`rounded-md px-2 py-1 font-mono text-[11px] transition ${on ? "bg-primary font-bold text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                  onClick={() => updateProduct(product.key, { sizes: on ? product.sizes.filter((x) => x !== s) : [...product.sizes, s] })}
                >
                  {s}
                </button>
              );
            })}
            <AddChip onAdd={(s) => !product.sizes.includes(s) && updateProduct(product.key, { sizes: [...product.sizes, s] })} />
          </div>
        </div>
        {Object.keys(product.attrs).length > 0 && (
          <div>
            <span className="field-label">Otros datos del Excel</span>
            <dl className="divide-y divide-slate-100 rounded-lg border border-slate-100">
              {Object.entries(product.attrs).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 px-3 py-1.5">
                  <dt className="text-slate-400">{k}</dt>
                  <dd className="truncate font-medium text-slate-700">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="text-[10px] text-slate-400">Sin precio público: la clienta pregunta por WhatsApp</span>
        <button className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-700" onClick={() => removeProducts([product.key])}>
          <IconTrash size={13} /> Eliminar
        </button>
      </div>
    </div>
  );
}

function BulkEditor({ products }: { products: Product[] }) {
  const keys = products.map((p) => p.key);
  const [brand, setBrand] = useState("");
  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-4 text-xs">
      <div className="grid grid-cols-2 gap-2">
        <button className="btn-primary justify-center" onClick={() => setExistencia(keys, true)}>
          En existencia
        </button>
        <button className="btn-secondary justify-center" onClick={() => setExistencia(keys, false)}>
          Agotadas
        </button>
      </div>
      <div>
        <span className="field-label">Asignar marca a todas</span>
        <div className="flex gap-2">
          <input className="field" value={brand} placeholder="Marca" onChange={(e) => setBrand(e.target.value)} />
          <button className="btn-dark" disabled={!brand} onClick={() => keys.forEach((k) => updateProduct(k, { brand }))}>
            Aplicar
          </button>
        </div>
      </div>
      <div className="flex justify-between border-t border-slate-100 pt-3">
        <button className="btn-ghost" onClick={() => select(null)}>
          Deseleccionar
        </button>
        <button className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-700" onClick={() => removeProducts(keys)}>
          <IconTrash size={13} /> Eliminar {keys.length}
        </button>
      </div>
    </div>
  );
}

function TagInput({
  values,
  suggestions,
  placeholder,
  render,
  onChange,
}: {
  values: string[];
  suggestions: string[];
  placeholder: string;
  render: (v: string) => React.ReactNode;
  onChange: (v: string[]) => void;
}) {
  const [text, setText] = useState("");
  const add = (raw: string) => {
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean).map((s) => s[0].toUpperCase() + s.slice(1));
    const next = [...values];
    for (const p of parts) if (!next.some((v) => v.toLowerCase() === p.toLowerCase())) next.push(p);
    onChange(next);
    setText("");
  };
  return (
    <div className="field flex flex-wrap items-center gap-1 !p-1.5">
      {values.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-md bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-700 shadow-sm ring-1 ring-slate-200">
          {render(v)}
          <button className="text-slate-400 hover:text-red-500" onClick={() => onChange(values.filter((x) => x !== v))}>
            <IconX size={10} />
          </button>
        </span>
      ))}
      <input
        className="min-w-[90px] flex-1 bg-transparent px-1 py-0.5 text-xs outline-none"
        list="tag-suggestions"
        value={text}
        placeholder={values.length ? "" : placeholder}
        onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value) : setText(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && text.trim()) add(text);
          if (e.key === "Backspace" && !text && values.length) onChange(values.slice(0, -1));
        }}
        onBlur={() => text.trim() && add(text)}
      />
      <datalist id="tag-suggestions">
        {suggestions.filter((s) => !values.includes(s)).map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
}

function AddChip({ onAdd }: { onAdd: (v: string) => void }) {
  const [text, setText] = useState("");
  return (
    <input
      className="w-16 rounded-md border border-dashed border-slate-300 bg-transparent px-2 py-1 font-mono text-[11px] uppercase outline-none focus:border-primary"
      placeholder="+ otra"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && text.trim()) {
          onAdd(text.trim().toUpperCase());
          setText("");
        }
      }}
    />
  );
}

function statusLabel(img: ImageAsset) {
  switch (img.status) {
    case "processing":
      return "optimizando";
    case "queued":
      return img.attempts ? `reintento ${img.attempts}` : "en cola";
    case "uploading":
      return `subiendo ${Math.round(img.progress * 100)}%`;
    case "uploaded":
      return "en la nube";
    case "local":
      return "en este equipo";
    case "error":
      return "error al subir";
  }
}
