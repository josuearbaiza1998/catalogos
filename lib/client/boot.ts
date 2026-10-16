"use client";

import type { BackendCapabilities, ImageAsset } from "@/lib/shared/domain";
import { hydrate, startAutosave } from "./persistence";
import { resumeProcessing } from "./pipeline";
import { getState, setState } from "./store";
import { startSync } from "./sync";
import { enqueue, startUploader } from "./uploader";

let booted = false;

export async function boot() {
  if (booted) return;
  booted = true;

  const [data, backend] = await Promise.all([
    hydrate(),
    fetch("/api/config")
      .then((r) => (r.ok ? (r.json() as Promise<BackendCapabilities>) : null))
      .catch(() => null),
  ]);

  const products = Object.fromEntries(data.products.map((p) => [p.key, p]));
  const images: Record<string, ImageAsset> = Object.fromEntries(data.images.map((i) => [i.id, i]));
  setState({
    catalog: data.catalog ?? getState().catalog,
    products,
    images,
    previews: data.previews,
    backend: backend ?? { uploads: false, db: false },
    hydrated: true,
  });

  startAutosave();
  // El catálogo nuevo se guarda de una vez para conservar su id y su llave de edición.
  if (!data.catalog) setState((s) => ({ catalog: { ...s.catalog } }));
  startUploader();
  if (backend?.db) void startSync();

  // Reanuda el trabajo que quedó "bajo el agua" en la sesión anterior.
  for (const img of data.images) {
    if (img.status === "processing") void resumeProcessing(img.id);
    else if (img.status === "queued" || img.status === "uploading" || (img.status === "local" && backend?.uploads)) enqueue(img.id);
  }
}
