"use client";
import { useStudio } from "@/lib/draft/store";
import type { ReimagineResult } from "@/lib/reimagine/reimagine";
import type { ProviderSettings } from "@/lib/ai/settings";

function cleanSettings(s: ProviderSettings): ProviderSettings | undefined {
  const out = Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v === "string" && v.trim())) as ProviderSettings;
  return out.kind ? out : undefined;
}

/** Chama /api/reimagine com o rascunho atual. `override` força um provedor (ex.: mock). */
export async function runReimagine(override?: ProviderSettings): Promise<{ error?: string }> {
  const s = useStudio.getState();
  s.setBusy(true);
  try {
    const res = await fetch("/api/reimagine", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        draft: s.tree,
        brief: s.brief || undefined,
        palette: s.palette === "auto" ? undefined : s.palette,
        settings: cleanSettings({ ...s.settings, ...override }),
      }),
    });
    const json = (await res.json()) as ReimagineResult & { error?: string };
    if (!res.ok) return { error: json.error ?? `Erro ${res.status}` };
    s.setResult(json);
    s.setTab("landing");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  } finally {
    useStudio.getState().setBusy(false);
  }
}
