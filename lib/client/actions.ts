"use client";

import type { ExcelParseResult } from "@/lib/shared/excel";
import type { ImageAsset, Product } from "@/lib/shared/domain";
import { CodeIndex, fileStem, normalizeCode, provisionalKey } from "@/lib/shared/matching";
import type { ExcelWorkerResult } from "./workers/excel.worker";
import { clearAll, putBlob } from "./persistence";
import { process } from "./pipeline";
import { getState, setState, toast, type Filters } from "./store";

const IMAGE_RE = /\.(jpe?g|png|webp|gif|avif|heic|heif|bmp)$/i;
const SHEET_RE = /\.(xlsx|xlsm|xls|csv|tsv)$/i;

export const isImageFile = (f: File) => f.type.startsWith("image/") || IMAGE_RE.test(f.name);
export const isSheetFile = (f: File) => SHEET_RE.test(f.name) || /spreadsheet|excel|csv/.test(f.type);

function emptyProduct(key: string, code: string, position: number, source: Product["source"]): Product {
  return { key, code, brand: "", colors: [], sizes: [], existencia: true, attrs: {}, source, position, updatedAt: Date.now() };
}

function knownCodes(products: Record<string, Product>) {
  return new CodeIndex(Object.values(products).filter((p) => p.source !== "image").map((p) => p.key));
}

/** Punto de entrada de todo lo que se suelta en el lienzo. */
export function addFiles(files: File[]) {
  const images = files.filter(isImageFile);
  const sheets = files.filter((f) => !isImageFile(f) && isSheetFile(f));
  if (images.length) addImages(images);
  for (const sheet of sheets) void importSheet(sheet);
  const ignored = files.length - images.length - sheets.length;
  if (ignored > 0) toast({ title: `${ignored} archivo(s) ignorado(s)`, body: "Sólo se aceptan fotos y hojas Excel/CSV.", tone: "warning" });
}

/** `targetKey`: soltar fotos sobre una tarjeta las asigna a esa prenda, sin importar el nombre del archivo. */
export function addImages(files: File[], targetKey?: string) {
  const s = getState();
  const index = knownCodes(s.products);
  const products = { ...s.products };
  const images = { ...s.images };
  const previews = { ...s.previews };
  let position = Object.values(products).reduce((m, p) => Math.max(m, p.position), -1) + 1;
  const now = Date.now();
  const fresh: [string, File][] = [];

  files.forEach((file, i) => {
    const id = crypto.randomUUID();
    fresh.push([id, file]);
    const stem = fileStem(file.name);
    const key = targetKey && products[targetKey] ? targetKey : (index.resolve(stem) ?? provisionalKey(stem));
    if (!products[key]) products[key] = emptyProduct(key, stem.replace(/\s*\(\d+\)$/, "").trim() || key, position++, "image");
    const asset: ImageAsset = {
      id,
      fileName: file.name,
      stem,
      productKey: key,
      originalBytes: file.size,
      status: "processing",
      progress: 0,
      attempts: 0,
      addedAt: now + i,
      pinned: !!(targetKey && products[targetKey]),
    };
    images[id] = asset;
    // Render inmediato con el archivo local; la miniatura optimizada lo reemplaza en segundos.
    previews[id] = URL.createObjectURL(file);
  });

  setState({ products, images, previews });
  // Guardamos el original antes de procesar para poder reanudar si se cierra la pestaña.
  for (const [id, file] of fresh) void putBlob(id, "orig", file).then(() => process(id, file));
  toast({ title: `${files.length} foto${files.length === 1 ? "" : "s"} en el lienzo`, body: "Se optimizan y suben en segundo plano. Puedes seguir trabajando.", tone: "info" }, 3500);
}

let excelWorker: Worker | null = null;

export function importSheet(file: File): Promise<void> {
  excelWorker ??= new Worker(new URL("./workers/excel.worker.ts", import.meta.url), { type: "module" });
  const worker = excelWorker;
  setState((s) => ({ importing: s.importing + 1 }));
  return new Promise((resolve) => {
    const onMessage = (e: MessageEvent<ExcelWorkerResult>) => {
      worker.removeEventListener("message", onMessage);
      setState((s) => ({ importing: s.importing - 1 }));
      if (e.data.ok) applyExcel(e.data.result, file.name);
      else toast({ title: "No pude leer el Excel", body: e.data.error, tone: "error" }, 8000);
      resolve();
    };
    worker.addEventListener("message", onMessage);
    worker.postMessage({ file });
  });
}

/**
 * Fusiona las filas del Excel con lo que ya hay en el lienzo y vuelve a emparejar TODAS las
 * fotos contra los códigos conocidos. Como la unión es por código, funciona igual para fotos
 * ya subidas, subiéndose o que se suelten después.
 */
