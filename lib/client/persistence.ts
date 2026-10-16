"use client";
// Autoguardado local en IndexedDB. Es lo que permite "no hay botón de Guardar": cada cambio
// y cada foto (con su versión optimizada) quedan en el navegador antes de llegar a la nube,
// así que cerrar la pestaña o perder la señal no pierde trabajo; la cola se reanuda al volver.

import { openDB, type IDBPDatabase } from "idb";
import type { CatalogMeta, ImageAsset, Product } from "@/lib/shared/domain";
import { getState, setState, useEditor, type EditorState } from "./store";

type BlobKind = "orig" | "thumb" | "upload";

let dbPromise: Promise<IDBPDatabase> | null = null;
function db() {
  dbPromise ??= openDB("catalogos", 1, {
    upgrade(d) {
      d.createObjectStore("meta");
      d.createObjectStore("products", { keyPath: "key" });
      d.createObjectStore("images", { keyPath: "id" });
      d.createObjectStore("blobs");
    },
  });
  return dbPromise;
}

const memoryBlobs = new Map<string, Blob>();

export async function putBlob(id: string, kind: BlobKind, blob: Blob) {
  memoryBlobs.set(`${id}:${kind}`, blob);
  try {
    await (await db()).put("blobs", blob, `${id}:${kind}`);
  } catch {
    // Sin cuota o modo privado: seguimos en memoria.
  }
}

export async function getBlob(id: string, kind: BlobKind): Promise<Blob | undefined> {
  const mem = memoryBlobs.get(`${id}:${kind}`);
  if (mem) return mem;
  try {
    return (await (await db()).get("blobs", `${id}:${kind}`)) as Blob | undefined;
  } catch {
    return undefined;
  }
}

export async function deleteBlob(id: string, kind: BlobKind) {
  memoryBlobs.delete(`${id}:${kind}`);
  try {
    await (await db()).delete("blobs", `${id}:${kind}`);
  } catch {}
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  try {
    return (await (await db()).get("meta", key)) as T | undefined;
  } catch {
    return undefined;
  }
}

export async function setMeta(key: string, value: unknown) {
  try {
    await (await db()).put("meta", value, key);
  } catch {}
}

export interface Hydrated {
  catalog?: CatalogMeta;
  products: Product[];
  images: ImageAsset[];
  previews: Record<string, string>;
}

export async function hydrate(): Promise<Hydrated> {
  try {
    const d = await db();
    const [catalog, products, images] = await Promise.all([
      d.get("meta", "catalog") as Promise<CatalogMeta | undefined>,
      d.getAll("products") as Promise<Product[]>,
      d.getAll("images") as Promise<ImageAsset[]>,
    ]);
    const previews: Record<string, string> = {};
    await Promise.all(
      images.map(async (img) => {
        const blob = (await d.get("blobs", `${img.id}:thumb`)) ?? (await d.get("blobs", `${img.id}:orig`));
        if (blob) previews[img.id] = URL.createObjectURL(blob as Blob);
      }),
    );
    return { catalog, products, images, previews };
  } catch {
    return { products: [], images: [], previews: {} };
  }
}

/** Escribe en IndexedDB sólo lo que cambió (comparando referencias del estado inmutable). */
export function startAutosave() {
  let prev: EditorState = getState();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const pendingProducts = new Map<string, Product | null>();
  const pendingImages = new Map<string, ImageAsset | null>();
  let catalogDirty = false;

  const flush = async () => {
    timer = null;
    const products = [...pendingProducts];
    const images = [...pendingImages];
    pendingProducts.clear();
    pendingImages.clear();
    const writeCatalog = catalogDirty;
    catalogDirty = false;
    try {
      const d = await db();
      const tx = d.transaction(["meta", "products", "images"], "readwrite");
      if (writeCatalog) tx.objectStore("meta").put(getState().catalog, "catalog");
      for (const [key, p] of products) {
        if (p) tx.objectStore("products").put(p);
        else tx.objectStore("products").delete(key);
      }
      for (const [id, img] of images) {
        if (img) tx.objectStore("images").put(img);
        else tx.objectStore("images").delete(id);
      }
      await tx.done;
    } catch {}
  };

  const schedule = () => {
    timer ??= setTimeout(flush, 250);
  };

  const unsub = useEditor.subscribe((s) => {
    if (!s.hydrated) {
      prev = s;
      return;
    }
    if (s.catalog !== prev.catalog) catalogDirty = true;
    if (s.products !== prev.products) {
      for (const [k, p] of Object.entries(s.products)) if (prev.products[k] !== p) pendingProducts.set(k, p);
      for (const k of Object.keys(prev.products)) if (!(k in s.products)) pendingProducts.set(k, null);
    }
    if (s.images !== prev.images) {
      for (const [id, img] of Object.entries(s.images)) if (prev.images[id] !== img) pendingImages.set(id, img);
      for (const id of Object.keys(prev.images))
        if (!(id in s.images)) {
          pendingImages.set(id, null);
          for (const k of ["orig", "thumb", "upload"] as const) deleteBlob(id, k);
        }
    }
    prev = s;
    if (catalogDirty || pendingProducts.size || pendingImages.size) schedule();
  });

  const onHide = () => {
    if (document.visibilityState === "hidden" && timer) {
      clearTimeout(timer);
      flush();
    }
  };
  document.addEventListener("visibilitychange", onHide);
  return () => {
    unsub();
    document.removeEventListener("visibilitychange", onHide);
  };
}

export async function clearAll() {
  memoryBlobs.clear();
  try {
    const d = await db();
    const tx = d.transaction(["products", "images", "blobs"], "readwrite");
    await Promise.all([tx.objectStore("products").clear(), tx.objectStore("images").clear(), tx.objectStore("blobs").clear()]);
    await tx.done;
  } catch {}
  setState({ products: {}, images: {}, previews: {}, selection: [] });
}
