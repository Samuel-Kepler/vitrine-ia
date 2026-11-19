"use client";
import { forwardRef, useEffect, useRef, useState, type ReactNode } from "react";
import { fitScale } from "@/lib/preview/devices";

/** Mede um elemento (largura/altura do conteúdo) e acompanha mudanças. */
function useSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ width: e.contentRect.width, height: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

interface Props {
  /** null = ocupa a área inteira. */
  size: { width: number; height: number | null } | null;
  onScale?: (scale: number) => void;
  onClickCapture?: (e: React.MouseEvent) => void;
  children: ReactNode;
}

/**
 * Área do preview. Com um aparelho escolhido, a página é desenhada na largura
 * real dele (as container queries da landing reagem a essa largura) e a
 * moldura encolhe para caber na tela, como o modo dispositivo do navegador.
 */
export const DeviceStage = forwardRef<HTMLDivElement, Props>(function DeviceStage({ size, onScale, onClickCapture, children }, frameRef) {
  const areaRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const area = useSize(areaRef);
  const content = useSize(contentRef);
  const scale = size && area.width ? fitScale(size, area) : 1;

  useEffect(() => onScale?.(scale), [scale, onScale]);

  const frameClass = "overflow-hidden rounded-lg border border-line bg-white shadow-sm";
  return (
    <div className="relative min-h-0 flex-1 overflow-auto bg-canvas p-4">
      <div ref={areaRef} className="pointer-events-none absolute inset-4" aria-hidden />
      {size ? (
        <div className="mx-auto" style={{ width: size.width * scale, height: (size.height ?? content.height) * scale }}>
          <div
            className={frameClass}
            style={{ width: size.width, height: size.height ?? undefined, transform: `scale(${scale})`, transformOrigin: "top left", overflowY: size.height ? "auto" : "hidden" }}
            data-testid="landing-frame"
            data-device-width={size.width}
          >
            <div ref={contentRef}>
              <div ref={frameRef} onClickCapture={onClickCapture}>
                {children}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={`mx-auto ${frameClass}`} data-testid="landing-frame">
          <div ref={frameRef} onClickCapture={onClickCapture}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
});
