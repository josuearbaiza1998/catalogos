import { describe, expect, it } from "vitest";
import { parseBool, parseCsv, parseList, rowsToProducts } from "./excel";

describe("rowsToProducts", () => {
  it("detecta cabeceras con sinónimos y filas de título encima", () => {
    const res = rowsToProducts([
      ["Inventario octubre"],
      [],
      ["Marca", "Código", "Colores", "Tallas", "Existencia", "Material"],
      ["Zara", "VMD-802", "Blanco, beige", "s/m/l", "Sí", "Lino"],
      ["Mango", 123, "Rosa", "unitalla", "no", ""],
      ["", "", "", "", "", ""],
      ["Sin código", "", "", "", "", ""],
    ]);
    expect(res.headerRow).toBe(2);
    expect(res.skipped).toBe(1);
    expect(res.rows).toHaveLength(2);
    expect(res.rows[0]).toMatchObject({
      key: "VMD802",
      brand: "Zara",
      colors: ["Blanco", "Beige"],
      sizes: ["S", "M", "L"],
      existencia: true,
      attrs: { Material: "Lino" },
    });
    expect(res.rows[1]).toMatchObject({ key: "123", existencia: false, sizes: ["UNITALLA"] });
  });

  it("marca duplicados y conserva la última fila", () => {
    const res = rowsToProducts([
      ["sku", "stock"],
      ["A-1", "si"],
      ["a1", "no"],
    ]);
    expect(res.duplicates).toEqual(["a1"]);
    expect(res.rows[0].existencia).toBe(false);
  });

  it("sin columna de existencia deja el campo indefinido", () => {
    const res = rowsToProducts([["codigo", "marca"], ["X10", "Nike"]]);
    expect(res.rows[0].existencia).toBeUndefined();
  });
});

describe("helpers", () => {
  it("parseBool", () => {
    expect(parseBool("SÍ")).toBe(true);
    expect(parseBool("Agotado")).toBe(false);
    expect(parseBool(0)).toBe(false);
    expect(parseBool(5)).toBe(true);
    expect(parseBool("")).toBeNull();
    expect(parseBool("✓")).toBe(true);
  });
  it("parseList", () => {
    expect(parseList("Azul; azul ; Verde oliva")).toEqual(["Azul", "Verde oliva"]);
  });
  it("parseCsv con punto y coma y comillas", () => {
    expect(parseCsv('codigo;colores\r\nA1;"rojo; azul"\r\n')).toEqual([
      ["codigo", "colores"],
      ["A1", "rojo; azul"],
    ]);
  });
});
