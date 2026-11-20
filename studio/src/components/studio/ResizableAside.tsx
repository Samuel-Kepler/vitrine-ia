"use client";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { PANEL_DEFAULT_LEFT, PANEL_DEFAULT_RIGHT, PANEL_MAX, PANEL_MIN, PANEL_STEP, clampWidth, readWidth, writeWidth } from "@/lib/studio/panel-width";

/**
 * Painel lateral com alça de redimensionar na borda interna (a que encosta no canvas).
 * A largura é guardada por `storageKey` no localStorage e compartilhada entre modos.
 * Teclado: setas movem a alça (16px); duplo clique volta ao padrão.
 */
export function ResizableAside({
  side,
  storageKey,
  defaultWidth,
  min = PANEL_MIN,
  max = PANEL_MAX,
  className = "",
  "aria-label": ariaLabel,
  children,
}: {
  side: "left" | "right";
  storageKey: string;
  defaultWidth?: number;
  min?: number;
  max?: number;
  className?: string;
  "aria-label"?: string;
  children: ReactNode;
}) {
  const def = defaultWidth ?? (side === "left" ? PANEL_DEFAULT_LEFT : PANEL_DEFAULT_RIGHT);
  // Inicia com o padrão (igual no servidor) e lê o valor salvo depois da montagem.
  const [width, setWidth] = useState(() => clampWidth(def, min, max));
  const widthRef = useRef(width);
  const drag = useRef<{ x: number; w: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const w = readWidth(storageKey, def, undefined, min, max);
    widthRef.current = w;
    setWidth(w);
  }, [storageKey, def, min, max]);

  const apply = (w: number) => {
    const c = clampWidth(w, min, max);
    widthRef.current = c;
    setWidth(c);
    return c;
  };

  // Para o painel da esquerda, arrastar para a direita alarga; para o da direita, para a esquerda.
  const sign = side === "left" ? 1 : -1;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, w: widthRef.current };
    setDragging(true);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    apply(d.w + sign * (e.clientX - d.x));
  };

  const endDrag = () => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    writeWidth(storageKey, widthRef.current, undefined, min, max);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const next = apply(widthRef.current + sign * dir * PANEL_STEP);
    writeWidth(storageKey, next, undefined, min, max);
  };

  const reset = () => {
    const next = apply(def);
    writeWidth(storageKey, next, undefined, min, max);
  };

  return (
    <div className="relative flex shrink-0" style={{ width }} data-testid={`resizable-${side}`}>
      <aside className={`min-w-0 flex-1 ${className}`} aria-label={ariaLabel}>
        {children}
      </aside>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Redimensionar painel"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={width}
        tabIndex={0}
        title="Arraste para redimensionar (duplo clique para o padrão)"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={reset}
        onKeyDown={onKeyDown}
        className={`group absolute inset-y-0 z-10 w-1.5 cursor-col-resize touch-none outline-none ${side === "left" ? "right-0" : "left-0"}`}
        data-testid={`resize-handle-${side}`}
      >
        <span
          className={`absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 transition-colors ${
            dragging ? "bg-brand" : "bg-transparent group-hover:bg-brand group-focus-visible:bg-brand"
          }`}
        />
      </div>
    </div>
  );
}
