"use client";

import { useMemo } from "react";
import { clearCanvas, setExistencia, setFilters, togglePanel, updateCatalog } from "@/lib/client/actions";
import { groupImages, hasData } from "@/lib/client/selectors";
import { useEditor } from "@/lib/client/store";
import { slugify } from "@/lib/shared/slug";
import { IconDownload, IconLink, IconSheet, IconTrash, IconX } from "@/components/icons";
import { openFilePicker } from "./filePicker";

export function CatalogPanel() {
  const open = useEditor((s) => s.panels.catalog);
  const catalog = useEditor((s) => s.catalog);
  const products = useEditor((s) => s.products);
  const images = useEditor((s) => s.images);
  const backend = useEditor((s) => s.backend);

  const stats = useMemo(() => {
    const list = Object.values(products);
    const byProduct = groupImages(images);
    const imgs = Object.values(images);
    return {
      total: list.length,
      inStock: list.filter((p) => p.existencia).length,
      noPhoto: list.filter((p) => !byProduct.get(p.key)?.length).length,
      noData: list.filter((p) => !hasData(p)).length,
      photos: imgs.length,
      uploaded: imgs.filter((i) => i.status === "uploaded").length,
      savedMb: imgs.reduce((a, i) => a + Math.max(0, i.originalBytes - (i.optimizedBytes ?? i.originalBytes)), 0) / 1048576,
    };
  }, [products, images]);

  const keys = Object.keys(products);

  return (
    <aside
      className={`absolute inset-y-0 left-0 z-30 flex w-full max-w-[320px] flex-col border-r border-line bg-white/95 shadow-2xl backdrop-blur-md transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full"}`}
      aria-hidden={!open}
    >
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 p-4">
        <div className="min-w-0">
          <span className="rounded bg-primary-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">Catálogo activo</span>
          <input
            className="font-display mt-1 w-full truncate rounded bg-transparent text-base font-bold text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-blue-200"
            value={catalog.name}
            onChange={(e) => updateCatalog({ name: e.target.value })}
          />
        </div>
        <button className="rounded-md p-1 text-slate-400 hover:text-slate-700" onClick={() => togglePanel("catalog", false)}>
          <IconX size={18} />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4 text-xs text-slate-600">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Prendas" value={stats.total} />
          <Stat label="En existencia" value={stats.inStock} accent />
          <Stat label="Fotos en la nube" value={backend?.uploads ? `${stats.uploaded}/${stats.photos}` : "—"} />
          <Stat label="Datos ahorrados" value={`${stats.savedMb.toFixed(1)} MB`} />
        </div>

        {(stats.noPhoto > 0 || stats.noData > 0) && (
          <div className="space-y-1.5">
            <span className="field-label">Por revisar</span>
            {stats.noData > 0 && (
              <button className="flex w-full items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-left font-medium text-amber-800 hover:bg-amber-100" onClick={() => setFilters({ data: "nodata" })}>
                <span>{stats.noData} foto(s) sin fila en el Excel</span>
                <span>Ver</span>
              </button>
            )}
            {stats.noPhoto > 0 && (
              <button className="flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-left font-medium text-slate-700 hover:bg-slate-100" onClick={() => setFilters({ data: "nophoto" })}>
                <span>{stats.noPhoto} prenda(s) sin foto</span>
                <span>Ver</span>
              </button>
            )}
          </div>
        )}

        <div className="space-y-3">
          <Field label="Nombre de la distribuidora">
            <input className="field" placeholder="ModaMayorista GDL" value={catalog.distributor} onChange={(e) => updateCatalog({ distributor: e.target.value })} />
          </Field>
          <Field label="WhatsApp para pedidos">
            <input className="field" inputMode="tel" placeholder="+52 33 2840 9100" value={catalog.whatsapp} onChange={(e) => updateCatalog({ whatsapp: e.target.value })} />
          </Field>
          <Field label="Mensaje al compartir">
            <textarea className="field resize-none" rows={3} value={catalog.message} onChange={(e) => updateCatalog({ message: e.target.value })} />
          </Field>
          <Field label="Enlace público">
            <div className="flex items-center gap-1 rounded-lg border border-slate-300 bg-canvas pl-2 focus-within:border-primary">
              <IconLink size={13} className="shrink-0 text-slate-400" />
              <span className="shrink-0 text-slate-400">/c/</span>
              <input className="min-w-0 flex-1 bg-transparent py-2 pr-2 font-mono text-[12px] text-slate-800 outline-none" value={catalog.slug} onChange={(e) => updateCatalog({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 60) })}
                onBlur={() => updateCatalog({ slug: slugify(catalog.slug) || `catalogo-${catalog.id.slice(0, 6)}` })} />
            </div>
            {!backend?.db && <p className="mt-1 text-[11px] text-slate-400">Se activa al conectar la base de datos.</p>}
          </Field>
        </div>

        <div className="space-y-1.5 border-t border-slate-100 pt-4">
          <span className="field-label">Acciones en bloque</span>
          <BlockButton onClick={() => setExistencia(keys, true)}>Marcar todas en existencia</BlockButton>
          <BlockButton onClick={() => setExistencia(keys, false)}>Ocultar todas (agotadas)</BlockButton>
          <BlockButton onClick={() => openFilePicker(".xlsx,.xlsm,.csv")}>
            <span className="flex items-center gap-2">
              <IconSheet size={14} /> Importar Excel
            </span>
          </BlockButton>
          <a href="/plantilla-catalogo.csv" download className="flex w-full items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 font-medium text-slate-700 transition hover:bg-blue-50 hover:text-primary">
            <IconDownload size={14} /> Descargar plantilla
          </a>
          <button
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 font-medium text-red-500 transition hover:bg-red-50"
            onClick={() => {
              if (confirm("¿Vaciar el lienzo? Se quitarán todas las prendas y fotos de este equipo.")) void clearCanvas();
            }}
          >
            <IconTrash size={14} /> Vaciar lienzo
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/80 p-3 text-[11px] text-slate-500">
        <span className="h-2 w-2 rounded-full bg-primary" />
        Autoguardado continuo: no hay que presionar Guardar
      </div>
    </aside>
  );
}

function Stat({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? "border-blue-100 bg-blue-50/60" : "border-slate-100 bg-slate-50"}`}>
      <span className={`block text-[11px] ${accent ? "text-blue-500" : "text-slate-400"}`}>{label}</span>
      <span className={`tnum text-lg font-bold ${accent ? "text-blue-700" : "text-slate-800"}`}>{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function BlockButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button className="flex w-full items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-left font-medium text-slate-700 transition hover:bg-blue-50 hover:text-primary" onClick={onClick}>
      {children}
    </button>
  );
}
