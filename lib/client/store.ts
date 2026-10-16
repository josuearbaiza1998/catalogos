"use client";
// Estado del editor. Normalizado (mapas por id/clave) para que actualizar el progreso de
// una foto entre 300 no re-renderice las otras 299: cada tarjeta se suscribe sólo a lo suyo.

import { create } from "zustand";
import type { BackendCapabilities, CatalogMeta, ImageAsset, Product } from "@/lib/shared/domain";

export interface Filters {
  stock: "all" | "in" | "out";
  brand: string | null;
  color: string | null;
  size: string | null;
  query: string;
  data: "all" | "nophoto" | "nodata";
}

export interface Toast {
  id: string;
  title: string;
  body?: string;
  tone?: "info" | "success" | "warning" | "error";
}

export interface EditorState {
  hydrated: boolean;
  catalog: CatalogMeta;
  backend: BackendCapabilities | null;
  online: boolean;
  syncPending: boolean;
  products: Record<string, Product>;
  images: Record<string, ImageAsset>;
  /** id de imagen → object URL (miniatura, o el original mientras se optimiza). */
  previews: Record<string, string>;
  selection: string[];
  filters: Filters;
  panels: { catalog: boolean; inspector: boolean; preview: boolean };
  toasts: Toast[];
  importing: number;
}

export const emptyFilters: Filters = { stock: "all", brand: null, color: null, size: null, query: "", data: "all" };

function newCatalog(): CatalogMeta {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
  const editKey =
    typeof crypto !== "undefined" && "getRandomValues" in crypto
      ? [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, "0")).join("")
      : String(Math.random()).slice(2);
  return {
    id,
    editKey,
    slug: `catalogo-${id.slice(0, 6)}`,
    name: "Nueva colección",
    distributor: "",
    whatsapp: "",
    message: "¡Hola! 👋 Te comparto las prendas disponibles hoy. Escríbeme el código de la que te guste y te paso el precio.",
  };
}

export const useEditor = create<EditorState>()(() => ({
  hydrated: false,
  catalog: newCatalog(),
  backend: null,
  online: true,
  syncPending: false,
  products: {},
  images: {},
  previews: {},
  selection: [],
  filters: emptyFilters,
  panels: { catalog: false, inspector: true, preview: false },
  toasts: [],
  importing: 0,
}));

export const getState = useEditor.getState;
export const setState = useEditor.setState;

export function patchImage(id: string, patch: Partial<ImageAsset>) {
  setState((s) => {
    const cur = s.images[id];
    if (!cur) return s;
    return { images: { ...s.images, [id]: { ...cur, ...patch } } };
  });
}

export function toast(t: Omit<Toast, "id">, ms = 5000) {
  const id = Math.random().toString(36).slice(2);
  setState((s) => ({ toasts: [...s.toasts, { ...t, id }].slice(-4) }));
  if (ms > 0) setTimeout(() => dismissToast(id), ms);
}

export function dismissToast(id: string) {
  setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
}
