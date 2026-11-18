"use client";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { AlertTriangle, Download, FileJson, Monitor, ScanSearch, Smartphone, Tablet } from "lucide-react";
import { AiReviewPanel } from "@/components/review/AiReviewPanel";
import { useStudio } from "@/lib/draft/store";
import type { A2uiAction } from "@/components/preview/SurfaceView";
import { download, exportStandaloneHtml } from "./export";

const SurfaceView = dynamic(() => import("@/components/preview/SurfaceView"), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-muted">Carregando renderer A2UI…</p>,
});

const VIEWPORTS = [
  { id: "desktop", width: "100%", icon: Monitor, label: "Desktop" },
  { id: "tablet", width: "820px", icon: Tablet, label: "Tablet" },
  { id: "mobile", width: "390px", icon: Smartphone, label: "Celular" },
] as const;

export function LandingTab() {
  const result = useStudio((s) => s.result);
  const [viewport, setViewport] = useState<(typeof VIEWPORTS)[number]["id"]>("desktop");
  const [lastAction, setLastAction] = useState<A2uiAction | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [showReview, setShowReview] = useState(false);
  const review = useStudio((s) => s.reviews.landing);

  if (!result) return null;
  const width = VIEWPORTS.find((v) => v.id === viewport)!.width;

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
          {VIEWPORTS.map((v) => (
            <button
              key={v.id}
              title={v.label}
              aria-label={v.label}
              onClick={() => setViewport(v.id)}
              className={`rounded-md p-1.5 ${viewport === v.id ? "bg-brand-soft text-brand" : "text-gray-500 hover:bg-gray-100"}`}
            >
              <v.icon size={16} />
            </button>
          ))}
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
      <div className="relative flex-1 overflow-auto bg-canvas p-4">
        <div ref={frameRef} className="mx-auto overflow-hidden rounded-xl border border-line bg-white shadow-sm transition-[width]" style={{ width, maxWidth: "100%" }} data-testid="landing-frame">
          <SurfaceView messages={result.messages} onAction={setLastAction} />
        </div>
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
