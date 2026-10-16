"use client";
// Sincroniza los metadatos (no los bytes) con Postgres, en lotes y con debounce.
// Sólo viaja lo que cambió; cada producto lleva una firma para saber si ya está al día.

import type { Product, SyncPayload } from "@/lib/shared/domain";
import { groupImages } from "./selectors";
import { getMeta, setMeta } from "./persistence";
import { backoffDelay } from "./uploader";
import { getState, setState, toast, useEditor } from "./store";

let synced: Record<string, string> = {};
let catalogSig = "";
let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;
let attempt = 0;

function signature(p: Product, urls: string[]) {
  return `${p.updatedAt}|${p.position}|${urls.join(",")}`;
}

function buildPayload() {
  const s = getState();
  const byProduct = groupImages(s.images);
  const upserts: SyncPayload["upserts"] = [];
  const sigs: Record<string, string> = {};
  for (const p of Object.values(s.products)) {
    const urls = (byProduct.get(p.key) ?? []).map((i) => i.remoteUrl).filter((u): u is string => !!u);
    const sig = signature(p, urls);
    sigs[p.key] = sig;
    if (synced[p.key] !== sig) upserts.push({ ...p, coverUrl: urls[0], imageUrls: urls });
  }
  const deletes = Object.keys(synced).filter((k) => !(k in s.products));
  const { id: _id, editKey, ...catalog } = s.catalog;
  const cSig = JSON.stringify(catalog);
  return { payload: { editKey, catalog, upserts, deletes } satisfies SyncPayload, sigs, cSig, changed: upserts.length > 0 || deletes.length > 0 || cSig !== catalogSig };
}

async function flush() {
  timer = null;
  if (inFlight) return schedule();
  const { payload, sigs, cSig, changed } = buildPayload();
  if (!changed) {
    setState({ syncPending: false });
    return;
  }
  inFlight = true;
  try {
    // Lotes de 200 para no exceder el límite de cuerpo de las funciones serverless.
    const batches: SyncPayload[] = [];
    for (let i = 0; i < Math.max(1, payload.upserts.length); i += 200) {
      batches.push({ ...payload, upserts: payload.upserts.slice(i, i + 200), deletes: i === 0 ? payload.deletes : [] });
    }
    for (const body of batches) {
      const res = await fetch(`/api/catalogs/${getState().catalog.id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: JSON.stringify(body).length < 60_000,
      });
      if (res.status === 409) {
        toast({ title: "Ese enlace ya está en uso", body: "Elige otro nombre de enlace en el panel del catálogo.", tone: "error" }, 8000);
        setState({ syncPending: false });
        return;
      }
      if (!res.ok) throw new Error(`sync ${res.status}`);
    }
    synced = { ...sigs };
    catalogSig = cSig;
    attempt = 0;
    void setMeta("syncSigs", { synced, catalogSig });
    // Si algo cambió mientras viajaba el lote, se agenda otra pasada.
    if (buildPayload().changed) schedule();
    else setState({ syncPending: false });
  } catch {
    attempt++;
    timer = setTimeout(flush, backoffDelay(Math.min(attempt, 6)));
  } finally {
    inFlight = false;
  }
}

function schedule(ms = 1200) {
  setState({ syncPending: true });
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, ms);
}

export async function startSync() {
  const saved = await getMeta<{ synced: Record<string, string>; catalogSig: string }>("syncSigs");
  synced = saved?.synced ?? {};
  catalogSig = saved?.catalogSig ?? "";
  let prev = getState();
  useEditor.subscribe((s) => {
    const old = prev;
    prev = s; // antes de schedule(): su setState vuelve a notificar a este mismo listener
    if (s.products !== old.products || s.catalog !== old.catalog || s.images !== old.images) {
      // Los cambios de progreso de subida no importan; sólo la URL final.
      const urlsChanged =
        s.images !== old.images &&
        (Object.keys(s.images).length !== Object.keys(old.images).length ||
          Object.values(s.images).some((i) => old.images[i.id]?.remoteUrl !== i.remoteUrl || old.images[i.id]?.productKey !== i.productKey || old.images[i.id]?.addedAt !== i.addedAt));
      if (s.products !== old.products || s.catalog !== old.catalog || urlsChanged) schedule();
    }
  });
  schedule(300);
  window.addEventListener("pagehide", () => {
    if (timer) {
      clearTimeout(timer);
      void flush();
    }
  });
}
