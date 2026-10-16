"use client";
// Lienzo infinito: pan/zoom con transformaciones CSS (GPU) y virtualización.
// El transform vive en un ref y se aplica directo al DOM, así arrastrar el lienzo no
// re-renderiza React; sólo cuando cambian las filas/columnas visibles se actualiza el estado.

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { select } from "@/lib/client/actions";
import { applyFilters, groupImages, sortedProducts } from "@/lib/client/selectors";
import { useEditor } from "@/lib/client/store";
import { CARD_H, CARD_W, ProductCard } from "./ProductCard";
import { EmptyState } from "./EmptyState";

const GAP = 24;
const PAD = 48;
const MIN_K = 0.2;
const MAX_K = 2.5;

const BASE_K = 0.75;

/**
 * En línea recta mientras quepan a lo ancho de la pantalla; con más prendas, n filas.
 * Con cientos, el bloque tiende a ser más ancho que alto (como una mesa de trabajo).
 */
export function columnsFor(n: number, viewportW: number) {
  const fit = Math.max(1, Math.floor((viewportW - PAD * 2 + GAP) / ((CARD_W + GAP) * BASE_K)));
  return Math.max(1, Math.min(n, Math.max(fit, Math.ceil(Math.sqrt(n * 1.6)))));
}

export interface CanvasHandle {
  zoomBy(f: number): void;
  fit(): void;
  getZoom(): number;
}

interface View {
  x: number;
  y: number;
  k: number;
}

