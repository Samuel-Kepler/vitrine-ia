"use client";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { AlertTriangle, Download, FileJson, ScanSearch } from "lucide-react";
import { DeviceToolbar } from "@/components/preview/DeviceToolbar";
import { DeviceStage } from "@/components/preview/DeviceStage";
import { DEFAULT_VIEWPORT, resolveViewport, type ViewportState } from "@/lib/preview/devices";
import { AiReviewPanel } from "@/components/review/AiReviewPanel";
import { useStudio } from "@/lib/draft/store";
import type { A2uiAction } from "@/components/preview/SurfaceView";
import { download, exportStandaloneHtml } from "./export";
import { pageForLink } from "@/lib/draft/pages";

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
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-panel px-4 py-2 text-xs">
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
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 ${showReview ? "border-brand bg-brand-soft text-brand" : "border-line hover:bg-gray-50"}`}
          >
            <ScanSearch size={14} /> Revisão{review ? ` · ${review.score}` : ""}
          </button>
          <button
            className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 hover:bg-gray-50"
            onClick={() => download("landing.a2ui.json", JSON.stringify(result.messages, null, 2), "application/json")}
          >
            <FileJson size={14} /> A2UI JSON
          </button>
          <button
            className="flex items-center gap-1.5 rounded-md bg-ink px-2.5 py-1.5 text-white hover:opacity-90"
            onClick={() => frameRef.current && download("landing.html", exportStandaloneHtml(frameRef.current), "text/html")}
            data-testid="export-html"
          >
            <Download size={14} /> HTML
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
          <SurfaceView messages={result.messages} onAction={setLastAction} />
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
          <AiReviewPanel mode="landing" />
        </aside>
      ) : null}
      </div>
    </div>
  );
}
