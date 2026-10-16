"use client";
// Extrae archivos de un drop, incluidas carpetas completas (arrastrar la carpeta del teléfono).

type Entry = FileSystemEntry & Partial<FileSystemFileEntry & FileSystemDirectoryEntry>;

function readEntry(entry: Entry): Promise<File[]> {
  if (entry.isFile && entry.file) {
    return new Promise((res) => entry.file!((f) => res([f]), () => res([])));
  }
  if (entry.isDirectory && entry.createReader) {
    const reader = entry.createReader();
    return new Promise((res) => {
      const all: Promise<File[]>[] = [];
      const next = () =>
        reader.readEntries(
          (batch) => {
            if (!batch.length) return void Promise.all(all).then((r) => res(r.flat()));
            for (const e of batch) all.push(readEntry(e as Entry));
            next(); // readEntries devuelve lotes de ~100: hay que llamar hasta vaciar
          },
          () => res([]),
        );
      next();
    });
  }
  return Promise.resolve([]);
}

export async function filesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const items = [...dt.items].filter((i) => i.kind === "file");
  const entries = items.map((i) => i.webkitGetAsEntry?.() as Entry | null);
  if (entries.some((e) => e?.isDirectory)) {
    const nested = await Promise.all(entries.map((e, idx) => (e ? readEntry(e) : Promise.resolve([items[idx].getAsFile()!].filter(Boolean)))));
    return nested.flat().filter((f) => !f.name.startsWith("."));
  }
  return [...dt.files];
}

export const hasFiles = (e: DragEvent | React.DragEvent) => [...(e.dataTransfer?.types ?? [])].includes("Files");