export const CanvasView = forwardRef<CanvasHandle, { onZoom?: (k: number) => void }>(function CanvasView({ onZoom }, ref) {
  const products = useEditor((s) => s.products);
  const images = useEditor((s) => s.images);
  const filters = useEditor((s) => s.filters);
  const selection = useEditor((s) => s.selection);
  const hydrated = useEditor((s) => s.hydrated);

  const byProduct = useMemo(() => groupImages(images), [images]);
  const all = useMemo(() => sortedProducts(products), [products]);
  const list = useMemo(() => applyFilters(all, byProduct, filters), [all, byProduct, filters]);
  const [vw, setVw] = useState(1200);
  const cols = columnsFor(list.length, vw);
  const rows = Math.ceil(list.length / cols);
  const worldW = cols * CARD_W + (cols - 1) * GAP;
  const worldH = rows * CARD_H + Math.max(0, rows - 1) * GAP;

  const viewport = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const view = useRef<View>({ x: PAD, y: PAD + 8, k: 1 });
  const [range, setRange] = useState({ r0: 0, r1: 6, c0: 0, c1: 12 });
  const raf = useRef(0);

  const apply = useCallback(() => {
    const v = view.current;
    if (world.current) world.current.style.transform = `translate3d(${v.x}px, ${v.y}px, 0) scale(${v.k})`;
    if (viewport.current) {
      let dot = 20 * v.k;
      while (dot < 12) dot *= 2; // al alejar, la retícula se espacia como en Figma
      viewport.current.style.backgroundSize = `${dot}px ${dot}px`;
      viewport.current.style.backgroundPosition = `${v.x}px ${v.y}px`;
    }
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const el = viewport.current;
      if (!el) return;
      const { width, height } = el.getBoundingClientRect();
      const cw = (CARD_W + GAP) * v.k;
      const ch = (CARD_H + GAP) * v.k;
      const next = {
        c0: Math.max(0, Math.floor(-v.x / cw) - 1),
        c1: Math.ceil((width - v.x) / cw) + 1,
        r0: Math.max(0, Math.floor(-v.y / ch) - 1),
        r1: Math.ceil((height - v.y) / ch) + 1,
      };
      setRange((cur) => (cur.c0 === next.c0 && cur.c1 === next.c1 && cur.r0 === next.r0 && cur.r1 === next.r1 ? cur : next));
      onZoom?.(v.k);
    });
  }, [onZoom]);

  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number) => {
      const v = view.current;
      const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor));
      const f = k / v.k;
      view.current = { k, x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f };
      apply();
    },
    [apply],
  );

  const fit = useCallback(() => {
    const el = viewport.current;
    if (!el || !list.length) return;
    const { width, height } = el.getBoundingClientRect();
    const k = Math.min(1, Math.max(MIN_K, Math.min((width - PAD * 2) / worldW, (height - PAD * 2 - 80) / worldH)));
    view.current = { k, x: Math.max(PAD, (width - worldW * k) / 2), y: PAD + 8 };
    apply();
  }, [apply, list.length, worldW, worldH]);

  useImperativeHandle(
    ref,
    () => ({
      zoomBy: (f) => {
        const r = viewport.current!.getBoundingClientRect();
        zoomAt(f, r.width / 2, r.height / 2);
      },
      fit,
      getZoom: () => view.current.k,
    }),
    [fit, zoomAt],
  );

  // Al pasar de lienzo vacío a tener prendas (o al hidratar), encuadramos el contenido.
  const hadContent = useRef(false);
  useLayoutEffect(() => {
    if (!hydrated) return;
    if (list.length && !hadContent.current) {
      hadContent.current = true;
      const el = viewport.current;
      if (el) {
        const { width } = el.getBoundingClientRect();
        const k = Math.min(1, Math.max(0.6, (width - PAD * 2) / worldW));
        view.current = { k, x: PAD, y: PAD + 8 };
      }
    }
    if (!all.length) hadContent.current = false;
    apply();
  }, [hydrated, list.length, all.length, worldW, apply]);

  // Rueda: desplaza; Ctrl/⌘ + rueda (o pellizco en trackpad): zoom hacia el cursor.
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
      } else {
        const v = view.current;
        const dx = e.shiftKey ? e.deltaY : e.deltaX;
        const dy = e.shiftKey ? 0 : e.deltaY;
        view.current = { ...v, x: v.x - dx, y: v.y - dy };
        apply();
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    // El lienzo cambia de tamaño al abrir/cerrar paneles, no sólo al redimensionar la ventana.
    const ro = new ResizeObserver(([entry]) => {
      setVw(Math.round(entry.contentRect.width / 40) * 40);
      apply();
    });
    ro.observe(el);
    return () => {
      el.removeEventListener("wheel", onWheel);
      ro.disconnect();
    };
  }, [apply, zoomAt]);

  // Arrastrar el fondo = mover el lienzo. Dos dedos = pellizco para zoom.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean; pinch?: { d: number; k: number } } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const v = view.current;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      drag.current = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, vx: v.x, vy: v.y, moved: true, pinch: { d: Math.hypot(a.x - b.x, a.y - b.y), k: v.k } };
    } else {
      drag.current = { x: e.clientX, y: e.clientY, vx: v.x, vy: v.y, moved: false };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !drag.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const d = drag.current;
    if (d.pinch && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const r = viewport.current!.getBoundingClientRect();
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const targetK = Math.min(MAX_K, Math.max(MIN_K, (d.pinch.k * dist) / d.pinch.d));
      zoomAt(targetK / view.current.k, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      return;
    }
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    view.current = { ...view.current, x: d.vx + dx, y: d.vy + dy };
    apply();
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (drag.current && !drag.current.moved && pointers.current.size === 0) select(null);
    if (pointers.current.size === 0) drag.current = null;
  };

  const sel = useMemo(() => new Set(selection), [selection]);
  const visible: React.ReactNode[] = [];
  for (let r = range.r0; r < Math.min(rows, range.r1); r++) {
    for (let c = range.c0; c < Math.min(cols, range.c1); c++) {
      const i = r * cols + c;
      const p = list[i];
      if (!p) continue;
      visible.push(
        <ProductCard
          key={p.key}
          product={p}
          images={byProduct.get(p.key) ?? EMPTY}
          selected={sel.has(p.key)}
          x={c * (CARD_W + GAP)}
          y={r * (CARD_H + GAP)}
          delay={Math.min(400, (i % 24) * 18)}
        />,
      );
    }
  }

  return (
    <div
      ref={viewport}
      className="canvas-dots absolute inset-0 touch-none overflow-hidden cursor-grab active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div ref={world} className="absolute left-0 top-0 origin-top-left will-change-transform" style={{ width: worldW, height: worldH }}>
        {visible}
      </div>
      {hydrated && all.length === 0 && <EmptyState />}
      {hydrated && all.length > 0 && list.length === 0 && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <p className="glass rounded-2xl px-5 py-3 text-sm text-slate-600">Ninguna prenda coincide con los filtros.</p>
        </div>
      )}
    </div>
  );
});

const EMPTY: never[] = [];
