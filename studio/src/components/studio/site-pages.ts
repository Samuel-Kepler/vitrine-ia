"use client";
// Páginas do site prontas para exportar (HTML estático ou React): usa o
// resultado do Reimaginar de cada página; as que ainda não têm recebem a
// versão automática do servidor (provedor mock), sem gravar nada no Studio.
import { useStudio } from "@/lib/draft/store";
import { pageFile } from "@/lib/draft/pages";
import { siteMotion, sitePalette, siteTheme } from "./reimagine-client";

export interface SitePage {
  id: string;
  name: string;
  file: string;
  messages: unknown[];
  /** true quando saiu na versão automática (sem Reimaginar). */
  auto: boolean;
}

async function automaticMessages(draft: unknown, palette?: string, theme?: string, motion?: string): Promise<unknown[]> {
  const res = await fetch("/api/reimagine", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ draft, palette, theme, motion, settings: { kind: "mock" } }),
  });
  const json = (await res.json()) as { messages?: unknown[]; error?: string };
  if (!res.ok || !json.messages) throw new Error(json.error ?? `Erro ${res.status}`);
  return json.messages;
}

export async function collectSitePages(): Promise<SitePage[]> {
  const s = useStudio.getState();
  const pages = s.allPages().filter((p) => p.tree.length > 0);
  const palette = s.palette !== "auto" ? s.palette : sitePalette(pages);
  const theme = s.theme && s.theme !== "auto" ? s.theme : siteTheme(pages);
  const motion = s.motion && s.motion !== "auto" ? s.motion : siteMotion(pages);
  const out: SitePage[] = [];
  for (const p of pages) {
    // Imagens do computador ficam como https://asset.invalid/<id>: o HTML resolve no
    // SurfaceView; o projeto React grava os arquivos em public/images (exportAssetFiles).
    const messages = p.result?.messages ?? (await automaticMessages(p.tree, palette, theme, motion));
    out.push({ id: p.id, name: p.name, file: pageFile(pages, p.id), messages, auto: !p.result });
  }
  return out;
}

/** Marca do site (navbar da primeira página), para o título das páginas. */
export function siteBrand(): string | undefined {
  return useStudio.getState().allPages()[0]?.tree.find((n) => n.type === "navbar")?.props.brand;
}
