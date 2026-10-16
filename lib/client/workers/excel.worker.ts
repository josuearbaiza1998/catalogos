/// <reference lib="webworker" />
// Lee el Excel/CSV en un Web Worker: la UI sigue fluida aunque el archivo tenga miles de filas.
import { readSheet } from "read-excel-file/web-worker";
import { parseCsv, rowsToProducts, type Cell, type ExcelParseResult } from "@/lib/shared/excel";

export type ExcelWorkerResult = { ok: true; result: ExcelParseResult } | { ok: false; error: string };

self.onmessage = async (e: MessageEvent<{ file: File }>) => {
  const { file } = e.data;
  const post = (msg: ExcelWorkerResult) => (self as unknown as Worker).postMessage(msg);
  try {
    let matrix: Cell[][];
    if (/\.(csv|tsv|txt)$/i.test(file.name) || file.type === "text/csv") {
      matrix = parseCsv(await file.text());
    } else if (/\.xls$/i.test(file.name)) {
      throw new Error("El formato .xls (Excel 97) no es compatible. Guárdalo como .xlsx o .csv.");
    } else {
      matrix = (await readSheet(file)) as unknown as Cell[][];
    }
    post({ ok: true, result: rowsToProducts(matrix) });
  } catch (err) {
    post({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
