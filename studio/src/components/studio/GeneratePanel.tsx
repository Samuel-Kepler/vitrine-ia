"use client";
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { useStudio } from "@/lib/draft/store";
import { mergeGenerated, type GenerateMode } from "@/lib/draft/generate-shared";
import type { GenerateResult } from "@/lib/draft/generate";

/** Primeira linha das notas: de onde veio o layout. */
export function generateSource(r: Pick<GenerateResult, "provider" | "modelId" | "fallback" | "error">): string {
  if (r.provider === "mock") return "Fonte: modelo automático (provedor mock, sem IA).";
  if (!r.fallback) return `Fonte: ${r.provider} · ${r.modelId}`;
  return `Fonte: modelo automático — ${r.provider} · ${r.modelId} falhou: ${r.error ?? "motivo desconhecido"}`;
}

/** "Gerar com IA": descreve a página em texto e recebe os blocos no canvas. */
export function GeneratePanel() {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<GenerateMode>("replace");
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const hasBlocks = useStudio((s) => s.tree.length > 0);
  const multiPage = useStudio((s) => s.pages.length > 1);

  const run = async () => {
    setLoading(true);
    setError(null);
    setNotes([]);
    try {
      const s = useStudio.getState();
      const clean = Object.fromEntries(Object.entries(s.settings).filter(([, v]) => typeof v === "string" && v.trim()));
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt, brief: s.brief || undefined, settings: clean.kind ? clean : undefined }),
      });
      const json = (await res.json()) as GenerateResult & { error?: string };
      if (!res.ok) {
        setError(json.error ?? `Erro ${res.status}`);
        return;
      }
      const st = useStudio.getState();
      // reset entra no histórico: Ctrl+Z desfaz a geração.
      st.reset(mergeGenerated(st.tree, json.draft, hasBlocks ? mode : "replace", multiPage));
      if (!st.brief.trim()) st.setBrief(prompt.trim().slice(0, 2000));
      st.setTab("canvas");
      setNotes([generateSource(json), ...json.notes]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-3 mt-4 rounded-lg border border-brand/30 bg-brand-soft/40 p-2.5" data-testid="generate-panel">
      <h3 className="flex items-center gap-1.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand">
        <Sparkles size={13} /> Gerar com IA
      </h3>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && prompt.trim().length >= 3 && !loading) run();
        }}
        rows={4}
        maxLength={2000}
        data-testid="generate-prompt"
        placeholder="Descreva a página. Ex.: padaria de bairro com cardápio, depoimentos e formulário de encomenda"
        className="w-full resize-y rounded-md border border-line bg-white p-2 text-xs outline-none focus:border-brand"
      />
      {hasBlocks ? (
        <div className="mt-1.5 flex gap-3 text-[11px] text-gray-700" role="radiogroup" aria-label="O que fazer com a página atual">
          {(
            [
              ["replace", multiPage ? "Substituir (mantém menu e rodapé)" : "Substituir página"],
              ["append", "Acrescentar"],
            ] as const
          ).map(([v, label]) => (
            <label key={v} className="flex items-center gap-1">
              <input type="radio" name="gen-mode" checked={mode === v} onChange={() => setMode(v)} /> {label}
            </label>
          ))}
        </div>
      ) : null}
      <button
        onClick={run}
        disabled={loading || prompt.trim().length < 3}
        data-testid="generate-run"
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-brand py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        {loading ? "Gerando…" : "Gerar layout"}
      </button>
      {error ? <p className="mt-2 rounded-md bg-red-50 p-2 text-[11px] text-red-800">{error}</p> : null}
      {notes.length ? (
        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[11px] text-gray-700" data-testid="generate-notes">
          {notes.map((n, i) => (
            <li key={i} className={i === 0 && n.includes(" falhou: ") ? "font-medium text-amber-800" : undefined}>
              {n}
            </li>
          ))}
          <li className="text-muted">Ctrl+Z desfaz. Depois ajuste os blocos e clique em Reimaginar.</li>
        </ul>
      ) : null}
    </section>
  );
}
