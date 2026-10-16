"use client";
// Cola de subida silenciosa. Vive fuera de React: el lienzo nunca espera por ella.
//
//  - URL prefirmada por archivo (PUT directo al bucket; el servidor no toca los bytes).
//  - Concurrencia limitada (3) para no ahogar el 4G de la vendedora.
//  - Reintentos automáticos con backoff exponencial + jitter; pausa si no hay red y se
//    reanuda sola con el evento `online`.
//  - Deduplicación por SHA-256: si la misma foto ya está en el bucket, no se vuelve a subir.
//  - Todo el estado está en IndexedDB: cerrar la pestaña no pierde nada, se reanuda al volver.

import { deleteBlob, getBlob } from "./persistence";
import { getState, patchImage, setState } from "./store";

const CONCURRENCY = 3;
const MAX_ATTEMPTS = 8;
const BASE_DELAY = 1000;
const MAX_DELAY = 30_000;

const queue: string[] = [];
const active = new Set<string>();
const waiting = new Map<string, ReturnType<typeof setTimeout>>();
let started = false;

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function backoffDelay(attempt: number, random = Math.random) {
  const exp = Math.min(MAX_DELAY, BASE_DELAY * 2 ** Math.max(0, attempt - 1));
  return Math.round(exp / 2 + random() * (exp / 2)); // "equal jitter"
}

const retryable = (err: unknown) =>
  !(err instanceof HttpError) || err.status >= 500 || err.status === 408 || err.status === 429 || err.status === 403;

export function pendingUploads(): number {
  return Object.values(getState().images).filter((i) => i.status === "queued" || i.status === "uploading" || i.status === "processing").length;
}

export function enqueue(id: string) {
  if (!getState().backend?.uploads) {
    patchImage(id, { status: "local" });
    return;
  }
  if (queue.includes(id) || active.has(id) || waiting.has(id)) return;
  patchImage(id, { status: "queued", error: undefined });
  queue.push(id);
  pump();
}

export function retryFailed() {
  for (const img of Object.values(getState().images)) {
    if (img.status === "error" || img.status === "local") {
      patchImage(img.id, { attempts: 0 });
      enqueue(img.id);
    }
  }
}

function pump() {
  if (!navigator.onLine) return;
  while (active.size < CONCURRENCY && queue.length) {
    const id = queue.shift()!;
    active.add(id);
    void run(id).finally(() => {
      active.delete(id);
      pump();
    });
  }
}

function putWithProgress(url: string, blob: Blob, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", blob.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new HttpError(xhr.status, `PUT ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("network"));
    xhr.ontimeout = () => reject(new Error("timeout"));
    xhr.timeout = 120_000;
    xhr.send(blob);
  });
}

async function run(id: string) {
  const img = getState().images[id];
  if (!img) return;
  const blob = await getBlob(id, "upload");
  if (!blob) {
    patchImage(id, { status: "error", error: "El archivo ya no está disponible en este navegador." });
    return;
  }
  const { catalog } = getState();
  patchImage(id, { status: "uploading", progress: 0 });
  try {
    const res = await fetch("/api/uploads/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        catalogId: catalog.id,
        editKey: catalog.editKey,
        sha256: img.sha256,
        contentType: blob.type || "application/octet-stream",
        size: blob.size,
        fileName: img.fileName,
      }),
    });
    if (res.status === 503) {
      // El backend dejó de estar configurado: la foto sigue en modo local.
      patchImage(id, { status: "local", progress: 0 });
      return;
    }
    if (!res.ok) throw new HttpError(res.status, (await res.text()) || `presign ${res.status}`);
    const { uploadUrl, storageKey, publicUrl, exists } = (await res.json()) as {
      uploadUrl: string;
      storageKey: string;
      publicUrl: string;
      exists: boolean;
    };
    if (!exists) {
      let last = 0;
      await putWithProgress(uploadUrl, blob, (p) => {
        if (p - last > 0.1 || p === 1) {
          last = p;
          patchImage(id, { progress: p });
        }
      });
    }
    patchImage(id, { status: "uploaded", progress: 1, remoteUrl: publicUrl, storageKey, error: undefined });
    void deleteBlob(id, "upload"); // ya está en la nube; liberamos espacio local
  } catch (err) {
    const attempts = (getState().images[id]?.attempts ?? 0) + 1;
    const message = err instanceof Error ? err.message : String(err);
    if (!retryable(err) || attempts >= MAX_ATTEMPTS) {
      patchImage(id, { status: "error", attempts, error: message });
      return;
    }
    patchImage(id, { status: "queued", attempts, error: message, progress: 0 });
    const t = setTimeout(() => {
      waiting.delete(id);
      queue.push(id);
      pump();
    }, backoffDelay(attempts));
    waiting.set(id, t);
  }
}

export function startUploader() {
  if (started) return;
  started = true;
  const onOnline = () => {
    setState({ online: true });
    // Al volver la red, se reintenta todo lo que esperaba o falló, sin esperar el backoff.
    for (const [id, t] of waiting) {
      clearTimeout(t);
      waiting.delete(id);
      queue.push(id);
    }
    retryFailed();
    pump();
  };
  const onOffline = () => setState({ online: false });
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  setState({ online: navigator.onLine });

  // Si hay trabajo pendiente "bajo el agua", el navegador muestra su diálogo de confirmación.
  // Aunque la persona cierre igual, nada se pierde: queda en IndexedDB y se reanuda al volver.
  window.addEventListener("beforeunload", (e) => {
    if (pendingUploads() > 0 || getState().syncPending) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
}
