// Convierte la matriz cruda de una hoja (filas × celdas) en filas de producto.
// Es código puro: corre dentro del Web Worker y también en los tests.

import { normalizeCode } from "./matching";

export type Cell = string | number | boolean | Date | null | undefined;

export interface ExcelProductRow {
  key: string;
  code: string;
  brand?: string;
  colors?: string[];
  sizes?: string[];
  existencia?: boolean;
  attrs: Record<string, string>;
}

export interface ExcelParseResult {
  rows: ExcelProductRow[];
  headerRow: number;
  mapping: Partial<Record<Field, string>>;
  duplicates: string[];
  skipped: number;
}

type Field = "code" | "brand" | "colors" | "sizes" | "existencia";

const plain = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

const SYNONYMS: Record<Field, string[]> = {
  code: ["codigo", "cod", "id", "sku", "ref", "referencia", "modelo", "estilo", "articulo", "code", "item", "codigoid", "idprenda", "codigoprenda"],
  brand: ["marca", "brand", "fabricante", "proveedor", "linea"],
  colors: ["colores", "color", "colors", "tonos", "tono"],
  sizes: ["tallas", "talla", "sizes", "size", "medidas", "tallaje", "numeros"],
  existencia: ["existencia", "existencias", "stock", "disponible", "disponibilidad", "enexistencia", "activo", "visible", "hay"],
};

function fieldFor(header: string): Field | null {
  const h = plain(header);
  if (!h) return null;
  for (const [field, list] of Object.entries(SYNONYMS) as [Field, string[]][]) {
    if (list.includes(h)) return field;
  }
  for (const [field, list] of Object.entries(SYNONYMS) as [Field, string[]][]) {
    if (list.some((syn) => syn.length >= 4 && h.startsWith(syn))) return field;
  }
  return null;
}

const TRUE_WORDS = new Set(["si", "s", "yes", "y", "true", "verdadero", "1", "x", "disponible", "hay", "existencia", "enexistencia", "activo", "ok", "v"]);
const FALSE_WORDS = new Set(["no", "n", "false", "falso", "0", "agotado", "agotada", "sinexistencia", "inactivo", "nohay", "oculto"]);

/** null = la celda está vacía o no se entiende; quien llama decide el valor por defecto. */
export function parseBool(value: Cell): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  const s = plain(String(value ?? "").replace("✓", "si").replace("✔", "si").replace("✗", "no"));
  if (!s) return null;
  if (TRUE_WORDS.has(s)) return true;
  if (FALSE_WORDS.has(s)) return false;
  const n = Number(s);
  if (!Number.isNaN(n)) return n > 0;
  return null;
}

export function parseList(value: Cell, upper = false): string[] {
  const s = cellText(value);
  if (!s) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of s.split(/[,;|/\n]+|\s+-\s+|\s+y\s+/i)) {
    const t = part.trim();
    if (!t) continue;
    const pretty = upper ? t.toUpperCase() : t[0].toUpperCase() + t.slice(1);
    const k = pretty.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(pretty);
    }
  }
  return out;
}

export function cellText(value: Cell): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(value);
  return String(value).trim();
}

/** Busca, entre las primeras filas, la que más se parece a una cabecera. */
function detectHeader(matrix: Cell[][]): number {
  let best = -1;
  let bestScore = 0;
  for (let r = 0; r < Math.min(matrix.length, 15); r++) {
    const fields = new Set(matrix[r].map((c) => fieldFor(cellText(c))).filter(Boolean));
    const score = fields.size + (fields.has("code") ? 2 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return bestScore >= 2 ? best : -1;
}

export function rowsToProducts(matrix: Cell[][]): ExcelParseResult {
  const headerRow = detectHeader(matrix);
  const mapping: Partial<Record<Field, string>> = {};
  const colField: (Field | null)[] = [];
  const extraCols: { idx: number; name: string }[] = [];

  if (headerRow >= 0) {
    matrix[headerRow].forEach((c, idx) => {
      const name = cellText(c);
      const f = fieldFor(name);
      if (f && !(f in mapping)) {
        mapping[f] = name;
        colField[idx] = f;
      } else if (name) {
        extraCols.push({ idx, name });
      }
    });
  } else {
    // Sin cabecera reconocible: se asume el orden del enunciado.
    (["brand", "code", "colors", "sizes", "existencia"] as Field[]).forEach((f, i) => {
      colField[i] = f;
      mapping[f] = `Columna ${i + 1}`;
    });
  }
  if (!("code" in mapping)) {
    colField[0] = "code";
    mapping.code = "Columna 1";
  }

  const byKey = new Map<string, ExcelProductRow>();
  const duplicates: string[] = [];
  let skipped = 0;

  for (let r = headerRow + 1; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    if (row.every((c) => cellText(c) === "")) continue;
    const get = (f: Field) => row[colField.indexOf(f)];
    const code = cellText(get("code"));
    const key = normalizeCode(code);
    if (!key) {
      skipped++;
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const { idx, name } of extraCols) {
      const v = cellText(row[idx]);
      if (v) attrs[name] = v;
    }
    const parsed: ExcelProductRow = { key, code, attrs };
    if ("brand" in mapping) parsed.brand = cellText(get("brand"));
    if ("colors" in mapping) parsed.colors = parseList(get("colors"));
    if ("sizes" in mapping) parsed.sizes = parseList(get("sizes"), true);
    if ("existencia" in mapping) {
      const b = parseBool(get("existencia"));
      if (b !== null) parsed.existencia = b;
    }
    if (byKey.has(key)) duplicates.push(code);
    byKey.set(key, parsed); // la última fila gana, como al leer el Excel de arriba abajo
  }

  return { rows: [...byKey.values()], headerRow, mapping, duplicates, skipped };
}

/** CSV/TSV mínimo (RFC 4180) con detección de separador. */
export function parseCsv(text: string): Cell[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length] as const);
  const delim = counts.sort((a, b) => b[1] - a[1])[0][0];
  const rows: Cell[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
