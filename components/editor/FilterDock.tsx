"use client";

import { useMemo } from "react";
import { setFilters } from "@/lib/client/actions";
import { applyFilters, facets, groupImages, sortedProducts } from "@/lib/client/selectors";
import { emptyFilters, useEditor } from "@/lib/client/store";
import { IconMaximize, IconMinus, IconPlus, IconSearch, IconX } from "@/components/icons";
import type { CanvasHandle } from "./CanvasView";

export function FilterDock({ canvas, zoom }: { canvas: React.RefObject<CanvasHandle | null>; zoom: number }) {
  const products = useEditor((s) => s.products);
  const images = useEditor((s) => s.images);
  const filters = useEditor((s) => s.filters);
  const all = useMemo(() => sortedProducts(products), [products]);
  const f = useMemo(() => facets(all), [all]);
  const shown = useMemo(() => applyFilters(all, groupImages(images), filters).length, [all, images, filters]);
  const active =
    (filters.stock !== "all" ? 1 : 0) + (filters.brand ? 1 : 0) + (filters.color ? 1 : 0) + (filters.size ? 1 : 0) + (filters.query ? 1 : 0) + (filters.data !== "all" ? 1 : 0);

  if (!all.length) return null;

  return (
    <div className="pointer-events-none absolute inset-x-2 bottom-3 z-20 flex justify-center sm:inset-x-4 sm:bottom-6">
      <div className="glass pointer-events-auto flex max-w-full items-center gap-2 overflow-x-auto rounded-2xl px-2 py-2 no-scrollbar" onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 rounded-xl bg-slate-100 p-0.5 text-xs font-semibold">
          {(
            [
              ["all", "Todas"],
              ["in", "Existencia"],
              ["out", "Agotadas"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              className={`flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 transition ${filters.stock === v ? "bg-primary text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
              onClick={() => setFilters({ stock: v })}
            >
              {v === "in" && <span className={`h-1.5 w-1.5 rounded-full ${filters.stock === v ? "bg-white" : "bg-primary"}`} />}
              {label}
            </button>
          ))}
        </div>

        <Select value={filters.brand} placeholder="Marca" options={f.brands} onChange={(brand) => setFilters({ brand })} />
        <Select value={filters.color} placeholder="Color" options={f.colors} onChange={(color) => setFilters({ color })} />
        <Select value={filters.size} placeholder="Talla" options={f.sizes} onChange={(size) => setFilters({ size })} />
        <select
          className={selectClass(filters.data !== "all")}
          value={filters.data}
          onChange={(e) => setFilters({ data: e.target.value as typeof filters.data })}
        >
          <option value="all">Estado</option>
          <option value="nodata">Sin datos de Excel</option>
          <option value="nophoto">Sin foto</option>
        </select>

        <div className="relative w-36 shrink-0">
          <IconSearch size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full rounded-xl bg-slate-100 py-1.5 pl-7 pr-2 text-xs font-medium text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-primary"
            placeholder="Buscar código…"
            value={filters.query}
            onChange={(e) => setFilters({ query: e.target.value })}
          />
        </div>

        <span className="tnum shrink-0 px-1 text-[11px] font-medium text-slate-500">
          {shown}/{all.length}
        </span>
        {active > 0 && (
          <button className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Limpiar filtros" onClick={() => setFilters(emptyFilters)}>
            <IconX size={15} />
          </button>
        )}

        <div className="mx-1 hidden h-6 w-px shrink-0 bg-slate-200 sm:block" />
        <div className="hidden shrink-0 items-center gap-0.5 rounded-xl bg-obsidian p-0.5 text-white sm:flex">
          <button className="grid h-7 w-7 place-items-center rounded-lg hover:bg-white/10" onClick={() => canvas.current?.zoomBy(1 / 1.2)} title="Alejar">
            <IconMinus size={14} />
          </button>
          <span className="tnum w-10 text-center text-[11px] font-semibold">{Math.round(zoom * 100)}%</span>
          <button className="grid h-7 w-7 place-items-center rounded-lg hover:bg-white/10" onClick={() => canvas.current?.zoomBy(1.2)} title="Acercar">
            <IconPlus size={14} />
          </button>
          <button className="grid h-7 w-7 place-items-center rounded-lg hover:bg-white/10" onClick={() => canvas.current?.fit()} title="Ver todo">
            <IconMaximize size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

const selectClass = (on: boolean) =>
  `shrink-0 cursor-pointer appearance-none rounded-xl px-3 py-1.5 text-xs font-semibold outline-none transition focus:ring-2 focus:ring-primary ${
    on ? "bg-primary-soft text-primary ring-1 ring-blue-200" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
  }`;

function Select({ value, placeholder, options, onChange }: { value: string | null; placeholder: string; options: string[]; onChange: (v: string | null) => void }) {
  if (!options.length) return null;
  return (
    <select className={selectClass(!!value)} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
