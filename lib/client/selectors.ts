import type { ImageAsset, Product } from "@/lib/shared/domain";
import type { Filters } from "./store";

export function groupImages(images: Record<string, ImageAsset>): Map<string, ImageAsset[]> {
  const map = new Map<string, ImageAsset[]>();
  for (const img of Object.values(images)) {
    const list = map.get(img.productKey);
    if (list) list.push(img);
    else map.set(img.productKey, [img]);
  }
  for (const list of map.values()) list.sort((a, b) => a.addedAt - b.addedAt);
  return map;
}

export const hasData = (p: Product) => p.source !== "image" || !!p.brand || p.colors.length > 0 || p.sizes.length > 0;

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function applyFilters(products: Product[], byProduct: Map<string, ImageAsset[]>, f: Filters): Product[] {
  const q = plain(f.query.trim());
  return products.filter((p) => {
    if (f.stock === "in" && !p.existencia) return false;
    if (f.stock === "out" && p.existencia) return false;
    if (f.brand && p.brand !== f.brand) return false;
    if (f.color && !p.colors.some((c) => plain(c) === plain(f.color!))) return false;
    if (f.size && !p.sizes.includes(f.size)) return false;
    if (f.data === "nophoto" && (byProduct.get(p.key)?.length ?? 0) > 0) return false;
    if (f.data === "nodata" && hasData(p)) return false;
    if (q && !plain(`${p.code} ${p.brand} ${p.colors.join(" ")}`).includes(q)) return false;
    return true;
  });
}

export function sortedProducts(products: Record<string, Product>): Product[] {
  return Object.values(products).sort((a, b) => a.position - b.position);
}

export interface Facets {
  brands: string[];
  colors: string[];
  sizes: string[];
}

const SIZE_ORDER = ["XXS", "XS", "CH", "S", "M", "MD", "G", "L", "XG", "XL", "XXL", "2XL", "XXXL", "3XL", "UNITALLA"];

export function facets(products: Product[]): Facets {
  const brands = new Set<string>();
  const colors = new Map<string, string>();
  const sizes = new Set<string>();
  for (const p of products) {
    if (p.brand) brands.add(p.brand);
    for (const c of p.colors) colors.set(plain(c), colors.get(plain(c)) ?? c);
    for (const s of p.sizes) sizes.add(s);
  }
  const sizeRank = (s: string) => {
    const i = SIZE_ORDER.indexOf(s);
    if (i >= 0) return i;
    const n = Number(s);
    return Number.isNaN(n) ? 1000 : 100 + n;
  };
  return {
    brands: [...brands].sort((a, b) => a.localeCompare(b, "es")),
    colors: [...colors.values()].sort((a, b) => a.localeCompare(b, "es")),
    sizes: [...sizes].sort((a, b) => sizeRank(a) - sizeRank(b) || a.localeCompare(b)),
  };
}

/** Color aproximado para pintar el punto de muestra a partir del nombre en español. */
const COLOR_HEX: Record<string, string> = {
  negro: "#0B0F19", blanco: "#FFFFFF", gris: "#94A3B8", azul: "#2563EB", marino: "#1E3A8A", celeste: "#7DD3FC",
  denim: "#3B5B8C", rojo: "#DC2626", vino: "#7F1D1D", rosa: "#F472B6", fucsia: "#DB2777", morado: "#7C3AED",
  lila: "#C4B5FD", verde: "#16A34A", oliva: "#65752F", menta: "#86EFAC", amarillo: "#FACC15", mostaza: "#CA8A04",
  naranja: "#F97316", coral: "#FB7185", beige: "#E7D7C1", crema: "#F5EEDC", camel: "#C19A6B", cafe: "#7C4A2D",
  marron: "#7C4A2D", chocolate: "#5B3A29", dorado: "#D4AF37", plateado: "#CBD5E1", nude: "#E8C4A8", hueso: "#EFE9DD",
};

export function colorHex(name: string): string | null {
  const p = plain(name);
  for (const word of p.split(/\s+/).reverse()) if (COLOR_HEX[word]) return COLOR_HEX[word];
  for (const [k, v] of Object.entries(COLOR_HEX)) if (p.includes(k)) return v;
  return null;
}
