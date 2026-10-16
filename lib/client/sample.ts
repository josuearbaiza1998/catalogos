"use client";
// Datos de ejemplo para probar el flujo completo sin tener fotos a mano:
// genera fotos sintéticas (archivos reales, con nombre = código) y un "Excel" en memoria.

import { rowsToProducts, type Cell } from "@/lib/shared/excel";
import { addImages, applyExcel } from "./actions";

const SAMPLE: Cell[][] = [
  ["Marca", "Código", "Colores", "Tallas", "Existencia"],
  ["Zara", "VMD-802", "Blanco, Beige", "S, M, L", "Sí"],
  ["Studio F", "BLS-104", "Azul, Blanco", "S, M", "Sí"],
  ["Bershka", "PNT-339", "Negro", "28, 30, 32", "No"],
  ["Mango", "VMD-912", "Rosa, Fucsia", "Unitalla", "Sí"],
  ["Studio F", "CHQ-501", "Negro, Camel", "M, L, XL", "Sí"],
  ["Zara", "TOP-120", "Blanco, Negro", "S, M", "Sí"],
  ["Oysho", "JMP-440", "Verde oliva, Beige", "S, M, L", "No"],
  ["Bershka", "FAL-219", "Azul denim", "26, 28, 30", "Sí"],
  ["Mango", "SAC-077", "Camel", "M, L", "Sí"],
  ["Zara", "VST-310", "Rojo, Negro", "XS, S, M", "Sí"],
  ["Oysho", "LEG-018", "Gris, Negro", "S, M, L, XL", "Sí"],
  ["Studio F", "CAM-655", "Celeste", "S, M, L", "No"],
];

const PALETTE: [string, string][] = [
  ["#F1F5F9", "#E7D7C1"], ["#DBEAFE", "#2563EB"], ["#E2E8F0", "#0B0F19"], ["#FCE7F3", "#DB2777"],
  ["#F5EEDC", "#C19A6B"], ["#F8FAFC", "#334155"], ["#ECFCCB", "#65752F"], ["#E0E7FF", "#3B5B8C"],
  ["#FEF3C7", "#C19A6B"], ["#FEE2E2", "#DC2626"], ["#F1F5F9", "#64748B"], ["#E0F2FE", "#7DD3FC"],
];

function drawGarment(ctx: CanvasRenderingContext2D, w: number, h: number, i: number) {
  const [bg, fg] = PALETTE[i % PALETTE.length];
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, bg);
  g.addColorStop(1, "#FFFFFF");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg;
  ctx.strokeStyle = "rgba(11,15,25,0.15)";
  ctx.lineWidth = 6;
  const cx = w / 2;
  ctx.beginPath();
  const kind = i % 3;
  if (kind === 0) {
    // blusa / camiseta
    ctx.moveTo(cx - 140, 300); ctx.lineTo(cx - 290, 420); ctx.lineTo(cx - 220, 520); ctx.lineTo(cx - 160, 470);
    ctx.lineTo(cx - 160, 900); ctx.lineTo(cx + 160, 900); ctx.lineTo(cx + 160, 470); ctx.lineTo(cx + 220, 520);
    ctx.lineTo(cx + 290, 420); ctx.lineTo(cx + 140, 300); ctx.quadraticCurveTo(cx, 380, cx - 140, 300);
  } else if (kind === 1) {
    // vestido
    ctx.moveTo(cx - 90, 260); ctx.lineTo(cx - 130, 520); ctx.lineTo(cx - 270, 980); ctx.lineTo(cx + 270, 980);
    ctx.lineTo(cx + 130, 520); ctx.lineTo(cx + 90, 260); ctx.quadraticCurveTo(cx, 330, cx - 90, 260);
  } else {
    // pantalón
    ctx.moveTo(cx - 170, 260); ctx.lineTo(cx + 170, 260); ctx.lineTo(cx + 210, 1000); ctx.lineTo(cx + 40, 1000);
    ctx.lineTo(cx, 470); ctx.lineTo(cx - 40, 1000); ctx.lineTo(cx - 210, 1000);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

export async function loadSample() {
  const files: File[] = [];
  const rows = SAMPLE.slice(1);
  for (let i = 0; i < rows.length; i++) {
    const code = String(rows[i][1]);
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 1200;
    drawGarment(canvas.getContext("2d")!, 900, 1200, i);
    const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.9));
    // Algunas fotos llevan sufijos como los que dejan los teléfonos, para mostrar el matching.
    const name = i % 4 === 1 ? `${code} (1).jpg` : i % 4 === 3 ? `${code.toLowerCase()}_2.jpg` : `${code}.jpg`;
    files.push(new File([blob], name, { type: "image/jpeg" }));
  }
  addImages(files);
  // El Excel llega después que las fotos, como en la vida real.
  setTimeout(() => applyExcel(rowsToProducts(SAMPLE), "inventario-ejemplo.xlsx"), 1200);
}