export function applyExcel(result: ExcelParseResult, fileName = "Excel") {
  const s = getState();
  const products: Record<string, Product> = { ...s.products };
  let position = Object.values(products).reduce((m, p) => Math.max(m, p.position), -1) + 1;
  const now = Date.now();

  for (const row of result.rows) {
    const cur = products[row.key] ?? emptyProduct(row.key, row.code, position++, "excel");
    products[row.key] = {
      ...cur,
      code: row.code || cur.code,
      brand: row.brand || cur.brand,
      colors: row.colors?.length ? row.colors : cur.colors,
      sizes: row.sizes?.length ? row.sizes : cur.sizes,
      existencia: row.existencia ?? cur.existencia,
      attrs: { ...cur.attrs, ...row.attrs },
      source: cur.source === "manual" ? "manual" : "excel",
      updatedAt: now,
    };
  }

  const index = knownCodes(products);
  const images = { ...s.images };
  let moved = 0;
  for (const img of Object.values(images)) {
    if (img.pinned) continue;
    const target = index.resolve(img.stem);
    if (target && target !== img.productKey) {
      // La tarjeta provisional cede su posición a la del Excel si ésta es nueva.
      const from = products[img.productKey];
      if (from?.source === "image" && products[target].position > from.position) {
        products[target] = { ...products[target], position: from.position };
      }
      images[img.id] = { ...img, productKey: target };
      moved++;
    }
  }

  // Tarjetas provisionales que quedaron sin fotos (su foto encontró su fila) desaparecen.
  const withImages = new Set(Object.values(images).map((i) => i.productKey));
  for (const p of Object.values(products)) {
    if (p.source === "image" && !withImages.has(p.key) && !p.brand && !p.colors.length && !p.sizes.length) delete products[p.key];
  }

  setState({ products, images });

  const rowKeys = new Set(result.rows.map((r) => r.key));
  const matched = [...rowKeys].filter((k) => withImages.has(k)).length;
  const orphanPhotos = Object.values(products).filter((p) => p.source === "image").length;
  const parts = [`${matched} con foto`, `${rowKeys.size - matched} sin foto`];
  if (orphanPhotos) parts.push(`${orphanPhotos} foto(s) sin fila`);
  if (result.duplicates.length) parts.push(`${result.duplicates.length} código(s) repetido(s)`);
  toast(
    {
      title: `${fileName}: ${result.rows.length} prendas`,
      body: parts.join(" · ") + (moved ? `. ${moved} foto(s) emparejadas.` : "."),
      tone: rowKeys.size - matched > 0 || orphanPhotos ? "warning" : "success",
    },
    9000,
  );
}

export function updateProduct(key: string, patch: Partial<Omit<Product, "key">>) {
  setState((s) => {
    const cur = s.products[key];
    if (!cur) return s;
    const source = cur.source === "image" ? "manual" : cur.source;
    return { products: { ...s.products, [key]: { ...cur, ...patch, source, updatedAt: Date.now() } } };
  });
}

/** Cambiar el código desde el inspector re-indexa la tarjeta y arrastra sus fotos. */
export function renameProduct(key: string, newCode: string) {
  const newKey = normalizeCode(newCode);
  const s = getState();
  const cur = s.products[key];
  if (!cur || !newKey) return;
  if (newKey === key) return updateProduct(key, { code: newCode });
  const products = { ...s.products };
  delete products[key];
  const existing = products[newKey];
  products[newKey] = existing
    ? { ...existing, updatedAt: Date.now() }
    : { ...cur, key: newKey, code: newCode, source: "manual", updatedAt: Date.now() };
  const images = { ...s.images };
  for (const img of Object.values(images)) if (img.productKey === key) images[img.id] = { ...img, productKey: newKey };
  setState({ products, images, selection: s.selection.map((k) => (k === key ? newKey : k)) });
  if (existing) toast({ title: `Fusionado con ${existing.code}`, body: "Ese código ya existía; las fotos se movieron a esa prenda.", tone: "info" });
}

export function setExistencia(keys: string[], value: boolean) {
  setState((s) => {
    const products = { ...s.products };
    const now = Date.now();
    for (const k of keys) if (products[k] && products[k].existencia !== value) products[k] = { ...products[k], existencia: value, updatedAt: now };
    return { products };
  });
}

export function removeProducts(keys: string[]) {
  setState((s) => {
    const products = { ...s.products };
    const images = { ...s.images };
    const previews = { ...s.previews };
    const set = new Set(keys);
    for (const k of keys) delete products[k];
    for (const img of Object.values(s.images)) {
      if (!set.has(img.productKey)) continue;
      delete images[img.id];
      if (previews[img.id]) URL.revokeObjectURL(previews[img.id]);
      delete previews[img.id];
    }
    return { products, images, previews, selection: s.selection.filter((k) => !set.has(k)) };
  });
}

export function removeImage(id: string) {
  setState((s) => {
    const images = { ...s.images };
    const previews = { ...s.previews };
    delete images[id];
    if (previews[id]) URL.revokeObjectURL(previews[id]);
    delete previews[id];
    return { images, previews };
  });
}

export function makeCover(id: string) {
  setState((s) => {
    const img = s.images[id];
    if (!img) return s;
    const first = Math.min(...Object.values(s.images).filter((i) => i.productKey === img.productKey).map((i) => i.addedAt));
    return { images: { ...s.images, [id]: { ...img, addedAt: first - 1 } } };
  });
}

export function select(key: string | null, additive = false) {
  setState((s) => {
    if (!key) return { selection: [] };
    if (!additive) return { selection: [key], panels: { ...s.panels, inspector: true } };
    const has = s.selection.includes(key);
    return { selection: has ? s.selection.filter((k) => k !== key) : [...s.selection, key], panels: { ...s.panels, inspector: true } };
  });
}

export function setFilters(patch: Partial<Filters>) {
  setState((s) => ({ filters: { ...s.filters, ...patch } }));
}

export function togglePanel(name: "catalog" | "inspector" | "preview", value?: boolean) {
  setState((s) => ({ panels: { ...s.panels, [name]: value ?? !s.panels[name] } }));
}

export function updateCatalog(patch: Partial<ReturnType<typeof getState>["catalog"]>) {
  setState((s) => ({ catalog: { ...s.catalog, ...patch } }));
}

export async function clearCanvas() {
  for (const url of Object.values(getState().previews)) URL.revokeObjectURL(url);
  await clearAll();
}
