"use client";
import { useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, Bot, Info, Loader2, ScanSearch } from "lucide-react";
import { useStudio } from "@/lib/draft/store";
import { inputKey, type AiReviewResult, type ReviewMode, type ReviewState } from "@/lib/review/ai-input";

const ICON = { error: AlertCircle, warning: AlertTriangle, info: Info } as const;
const COLOR = { error: "text-red-600", warning: "text-amber-600", info: "text-sky-600" } as const;
const ORDER = { error: 0, warning: 1, info: 2 } as const;

export function scoreTone(score: number) {
  if (score >= 85) return { ring: "#059669", label: "pronto" };
  if (score >= 65) return { ring: "#d97706", label: "quase lá" };
  return { ring: "#dc2626", label: "precisa de ajustes" };
}

function ScoreRing({ score }: { score: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const tone = scoreTone(score);
  return (
    <div className="relative size-16 shrink-0" data-testid="ai-review-score" title={tone.label}>
      <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={tone.ring} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">{score}</span>
    </div>
  );
}

function useReviewState(): ReviewState {
  const draft = useStudio((s) => s.tree);
  const brief = useStudio((s) => s.brief);
  const result = useStudio((s) => s.result);
  const arch = useStudio((s) => s.arch);
  const db = useStudio((s) => s.db);
  return useMemo(() => ({ draft, brief: brief || undefined, messages: result?.messages ?? null, arch, db }), [draft, brief, result, arch, db]);
}

function sourceText(r: AiReviewResult) {
  if (r.provider === "mock") return "Fonte: regras (provedor mock, sem IA).";
  if (!r.fallback) return `Fonte: regras + ${r.provider} · ${r.modelId}`;
  return `Fonte: só regras — ${r.provider} · ${r.modelId} falhou: ${r.error ?? "motivo desconhecido"}`;
}

/** Botão "Revisar com IA" + nota, resumo e problemas (regras e IA) do modo. */
export function AiReviewPanel({ mode, onPick, hideRules }: { mode: ReviewMode; onPick?: (id: string) => void; hideRules?: boolean }) {
  const state = useReviewState();
  const review = useStudio((s) => s.reviews[mode]);
  const setReview = useStudio((s) => s.setReview);
  const settings = useStudio((s) => s.settings);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stale = !!review && review.inputKey !== inputKey(mode, state);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const clean = Object.fromEntries(Object.entries(settings).filter(([, v]) => typeof v === "string" && v.trim()));
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, ...state, settings: clean.kind ? clean : undefined }),
      });
      const json = (await res.json()) as AiReviewResult & { error?: string };
      if (!res.ok) setError(json.error ?? `Erro ${res.status}`);
      else setReview(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  // No canvas, as regras já aparecem na lista de Revisão logo abaixo.
  const issues = review ? [...review.issues].filter((i) => !(hideRules && i.source === "regra")).sort((a, b) => ORDER[a.severity] - ORDER[b.severity]) : [];

  return (
    <section className="space-y-3" data-testid={`ai-review-${mode}`}>
      <button
        onClick={run}
        disabled={loading}
        data-testid="ai-review-run"
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-ink py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : <ScanSearch size={15} />}
        {loading ? "Revisando…" : review ? "Revisar de novo" : "Revisar com IA"}
      </button>
      {error ? <p className="rounded-md bg-red-50 p-2 text-xs text-red-800">{error}</p> : null}
      {review ? (
        <div className={`space-y-3 ${stale ? "opacity-60" : ""}`}>
          {stale ? <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900">O conteúdo mudou desde esta revisão.</p> : null}
          <div className="flex items-center gap-3">
            <ScoreRing score={review.score} />
            <p className="text-sm text-gray-700">{review.summary}</p>
          </div>
          {issues.length ? (
            <ul className="space-y-2" data-testid="ai-review-issues">
              {issues.map((i, k) => {
                const Icon = ICON[i.severity];
                return (
                  <li key={k}>
                    <button className="flex w-full items-start gap-2 rounded-md p-1.5 text-left text-xs hover:bg-gray-50" onClick={() => i.targetId && onPick?.(i.targetId)}>
                      <Icon size={15} className={`mt-px shrink-0 ${COLOR[i.severity]}`} />
                      <span>
                        <span className="font-medium">{i.title}</span>
                        {i.target && !i.targetId ? <span className="text-muted"> · {i.target}</span> : null}
                        {i.suggestion ? <span className="mt-0.5 block text-gray-600">{i.suggestion}</span> : null}
                        <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted">
                          {i.source === "ia" ? <Bot size={10} /> : null}
                          {i.source === "ia" ? "IA" : `regra ${i.code ?? ""}`}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <p className={`text-[11px] ${review.fallback && review.provider !== "mock" ? "font-medium text-amber-800" : "text-muted"}`} data-testid="ai-review-source">
            {sourceText(review)}
          </p>
        </div>
      ) : null}
    </section>
  );
}
