"use client";

import { useMemo } from "react";
import { togglePanel } from "@/lib/client/actions";
import { useEditor, toast, getState } from "@/lib/client/store";
import { retryFailed } from "@/lib/client/uploader";
import { whatsappLink } from "@/lib/shared/slug";
import { IconCloud, IconCloudOff, IconEye, IconPanelLeft, IconPanelRight, IconRefresh, IconWhatsapp } from "@/components/icons";

export function TopBar() {
  const panels = useEditor((s) => s.panels);
  const products = useEditor((s) => s.products);
  const inStock = useMemo(() => Object.values(products).filter((p) => p.existencia).length, [products]);

  return (
    <header className="relative z-40 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-800/80 bg-obsidian px-3 text-white shadow-md sm:px-4">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          className={`grid h-8 w-8 place-items-center rounded-lg transition ${panels.catalog ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}
          onClick={() => togglePanel("catalog")}
          title="Información del catálogo"
        >
          <IconPanelLeft size={18} />
        </button>
        <div className="flex items-center font-display text-xl font-extrabold tracking-tight">
          <span className="text-primary">cata</span>
          <span>logos</span>
        </div>
        <span className="hidden rounded-full border border-blue-500/30 bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-300 md:inline">
          Mayorista
        </span>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <SyncStatus />
        <div className="hidden items-center rounded-md border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-xs text-slate-400 lg:flex">
          <span className="mr-2 h-2 w-2 rounded-full bg-emerald" />
          <span className="tnum">{inStock} en existencia</span>
        </div>
        <button className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 sm:flex" onClick={() => togglePanel("preview", true)}>
          <IconEye size={15} /> Vista cliente
        </button>
        <button className="flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#20ba59] active:scale-95" onClick={share}>
          <IconWhatsapp size={15} />
          <span className="hidden sm:inline">Enviar catálogo</span>
        </button>
        <button
          className={`grid h-8 w-8 place-items-center rounded-lg transition ${panels.inspector ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}
          onClick={() => togglePanel("inspector")}
          title="Inspector de prenda"
        >
          <IconPanelRight size={18} />
        </button>
      </div>
    </header>
  );
}

async function share() {
  const { backend, catalog, products } = getState();
  const visible = Object.values(products).filter((p) => p.existencia).length;
  if (!visible) {
    toast({ title: "No hay prendas en existencia", body: "Activa el interruptor Existencia en las prendas que quieras mostrar.", tone: "warning" });
    return;
  }
  if (!backend?.db) {
    togglePanel("preview", true);
    toast(
      {
        title: "Así lo verán tus clientas",
        body: "Para generar un enlace público, conecta la base de datos y el almacenamiento (ver README › Despliegue).",
        tone: "info",
      },
      9000,
    );
    return;
  }
  const url = `${location.origin}/c/${catalog.slug}`;
  try {
    await navigator.clipboard.writeText(url);
  } catch {}
  window.open(whatsappLink("", `${catalog.message}\n\n${url}`), "_blank", "noopener");
  toast({ title: "Enlace copiado", body: `${visible} prendas disponibles en ${url}`, tone: "success" }, 7000);
}

function SyncStatus() {
  const images = useEditor((s) => s.images);
  const backend = useEditor((s) => s.backend);
  const online = useEditor((s) => s.online);
  const syncPending = useEditor((s) => s.syncPending);

  const stats = useMemo(() => {
    let done = 0, pending = 0, errors = 0, processing = 0, partial = 0;
    for (const i of Object.values(images)) {
      if (i.status === "uploaded") done++;
      else if (i.status === "error") errors++;
      else if (i.status === "processing") processing++;
      else if (i.status !== "local") {
        pending++;
        if (i.status === "uploading") partial += i.progress;
      }
    }
    return { done, pending, errors, processing, partial, total: Object.keys(images).length };
  }, [images]);

  const base = "flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs";

  if (!backend) return null;
  if (!online)
    return (
      <span className={`${base} border-amber-500/30 bg-amber-500/10 text-amber-300`} title="Las fotos siguen guardadas en este equipo y se suben solas al volver la señal.">
        <IconCloudOff size={14} /> <span className="hidden sm:inline">Sin conexión · en espera</span>
      </span>
    );
  if (stats.errors)
    return (
      <button className={`${base} border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20`} onClick={retryFailed}>
        <IconRefresh size={14} /> {stats.errors} sin subir · Reintentar
      </button>
    );
  if (stats.processing || stats.pending) {
    const totalWork = stats.done + stats.pending + stats.processing;
    const pct = totalWork ? ((stats.done + stats.partial) / totalWork) * 100 : 0;
    return (
      <span className={`${base} border-slate-800 bg-slate-900/80 text-slate-300`} title="Puedes seguir trabajando; la subida ocurre en segundo plano.">
        <span className="relative h-1.5 w-14 overflow-hidden rounded-full bg-slate-700">
          <span className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
        </span>
        <span className="tnum hidden sm:inline">
          {stats.processing ? `Optimizando ${stats.processing}` : `Subiendo ${stats.done}/${totalWork}`}
        </span>
      </span>
    );
  }
  if (!backend.uploads)
    return (
      <span className={`${base} border-slate-800 bg-slate-900/80 text-slate-400`} title="Sin almacenamiento en la nube configurado: todo se guarda en este navegador.">
        <IconCloudOff size={14} /> <span className="hidden sm:inline">Guardado en este equipo</span>
      </span>
    );
  return (
    <span className={`${base} border-slate-800 bg-slate-900/80 text-slate-300`}>
      <IconCloud size={14} className={syncPending ? "text-slate-400" : "text-emerald"} />
      <span className="hidden sm:inline">{syncPending ? "Guardando…" : "Todo en la nube"}</span>
    </span>
  );
}
