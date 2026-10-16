"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addFiles, removeProducts, select, setExistencia, togglePanel } from "@/lib/client/actions";
import { boot } from "@/lib/client/boot";
import { filesFromDataTransfer, hasFiles } from "@/lib/client/files";
import { groupImages, sortedProducts } from "@/lib/client/selectors";
import { dismissToast, getState, setState, useEditor } from "@/lib/client/store";
import { PublicCatalog } from "@/components/PublicCatalog";
import { IconAlert, IconCheck, IconPlus, IconSheet, IconUpload, IconX } from "@/components/icons";
import { CanvasView, type CanvasHandle } from "./CanvasView";
import { CatalogPanel } from "./CatalogPanel";
import { FilterDock } from "./FilterDock";
import { Inspector } from "./Inspector";
import { TopBar } from "./TopBar";
import { openFilePicker } from "./filePicker";

export function Editor() {
  const canvas = useRef<CanvasHandle>(null);
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const hydrated = useEditor((s) => s.hydrated);
  const importing = useEditor((s) => s.importing);
  const count = useEditor((s) => Object.keys(s.products).length);

  useEffect(() => {
    void boot();
    // En pantallas chicas el inspector arranca cerrado para dejar ver el lienzo.
    if (window.innerWidth < 1024) setState((s) => ({ panels: { ...s.panels, inspector: false } }));
  }, []);

  // Soltar archivos en cualquier parte de la ventana.
  useEffect(() => {
    let depth = 0;
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const leave = () => {
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const over = (e: DragEvent) => hasFiles(e) && e.preventDefault();
    const drop = async (e: DragEvent) => {
      depth = 0;
      setDragging(false);
      if (!e.dataTransfer || !hasFiles(e)) return;
      e.preventDefault();
      addFiles(await filesFromDataTransfer(e.dataTransfer));
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, []);

  // Atajos: E alterna existencia, Supr elimina, Esc deselecciona, ⌘A selecciona todo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      const { selection, products } = getState();
      if (e.key === "Escape") select(null);
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setState({ selection: Object.keys(products) });
      } else if (selection.length && e.key.toLowerCase() === "e") {
        const value = !selection.every((k) => products[k]?.existencia);
        setExistencia(selection, value);
      } else if (selection.length && (e.key === "Delete" || e.key === "Backspace")) {
        if (selection.length === 1 || confirm(`¿Eliminar ${selection.length} prendas?`)) removeProducts(selection);
      } else if (e.key === "+" || e.key === "=") canvas.current?.zoomBy(1.2);
      else if (e.key === "-") canvas.current?.zoomBy(1 / 1.2);
      else if (e.key === "0") canvas.current?.fit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TopBar />
      <div className="relative flex flex-1 overflow-hidden">
        <div className="relative flex-1 overflow-hidden">
          <CanvasView ref={canvas} onZoom={setZoom} />

          {count > 0 && (
            <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2 sm:left-4 sm:top-4" onPointerDown={(e) => e.stopPropagation()}>
              <span className="pointer-events-auto flex items-center rounded-lg border border-line bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm">
                <span className="mr-2 h-2 w-2 rounded-full bg-primary" />
                Lienzo · {count} prendas
              </span>
              <button className="btn-dark pointer-events-auto !px-3 !py-1.5 text-xs" onClick={() => openFilePicker()}>
                <IconPlus size={14} /> Fotos / Excel
              </button>
              {importing > 0 && (
                <span className="flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
                  <IconSheet size={13} className="animate-pulse text-primary" /> Leyendo Excel…
                </span>
              )}
            </div>
          )}

          <FilterDock canvas={canvas} zoom={zoom} />
          <CatalogPanel />

          {!hydrated && (
            <div className="absolute inset-0 grid place-items-center">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
            </div>
          )}
        </div>
        <Inspector />
      </div>

      {dragging && <DropOverlay />}
      <Toasts />
      <PreviewModal />
    </div>
  );
}

function DropOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-primary/10 p-6 backdrop-blur-[2px]">
      <div className="animate-pop flex flex-col items-center rounded-3xl border-2 border-dashed border-primary bg-white/95 px-10 py-8 text-center shadow-2xl">
        <div className="mb-3 grid h-14 w-14 animate-bounce place-items-center rounded-2xl bg-primary text-white shadow-lg shadow-blue-500/30">
          <IconUpload size={26} />
        </div>
        <p className="font-display text-lg font-bold text-obsidian">Suelta para agregar al lienzo</p>
        <p className="mt-1 text-xs text-slate-500">Fotos, carpetas completas o tu Excel. Suéltalas sobre una tarjeta para asignarlas a esa prenda.</p>
      </div>
    </div>
  );
}

function Toasts() {
  const toasts = useEditor((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed right-3 top-16 z-[70] flex w-[min(360px,calc(100vw-24px))] flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="animate-toast pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-700 bg-obsidian p-3.5 text-white shadow-2xl">
          <span
            className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
              t.tone === "error" ? "bg-red-500" : t.tone === "warning" ? "bg-amber-500" : t.tone === "success" ? "bg-emerald" : "bg-primary"
            }`}
          >
            {t.tone === "error" || t.tone === "warning" ? <IconAlert size={14} /> : <IconCheck size={14} />}
          </span>
          <div className="min-w-0 flex-1 text-xs">
            <p className="text-sm font-bold">{t.title}</p>
            {t.body && <p className="mt-0.5 text-slate-300">{t.body}</p>}
          </div>
          <button className="text-slate-500 hover:text-white" onClick={() => dismissToast(t.id)}>
            <IconX size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

function PreviewModal() {
  const open = useEditor((s) => s.panels.preview);
  const products = useEditor((s) => s.products);
  const images = useEditor((s) => s.images);
  const previews = useEditor((s) => s.previews);
  const catalog = useEditor((s) => s.catalog);
  const items = useMemo(() => {
    if (!open) return [];
    const byProduct = groupImages(images);
    return sortedProducts(products)
      .filter((p) => p.existencia)
      .map((p) => ({ ...p, images: (byProduct.get(p.key) ?? []).map((i) => previews[i.id]).filter(Boolean) }));
  }, [open, products, images, previews]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:p-6" onClick={() => togglePanel("preview", false)}>
      <div className="relative h-full w-full overflow-hidden bg-canvas sm:h-[min(860px,100%)] sm:max-w-[430px] sm:rounded-[32px] sm:border-[10px] sm:border-obsidian sm:shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-obsidian px-4 py-2 text-xs font-semibold text-white shadow-lg" onClick={() => togglePanel("preview", false)}>
          <IconX size={14} /> Cerrar vista cliente
        </button>
        <div className="h-full overflow-y-auto pb-16">
          <PublicCatalog title={catalog.name} distributor={catalog.distributor} whatsapp={catalog.whatsapp} items={items} />
        </div>
      </div>
    </div>
  );
}
