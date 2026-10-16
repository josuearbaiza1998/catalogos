import { describe, expect, it } from "vitest";
import { CodeIndex, fileStem, normalizeCode, provisionalKey, stripCopySuffix } from "./matching";

describe("normalizeCode", () => {
  it("quita acentos, espacios y separadores", () => {
    expect(normalizeCode(" vmd-802 ")).toBe("VMD802");
    expect(normalizeCode("Blusá_10.4")).toBe("BLUSA104");
    expect(normalizeCode(123)).toBe("123");
  });
});

describe("stripCopySuffix", () => {
  it("quita sufijos de copia y de vista", () => {
    expect(stripCopySuffix("VMD-802 (1)")).toBe("VMD-802");
    expect(stripCopySuffix("VMD-802_2")).toBe("VMD-802");
    expect(stripCopySuffix("VMD-802 copia")).toBe("VMD-802");
    expect(stripCopySuffix("VMD-802-frente")).toBe("VMD-802");
    expect(stripCopySuffix("VMD-802")).toBe("VMD-802");
  });
});

describe("CodeIndex", () => {
  const idx = new CodeIndex(["VMD802", "VMD80", "00123", "BLS104"]);
  it("resuelve exacto y con sufijos", () => {
    expect(idx.resolve(fileStem("vmd-802.JPG"))).toBe("VMD802");
    expect(idx.resolve("VMD-802 (3)")).toBe("VMD802");
    expect(idx.resolve("VMD802frente2")).toBe("VMD802");
  });
  it("tolera ceros a la izquierda perdidos por Excel", () => {
    expect(new CodeIndex(["123"]).resolve("00123")).toBe("123");
    expect(idx.resolve("123")).toBe("00123");
  });
  it("no captura un código más largo con dígitos", () => {
    expect(new CodeIndex(["VMD80"]).resolve("VMD802")).toBeNull();
  });
  it("devuelve null si no hay match", () => {
    expect(idx.resolve("IMG_4021")).toBeNull();
  });
  it("clave provisional estable", () => {
    expect(provisionalKey("VMD-802 (1)")).toBe("VMD802");
  });
});
