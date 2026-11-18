"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Loader2, PackageOpen } from "lucide-react";
import { useStudio } from "@/lib/draft/store";
import { hasProjectContent, projectFiles } from "@/lib/export/project";
import { downloadZip, exportStandaloneHtml } from "./export";

const SurfaceView = dynamic(() => import("@/components/preview/SurfaceView"), { ssr: false });

/** Espera a landing aparecer no contêiner fora da tela (até ~4s). */
function whenRendered(el: HTMLElement): Promise<void> {
  const start = performance.now();
  return new Promise((resolve) => {
    const tick = () => {
      const ready = el.childElementCount > 0 && (el.textContent ?? "").trim().length > 0;
      if (ready || performance.now() - start > 4000) requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      else requestAnimationFrame(tick);
    };
    tick();
  });
}

/** Baixa um zip com a landing (web/), o backend e o banco. Funciona de qualquer modo. */
export function ExportProject() {
  const result = useStudio((s) => s.result);
  const arch = useStudio((s) => s.arch);
  const db = useStudio((s) => s.db);
  const [capturing, setCapturing] = useState(false);
  const frame = useRef<HTMLDivElement>(null);

  const enabled = hasProjectContent({ landingHtml: result ? "x" : null, arch, db });

  useEffect(() => {
    if (!capturing) return;
    let alive = true;
    (async () => {
      let html: string | null = null;
      if (result && frame.current) {
        await whenRendered(frame.current);
        html = exportStandaloneHtml(frame.current);
      }
      if (!alive) return;
      downloadZip("vitrine-projeto.zip", projectFiles({ landingHtml: html, arch, db }));
      setCapturing(false);
    })();
    return () => {
      alive = false;
    };
  }, [capturing, result, arch, db]);

  return (
    <>
      <button
        onClick={() => setCapturing(true)}
        disabled={!enabled || capturing}
        data-testid="export-project"
        title={enabled ? "Baixar landing + backend + banco num .zip" : "Nada para exportar ainda: desenhe a landing, a arquitetura ou o banco."}
        className="ml-1 flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40"
      >
        {capturing ? <Loader2 size={14} className="animate-spin" /> : <PackageOpen size={14} />}
        Exportar projeto
      </button>
      {capturing && result ? (
        <div aria-hidden className="pointer-events-none fixed top-0 -left-[20000px] w-[1280px] bg-white">
          <div ref={frame}>
            <SurfaceView messages={result.messages} />
          </div>
        </div>
      ) : null}
    </>
  );
}
