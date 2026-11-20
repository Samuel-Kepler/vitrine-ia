"use client";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { AlertTriangle, Download, FileJson, Play, ScanSearch } from "lucide-react";
import { DeviceToolbar } from "@/components/preview/DeviceToolbar";
import { DeviceStage } from "@/components/preview/DeviceStage";
import { DEFAULT_VIEWPORT, resolveViewport, type ViewportState } from "@/lib/preview/devices";
import { AiReviewPanel } from "@/components/review/AiReviewPanel";
import { useStudio } from "@/lib/draft/store";
import type { A2uiAction } from "@/components/preview/SurfaceView";
import { download, exportStandaloneHtml } from "./export";
import { pageForLink } from "@/lib/draft/pages";
import { resolveAssets } from "@/lib/assets/assets";
import { runReimagine } from "./reimagine-client";

const SurfaceView = dynamic(() => import("@/components/preview/SurfaceView"), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-muted">Carregando renderer A2UI…</p>,
});

// Tamanho escolhido sobrevive à troca de aba/página na mesma sessão.
let lastViewport: ViewportState = DEFAULT_VIEWPORT;

export function LandingTab() {
  const result = useStudio((s) => s.result);
  const [viewport, setViewportState] = useState<ViewportState>(lastViewport);
  const setViewport = (v: ViewportState) => {
    lastViewport = v;
    setViewportState(v);
  };
  const [scale, setScale] = useState(1);
  const [lastAction, setLastAction] = useState<A2uiAction | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [showReview, setShowReview] = useState(false);
  const review = useStudio((s) => s.reviews.landing);

  const pageName = useStudio((s) => s.pages.find((p) => p.id === s.pageId)?.name);
  const [replay, setReplay] = useState(0);

  // "Ver animação": remonta a página (reinicia a entrada do hero) e rola do topo ao fim.
  // As animações das seções são ligadas à rolagem, então é a rolagem que as mostra.
  const playTour = () => {
    let el: HTMLElement | null = frameRef.current;
    while (el && !(el.scrollHeight > el.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
    setReplay((n) => n + 1);
    if (!el) return;
    const box = el;
    box.scrollTo({ top: 0 });
    let stopped = false;
    const stop = () => {
      stopped = true;
      for (const ev of ["wheel", "pointerdown", "keydown", "touchstart"]) box.removeEventListener(ev, stop);
    };
    for (const ev of ["wheel", "pointerdown", "keydown", "touchstart"]) box.addEventListener(ev, stop, { passive: true });
    let last = 0;
    const step = (t: number) => {
      if (stopped) return;
      const dt = last ? Math.min(50, t - last) : 0;
      last = t;
      box.scrollTop += dt * 0.45; // ~450 px/s
      if (box.scrollTop + box.clientHeight >= box.scrollHeight - 2) return stop();
      requestAnimationFrame(step);
    };
    // Espera o hero animar antes de descer.
    setTimeout(() => requestAnimationFrame(step), 900);
  };

  // Links do menu com o nome de uma página trocam de página no preview.
  const onFrameClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest("a");
    if (!a) return;
    const st = useStudio.getState();
    const page = pageForLink(st.allPages(), a.textContent ?? "");
    if (page || a.getAttribute("href") === "#") e.preventDefault();
    if (page && page.id !== st.pageId) st.switchPage(page.id);
  };

  if (!result) {
    return (
      <div className="flex flex-1 items-center justify-center bg-canvas p-6" data-testid="landing-empty">
        <p className="max-w-sm rounded-lg bg-white p-5 text-center text-sm text-muted shadow-sm">
          A página <b className="text-ink">{pageName}</b> ainda não foi reimaginada. Monte o rascunho e clique em <b className="text-ink">Reimaginar</b>.
        </p>
      </div>
    );
  }
  const size = resolveViewport(viewport);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-panel px-4 py-2.5 text-sm">
        <span className="rounded-full bg-canvas px-2.5 py-1 font-medium" data-testid="result-provider">
          {result.provider} · {result.modelId}
        </span>
        <span className="text-muted">
          {result.attempts} tentativa{result.attempts > 1 ? "s" : ""}
          {result.usage?.inputTokens ? ` · ${result.usage.inputTokens} → ${result.usage.outputTokens} tokens` : ""}
        </span>
        {result.fallback ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-800">versão automática (sem IA)</span>
        ) : (
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-800">A2UI validado</span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <DeviceToolbar value={viewport} onChange={setViewport} scale={scale} />
          <span className="mx-1 h-5 w-px bg-line" />
          <button
            onClick={() => setShowReview((v) => !v)}
            data-testid="toggle-ai-review"
            aria-pressed={showReview}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-2 ${showReview ? "border-brand bg-brand-soft text-brand" : "border-line hover:bg-gray-50"}`}
          >
            <ScanSearch size={16} /> Revisão{review ? ` · ${review.score}` : ""}
          </button>
          <button
            onClick={playTour}
            className="flex items-center gap-1.5 rounded-md border border-line px-3 py-2 hover:bg-gray-50"
            title="Recarrega a página e rola do topo ao fim para ver as animações (role ou clique para parar)"
            data-testid="play-animations"
          >
            <Play size={16} /> Ver animação
          </button>
          <button
            className="flex items-center gap-1.5 rounded-md border border-line px-3 py-2 hover:bg-gray-50"
            onClick={() => download("landing.a2ui.json", JSON.stringify(resolveAssets(result.messages, useStudio.getState().assets), null, 2), "application/json")}
          >
            <FileJson size={16} /> A2UI JSON
          </button>
          <button
            className="flex items-center gap-1.5 rounded-md bg-ink px-3 py-2 text-white hover:opacity-90"
            onClick={() => frameRef.current && download("landing.html", exportStandaloneHtml(frameRef.current), "text/html")}
            data-testid="export-html"
          >
            <Download size={16} /> HTML
          </button>
        </div>
      </div>

      {result.error || result.warnings.length ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          <p className="flex items-center gap-1.5 font-medium">
            <AlertTriangle size={14} /> {result.error ?? "A IA precisou de correções."}
          </p>
          {result.warnings.length ? (
            <details className="mt-1">
              <summary className="cursor-pointer">Erros do compilador ({result.warnings.length})</summary>
              <ul className="mt-1 list-disc pl-5">
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : result.note ? (
        <p className="border-b border-line bg-panel px-4 py-2 text-xs text-gray-600">{result.note}</p>
      ) : null}

      {result.facts?.length ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900" data-testid="fact-warnings">
          <p className="flex items-center gap-1.5 font-medium">
            <AlertTriangle size={14} /> A página cita {result.facts.length} {result.facts.length > 1 ? "itens" : "item"} que não {result.facts.length > 1 ? "estavam" : "estava"} no rascunho nem no briefing. Confira antes de publicar.
          </p>
          <details className="mt-1">
            <summary className="cursor-pointer">Ver números e nomes novos</summary>
            <ul className="mt-1 list-disc pl-5">
              {result.facts.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </details>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
      <div className="relative flex min-h-0 flex-1 flex-col">
        <DeviceStage ref={frameRef} size={size} onScale={setScale} onClickCapture={onFrameClick}>
          <SurfaceView key={replay} messages={result.messages} onAction={setLastAction} />
        </DeviceStage>
        {lastAction ? (
          <div className="fixed bottom-4 right-4 z-30 max-w-sm rounded-lg bg-ink p-3 text-xs text-white shadow-lg" role="status">
            <p className="font-semibold">Ação A2UI: {lastAction.name}</p>
            {lastAction.context && Object.keys(lastAction.context).length ? (
              <pre className="mt-1 whitespace-pre-wrap text-white/70">{JSON.stringify(lastAction.context, null, 2)}</pre>
            ) : null}
            <button className="mt-2 text-white/60 underline" onClick={() => setLastAction(null)}>
              fechar
            </button>
          </div>
        ) : null}
      </div>
      {showReview ? (
        <aside className="w-80 shrink-0 overflow-y-auto border-l border-line bg-panel p-4" aria-label="Revisão da landing">
          <h2 className="mb-3 font-semibold">Revisão da landing</h2>
          <AiReviewPanel mode="landing" onImprove={(feedback) => runReimagine(undefined, { feedback })} />
        </aside>
      ) : null}
      </div>
    </div>
  );
}
