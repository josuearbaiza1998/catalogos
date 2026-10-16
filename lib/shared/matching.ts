// Matching entre nombres de archivo de imagen y códigos del Excel.
//
// La unión es por CÓDIGO, nunca por URL: la imagen guarda la clave del producto y la URL
// remota se rellena cuando la subida termina. Por eso da igual si la foto ya se subió,
// se está subiendo o llega después que el Excel.

/** Normaliza un código: sin acentos, mayúsculas, sólo [A-Z0-9]. "vmd-802 " → "VMD802". */
export function normalizeCode(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|heic|heif|bmp|tiff?)$/i;

export function fileStem(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  return base.replace(IMAGE_EXT, "").replace(/\.[a-z0-9]{2,5}$/i, "");
}

/**
 * Quita los sufijos que agregan los teléfonos y el sistema operativo al duplicar o
 * exportar fotos: "VMD-802 (1)", "VMD-802_2", "VMD-802 copia", "VMD-802-frente".
 * No toca "-NNN" porque suele ser parte del código ("VMD-802").
 */
export function stripCopySuffix(stem: string): string {
  let s = stem.trim();
  for (let i = 0; i < 3; i++) {
    const next = s
      .replace(/\s*\(\d+\)$/, "")
      .replace(/[\s_]+(copia|copy|copie)(\s*\d+)?$/i, "")
      .replace(/[\s_-]+(frente|espalda|detalle|lado|front|back|detail|side)(\s*\d+)?$/i, "")
      .replace(/_\d{1,2}$/, "")
      .replace(/\s+\d{1,2}$/, "")
      .trim();
    if (next === s) break;
    s = next;
  }
  return s;
}

/** Clave provisional para una foto que aún no tiene fila de Excel. */
export function provisionalKey(stem: string): string {
  return normalizeCode(stripCopySuffix(stem)) || normalizeCode(stem) || "SINCODIGO";
}

const stripZeros = (k: string) => k.replace(/^0+(?=\d)/, "");

/**
 * Índice de códigos conocidos para resolver una foto contra ellos.
 * Orden de prueba: exacto → exacto sin sufijo de copia → sin ceros a la izquierda
 * (Excel convierte "00123" en 123) → prefijo más largo con frontera.
 */
export class CodeIndex {
  private exact = new Set<string>();
  private noZeros = new Map<string, string>();
  private byLength: string[] = [];

  constructor(keys: Iterable<string>) {
    for (const k of keys) {
      if (!k) continue;
      this.exact.add(k);
      this.noZeros.set(stripZeros(k), k);
    }
    this.byLength = [...this.exact].sort((a, b) => b.length - a.length);
  }

  resolve(stem: string): string | null {
    const full = normalizeCode(stem);
    const clean = normalizeCode(stripCopySuffix(stem));
    for (const c of [full, clean]) {
      if (c && this.exact.has(c)) return c;
    }
    for (const c of [full, clean]) {
      const hit = c && this.noZeros.get(stripZeros(c));
      if (hit) return hit;
    }
    // Prefijo más largo: "VMD802FRENTE2" → "VMD802". Si el código termina en dígito,
    // el resto no puede empezar con dígito ("VMD80" no debe capturar "VMD802").
    for (const k of this.byLength) {
      if (k.length < 3 || !full.startsWith(k) || full.length === k.length) continue;
      const next = full[k.length];
      if (/\d/.test(k[k.length - 1]) && /\d/.test(next)) continue;
      return k;
    }
    return null;
  }
}
