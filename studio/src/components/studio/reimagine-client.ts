"use client";
import { useStudio } from "@/lib/draft/store";
import type { ReimagineResult } from "@/lib/reimagine/reimagine";
import type { ProviderSettings } from "@/lib/ai/settings";

function cleanSettings(s: ProviderSettings): ProviderSettings | undefined {
  const out = Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v === "string" && v.trim())) as ProviderSettings;
  return out.kind ? out : undefined;
}

/** Com várias páginas, a IA fica sabendo qual está desenhando e quais existem. */
export function pageBrief(s: { brief: string; pages: { id: string; name: string }[]; pageId: string }): string {
  const brief = s.brief.trim();
  if (s.pages.length < 2) return brief;
  const page = s.pages.find((p) => p.id === s.pageId)?.name ?? "";
  const site = `Esta é a página "${page}" de um site com as páginas: ${s.pages.map((p) => p.name).join(", ")}. Desenhe só o conteúdo desta página; menu e rodapé são os mesmos em todas.`;
  return brief ? `${brief}\n${site}` : site;
}

type ReimagineJson = ReimagineResult & { error?: string };

/** Valor de Page(...) já usado no site (express da página reimaginada): mantém as páginas iguais. */
function siteChoice(pages: { result: ReimagineResult | null }[], key: "palette" | "theme" | "motion"): string | undefined {
  const re = new RegExp(`${key}\\s*=\\s*"([\\w-]+)"`);
  for (const p of pages) {
    const m = p.result?.express?.match(re);
    if (m) return m[1];
  }
  return undefined;
}

/** Paleta já usada no site: mantém as páginas com a mesma cor. */
export const sitePalette = (pages: { result: ReimagineResult | null }[]) => siteChoice(pages, "palette");
/** Tema já usado no site: mantém as páginas com a mesma tipografia. */
export const siteTheme = (pages: { result: ReimagineResult | null }[]) => siteChoice(pages, "theme");
/** Movimento já usado no site. */
export const siteMotion = (pages: { result: ReimagineResult | null }[]) => siteChoice(pages, "motion");

async function requestReimagine(body: { draft: unknown; brief?: string; palette?: string; theme?: string; motion?: string; settings?: ProviderSettings }): Promise<ReimagineJson> {
  const res = await fetch("/api/reimagine", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json()) as ReimagineJson;
  if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`);
  return json;
}

function paletteFor(s: ReturnType<typeof useStudio.getState>, exceptId?: string): string | undefined {
  if (s.palette !== "auto") return s.palette;
  return sitePalette(s.allPages().filter((p) => p.id !== exceptId));
}

function themeFor(s: ReturnType<typeof useStudio.getState>, exceptId?: string): string | undefined {
  if (s.theme && s.theme !== "auto") return s.theme;
  return siteTheme(s.allPages().filter((p) => p.id !== exceptId));
}

function motionFor(s: ReturnType<typeof useStudio.getState>, exceptId?: string): string | undefined {
  if (s.motion && s.motion !== "auto") return s.motion;
  return siteMotion(s.allPages().filter((p) => p.id !== exceptId));
}

/** Chama /api/reimagine com o rascunho atual. `override` força um provedor (ex.: mock). */
export async function runReimagine(override?: ProviderSettings): Promise<{ error?: string }> {
  const s = useStudio.getState();
  s.setBusy(true);
  try {
    const json = await requestReimagine({
      draft: s.tree,
      brief: pageBrief(s) || undefined,
      palette: paletteFor(s, s.pageId),
      theme: themeFor(s, s.pageId),
      motion: motionFor(s, s.pageId),
      settings: cleanSettings({ ...s.settings, ...override }),
    });
    s.setResult(json);
    s.setTab("landing");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  } finally {
    useStudio.getState().setBusy(false);
  }
}

/**
 * Reimagina todas as páginas, uma de cada vez (o limite por minuto dos
 * provedores gratuitos não aguenta em paralelo). A primeira define a paleta
 * quando ela está em "A IA escolhe"; as outras seguem.
 */
export async function runReimagineAll(onProgress?: (done: number, total: number, name: string) => void): Promise<{ error?: string; failed: string[] }> {
  const s = useStudio.getState();
  const pages = s.allPages();
  const failed: string[] = [];
  let palette = s.palette === "auto" ? undefined : s.palette;
  let theme = !s.theme || s.theme === "auto" ? undefined : s.theme;
  let motion = !s.motion || s.motion === "auto" ? undefined : s.motion;
  s.setBusy(true);
  try {
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      onProgress?.(i, pages.length, page.name);
      try {
        const json = await requestReimagine({
          draft: page.tree,
          brief: pageBrief({ ...s, pageId: page.id }) || undefined,
          palette,
          theme,
          motion,
          settings: cleanSettings(s.settings),
        });
        useStudio.getState().setPageResult(page.id, json);
        palette ??= sitePalette([{ result: json }]);
        theme ??= siteTheme([{ result: json }]);
        motion ??= siteMotion([{ result: json }]);
        if (json.fallback) failed.push(`${page.name} (versão automática: ${json.error ?? "IA indisponível"})`);
      } catch (err) {
        failed.push(`${page.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    onProgress?.(pages.length, pages.length, "");
    useStudio.getState().setTab("landing");
    return { failed, error: failed.length ? `Algumas páginas não saíram com IA: ${failed.join("; ")}` : undefined };
  } finally {
    useStudio.getState().setBusy(false);
  }
}
