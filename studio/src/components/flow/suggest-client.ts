"use client";
import { useStudio } from "@/lib/draft/store";
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
      body: JSON.stringify({ draft: s.tree, brief: s.brief || undefined, settings: settings.kind ? settings : undefined }),
    });
    const json = (await res.json()) as SuggestResult & { error?: string };
    if (!res.ok) return { error: json.error ?? `Erro ${res.status}` };
    snapshot = { arch: s.arch, db: s.db };
    s.setArch(expandArch(json.suggestion.arch));
    s.setDb(expandDb(json.suggestion.db));
    s.setSuggestNotes([`Fonte: ${json.fallback ? "sugestão automática" : `${json.provider} · ${json.modelId}`}`, ...json.suggestion.notes]);
    s.setFlowSel(null);
    return json.error ? { error: json.error } : {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  } finally {
    useStudio.getState().setBusy(false);
  }
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
