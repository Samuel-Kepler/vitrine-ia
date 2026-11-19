"use client";
import { useStudio } from "@/lib/draft/store";
import { siteDraft } from "@/lib/draft/pages";
import { expandArch, expandDb } from "@/lib/infer/expand";
import type { SuggestResult } from "@/lib/infer/suggest";
import type { ArchGraph } from "@/lib/arch/model";
import type { ErModel } from "@/lib/db/model";

let snapshot: { arch: ArchGraph; db: ErModel } | null = null;

/** Gera arquitetura + banco a partir do rascunho da landing (IA ou automático). */
export async function runSuggest(): Promise<{ error?: string; info?: string }> {
  const s = useStudio.getState();
  s.setBusy(true);
  try {
    const settings = Object.fromEntries(Object.entries(s.settings).filter(([, v]) => typeof v === "string" && v.trim()));
    const res = await fetch("/api/suggest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      // O site inteiro: um formulário na página Contato também vira rota e tabela.
      body: JSON.stringify({ draft: siteDraft(s.allPages()), brief: s.brief || undefined, settings: settings.kind ? settings : undefined }),
    });
    const json = (await res.json()) as SuggestResult & { error?: string };
    if (!res.ok) return { error: json.error ?? `Erro ${res.status}` };
    snapshot = { arch: s.arch, db: s.db };
    // Banco antes da arquitetura: setArch completa users se a auth for Própria.
    s.setDb(expandDb(json.suggestion.db));
    s.setArch(expandArch(json.suggestion.arch));
    s.setSuggestNotes([sourceLine(json), ...json.suggestion.notes]);
    s.setFlowSel(null);
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  } finally {
    useStudio.getState().setBusy(false);
  }
}

/** Primeira linha das notas: de onde veio a sugestão e, se caiu no plano B, por quê. */
export function sourceLine(r: Pick<SuggestResult, "fallback" | "provider" | "modelId" | "error">): string {
  if (r.provider === "mock") return "Fonte: sugestão automática (provedor mock, sem IA).";
  if (!r.fallback) return `Fonte: ${r.provider} · ${r.modelId}`;
  return `Fonte: sugestão automática — ${r.provider} · ${r.modelId} falhou: ${r.error ?? "motivo desconhecido"}`;
}

export function canUndoSuggest() {
  return !!snapshot;
}

export function undoSuggest() {
  if (!snapshot) return;
  const s = useStudio.getState();
  s.setArch(snapshot.arch);
  s.setDb(snapshot.db);
  s.setSuggestNotes([]);
  snapshot = null;
}
