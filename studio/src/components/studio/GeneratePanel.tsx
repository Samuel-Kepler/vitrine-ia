"use client";
import { useState } from "react";
import { Loader2, Sparkles, Undo2 } from "lucide-react";
import { useStudio } from "@/lib/draft/store";
import { mergeGenerated, type GenerateMode } from "@/lib/draft/generate-shared";
import type { GenerateResult, GenerateSiteResult } from "@/lib/draft/generate";
import type { Page } from "@/lib/draft/pages";

/** Primeira linha das notas: de onde veio o layout. */
export function generateSource(r: Pick<GenerateResult, "provider" | "modelId" | "fallback" | "error">): string {
  if (r.provider === "mock") return "Fonte: modelo automático (provedor mock, sem IA).";
  if (!r.fallback) return `Fonte: ${r.provider} · ${r.modelId}`;
  return `Fonte: modelo automático — ${r.provider} · ${r.modelId} falhou: ${r.error ?? "motivo desconhecido"}`;
}

type Scope = "page" | "site";

/** Site antes do "Gerar site", para o Desfazer (o Ctrl+Z só olha a página aberta). */
let siteSnapshot: { pages: Page[]; pageId: string } | null = null;

/** "Gerar com IA": descreve a página (ou o site) em texto e recebe os blocos no canvas. */
export function GeneratePanel() {
  const [prompt, setPrompt] = useState("");
  const [scope, setScope] = useState<Scope>("page");
  const [canUndoSite, setCanUndoSite] = useState(false);
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
        body: JSON.stringify({ prompt, scope, brief: s.brief || undefined, settings: clean.kind ? clean : undefined }),
      });
      const json = (await res.json()) as (GenerateResult & GenerateSiteResult) & { error?: string };
      if (!res.ok) {
        setError(json.error ?? `Erro ${res.status}`);
        return;
      }
      const st = useStudio.getState();
      if (scope === "site") {
        siteSnapshot = { pages: st.allPages(), pageId: st.pageId };
        st.replaceSite(json.site.pages);
        if (!st.brief.trim()) st.setBrief(prompt.trim().slice(0, 2000));
        setCanUndoSite(true);
        setNotes([generateSource(json), `${json.site.pages.length} páginas: ${json.site.pages.map((x) => x.name).join(", ")}.`, ...json.site.notes]);
        return;
      }
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
    <section className="mx-3 mt-3 rounded-lg border border-line bg-canvas/60 p-3.5" data-testid="generate-panel">
      <h3 className="flex items-center gap-1.5 pb-2 label-mono !text-brand">
        <Sparkles size={14} /> Gerar com IA
      </h3>
      <div className="mb-2 grid grid-cols-2 rounded-md border border-line bg-white p-0.5 text-xs" role="radiogroup" aria-label="Gerar o quê">
        {(
          [
            ["page", "Esta página"],
            ["site", "Site inteiro"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={scope === v}
            data-testid={`generate-scope-${v}`}
            onClick={() => setScope(v)}
            className={`rounded-[3px] py-1.5 transition-colors ${scope === v ? "bg-ink font-medium text-white" : "text-gray-600 hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {scope === "site" ? <p className="mb-2 text-[11px] text-muted">Cria de 2 a 6 páginas e substitui as atuais (dá para desfazer).</p> : null}
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && prompt.trim().length >= 3 && !loading) run();
        }}
        rows={6}
        maxLength={2000}
        data-testid="generate-prompt"
        placeholder={scope === "site" ? "Descreva o site. Ex.: estúdio de pilates com aulas, planos, equipe e contato" : "Descreva a página. Ex.: padaria de bairro com cardápio, depoimentos e formulário de encomenda"}
        className="block min-h-36 w-full resize-y rounded-md border border-line bg-white p-2.5 text-sm leading-relaxed outline-none focus:border-brand"
      />
      {scope === "page" && hasBlocks ? (
        <div className="mt-2">
          <div className="grid grid-cols-2 rounded-md border border-line bg-white p-0.5 text-xs" role="radiogroup" aria-label="O que fazer com a página atual">
            {(
              [
                ["replace", "Substituir"],
                ["append", "Acrescentar"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={mode === v}
                onClick={() => setMode(v)}
                className={`rounded-[3px] py-1.5 transition-colors ${mode === v ? "bg-ink font-medium text-white" : "text-gray-600 hover:text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === "replace" && multiPage ? <p className="mt-1 text-[10.5px] text-muted">Mantém o menu e o rodapé do site.</p> : null}
          {mode === "append" ? <p className="mt-1 text-[10.5px] text-muted">Os blocos entram antes do rodapé.</p> : null}
        </div>
      ) : null}
      <button
        onClick={run}
        disabled={loading || prompt.trim().length < 3}
        data-testid="generate-run"
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        {loading ? (scope === "site" ? "Gerando o site…" : "Gerando…") : scope === "site" ? "Gerar site" : "Gerar layout"}
      </button>
      {error ? <p className="mt-2 rounded-md bg-red-50 p-2 text-[11px] text-red-800">{error}</p> : null}
      {notes.length ? (
        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[11px] text-gray-700" data-testid="generate-notes">
          {notes.map((n, i) => (
            <li key={i} className={i === 0 && n.includes(" falhou: ") ? "font-medium text-amber-800" : undefined}>
              {n}
            </li>
          ))}
          <li className="text-muted">{canUndoSite && scope === "site" ? "Ajuste as páginas e use Reimaginar → Todas." : "Ctrl+Z desfaz. Depois ajuste os blocos e clique em Reimaginar."}</li>
        </ul>
      ) : null}
      {canUndoSite && siteSnapshot ? (
        <button
          onClick={() => {
            const snap = siteSnapshot;
            if (!snap) return;
            const active = snap.pages.find((x) => x.id === snap.pageId) ?? snap.pages[0];
            useStudio.setState({ pages: snap.pages, pageId: active.id, tree: active.tree, result: active.result, selectedId: null });
            useStudio.temporal.getState().clear();
            siteSnapshot = null;
            setCanUndoSite(false);
            setNotes([]);
          }}
          data-testid="generate-undo-site"
          className="mt-2 flex items-center gap-1 text-[11px] text-brand hover:underline"
        >
          <Undo2 size={12} /> Desfazer site gerado
        </button>
      ) : null}
    </section>
  );
}
