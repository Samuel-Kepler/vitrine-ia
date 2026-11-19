"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Loader2, PackageOpen } from "lucide-react";
import { useStudio } from "@/lib/draft/store";
import { linkPagesInHtml } from "@/lib/draft/pages";
import { hasProjectContent, projectFiles, type WebPage } from "@/lib/export/project";
import { reactProject } from "@/lib/export/react";
import { downloadZip, exportStandaloneHtml } from "./export";
import { exportAssetFiles } from "@/lib/assets/assets";
import { collectSitePages, siteBrand, type SitePage } from "./site-pages";

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

interface Job {
  items: SitePage[];
  index: number;
  done: WebPage[];
}

/** Baixa um zip com o site (web/, um HTML por página), o backend e o banco. */
export function ExportProject() {
  const arch = useStudio((s) => s.arch);
  const db = useStudio((s) => s.db);
  const hasPages = useStudio((s) => s.tree.length > 0 || s.pages.some((p) => p.tree.length > 0));
  const [job, setJob] = useState<Job | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const frame = useRef<HTMLDivElement>(null);

  const enabled = hasProjectContent({ webPages: hasPages ? [{ file: "", name: "", html: "" }] : [], arch, db });
  const busy = preparing || !!job;

  const start = async () => {
    setError(null);
    const s = useStudio.getState();
    const pages = s.allPages().filter((p) => p.tree.length > 0);
    if (!pages.length) {
      downloadZip("vitrine-projeto.zip", projectFiles({ webPages: [], arch: s.arch, db: s.db }));
      return;
    }
    setPreparing(true);
    try {
      const items = await collectSitePages();
      setJob({ items, index: 0, done: [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPreparing(false);
    }
  };

  // Uma página por vez: renderiza fora da tela, captura o HTML, passa para a próxima.
  useEffect(() => {
    if (!job || !frame.current) return;
    let alive = true;
    (async () => {
      await whenRendered(frame.current!);
      if (!alive) return;
      const item = job.items[job.index];
      const done = [...job.done, { file: item.file, name: item.name, auto: item.auto, html: exportStandaloneHtml(frame.current!) }];
      if (job.index + 1 < job.items.length) {
        setJob({ ...job, index: job.index + 1, done });
        return;
      }
      const s = useStudio.getState();
      const pages = s.allPages().filter((p) => p.tree.length > 0);
      const webPages = done.map((w) => ({ ...w, html: linkPagesInHtml(w.html, pages) }));
      const react = s.reactEdited && s.reactFiles
        ? Object.entries(s.reactFiles).map(([path, content]) => ({ path: `react${path}`, content }))
        : reactProject(job.items, { brand: siteBrand() });
      // Imagens do computador: o site estático já vem com elas embutidas (SurfaceView);
      // o projeto React recebe os arquivos em react/public/images.
      downloadZip("vitrine-projeto.zip", exportAssetFiles(projectFiles({ webPages, arch: s.arch, db: s.db, react }), s.assets, "react/"));
      setJob(null);
    })();
    return () => {
      alive = false;
    };
  }, [job]);

  const current = job?.items[job.index];
  return (
    <>
      <button
        onClick={start}
        disabled={!enabled || busy}
        data-testid="export-project"
        title={error ?? (enabled ? "Baixar o site (todas as páginas) + backend + banco num .zip" : "Nada para exportar ainda: desenhe a landing, a arquitetura ou o banco.")}
        className={`ml-1 flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs disabled:opacity-40 ${error ? "border-red-300 text-red-700" : "border-line text-gray-700 hover:bg-gray-50"}`}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <PackageOpen size={14} />}
        {job ? `Exportando ${job.index + 1}/${job.items.length}…` : preparing ? "Preparando…" : error ? "Exportar (falhou, tente de novo)" : "Exportar projeto"}
      </button>
      {current ? (
        <div aria-hidden className="pointer-events-none fixed top-0 -left-[20000px] w-[1280px] bg-white">
          <div ref={frame} key={current.id}>
            <SurfaceView messages={current.messages} />
          </div>
        </div>
      ) : null}
    </>
  );
}
