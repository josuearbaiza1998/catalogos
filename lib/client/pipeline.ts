"use client";
// Pool de Web Workers que optimiza las fotos en paralelo sin bloquear la UI.

import type { ImageJob, ImageResult } from "./workers/image.worker";
import { deleteBlob, getBlob, putBlob } from "./persistence";
import { getState, patchImage, setState } from "./store";
import { enqueue } from "./uploader";

let workers: Worker[] = [];
const idle: Worker[] = [];
const jobs: ImageJob[] = [];

function ensurePool() {
  if (workers.length) return;
  const size = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
  workers = Array.from({ length: size }, () => {
    const w = new Worker(new URL("./workers/image.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<ImageResult>) => {
      void onResult(e.data);
      idle.push(w);
      drain();
    };
    return w;
  });
  idle.push(...workers);
}

function drain() {
  while (idle.length && jobs.length) idle.pop()!.postMessage(jobs.shift()!);
}

export function process(id: string, file: Blob) {
  ensurePool();
  jobs.push({ id, file });
  drain();
}

/** Reprocesa lo que quedó a medias si la pestaña se cerró durante la optimización. */
export async function resumeProcessing(id: string) {
  const orig = await getBlob(id, "orig");
  if (orig) process(id, orig);
  else patchImage(id, { status: "error", error: "Se perdió el archivo original antes de optimizarse." });
}

async function onResult(r: ImageResult) {
  const img = getState().images[r.id];
  if (!img) return;
  await putBlob(r.id, "upload", r.upload);
  if (r.thumb) {
    await putBlob(r.id, "thumb", r.thumb);
    const url = URL.createObjectURL(r.thumb);
    setState((s) => {
      const old = s.previews[r.id];
      if (old) URL.revokeObjectURL(old); // soltamos el original pesado en cuanto hay miniatura
      return { previews: { ...s.previews, [r.id]: url } };
    });
  }
  void deleteBlob(r.id, "orig");
  patchImage(r.id, {
    width: r.width,
    height: r.height,
    optimizedBytes: r.upload.size,
    mime: r.mime,
    sha256: r.sha256,
    undecodable: !r.ok,
    status: "queued",
  });
  enqueue(r.id);
}
