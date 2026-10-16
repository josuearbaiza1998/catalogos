"use client";

import { useState } from "react";
import { loadSample } from "@/lib/client/sample";
import { IconDownload, IconImage, IconSheet, IconSparkles } from "@/components/icons";
import { openFilePicker } from "./filePicker";

export function EmptyState() {
  const [loading, setLoading] = useState(false);
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 pb-28">
      <div className="pointer-events-auto w-full max-w-lg animate-pop rounded-3xl border-2 border-dashed border-blue-300 bg-white/80 p-8 text-center shadow-[var(--shadow-dock)] backdrop-blur" onPointerDown={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-white shadow-lg shadow-blue-500/25">
          <IconImage size={26} />
        </div>
        <h2 className="font-display text-xl font-bold text-obsidian">Suelta aquí tus fotos</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-500">
          Selecciona todas las fotos de tu carpeta y arrástralas. Aparecen al instante y se suben solas mientras trabajas. Después suelta tu Excel y cada fila encuentra su foto por el código.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button className="btn-primary" onClick={() => openFilePicker()}>
            <IconImage size={15} /> Elegir fotos o Excel
          </button>
          <button
            className="btn-secondary"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              await loadSample();
            }}
          >
            <IconSparkles size={15} /> {loading ? "Cargando…" : "Probar con un ejemplo"}
          </button>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-2 text-left text-xs text-slate-500 sm:grid-cols-2">
          <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3">
            <IconImage size={14} className="mt-0.5 shrink-0 text-primary" />
            <span>
              Nombra cada foto con el <b className="text-slate-700">código</b> de la prenda: <code className="font-mono">VMD-802.jpg</code>
            </span>
          </div>
          <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3">
            <IconSheet size={14} className="mt-0.5 shrink-0 text-primary" />
            <span>
              Excel con columnas Marca, Código, Colores, Tallas y Existencia.{" "}
              <a href="/plantilla-catalogo.csv" download className="inline-flex items-center gap-0.5 font-semibold text-primary hover:underline">
                <IconDownload size={11} /> Plantilla
              </a>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
