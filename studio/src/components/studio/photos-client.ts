"use client";
import { compressImage, STOCK_IMAGE_SIDE } from "@/lib/assets/assets";
import { useStudio } from "@/lib/draft/store";
import { findNode } from "@/lib/draft/tree";
import type { Photo, PhotoSource } from "@/lib/photos/photos";
import { heroVariantWithPhoto, shouldAutoFillPhotos, type PhotoSlot } from "@/lib/photos/auto";
import { pageBrief } from "./reimagine-client";

export type { Photo, PhotoSource };

async function json<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Erro ${res.status}`);
  return body;
}

export async function searchStock(q: string, page = 1): Promise<{ source: PhotoSource; photos: Photo[] }> {
  return json(await fetch(`/api/photos?${new URLSearchParams({ q, page: String(page) })}`));
}

/** Baixa pelo servidor, comprime e guarda no projeto. Devolve a URL interna do asset. */
export async function importStock(photo: Pick<Photo, "source" | "id" | "title">): Promise<string> {
  const res = await fetch(`/api/photos/file?${new URLSearchParams({ source: photo.source, id: photo.id })}`);
  if (!res.ok) await json(res);
  const blob = await res.blob();
  const file = new File([blob], `${photo.id}`, { type: blob.type });
  return useStudio.getState().addAsset(await compressImage(file, STOCK_IMAGE_SIDE));
}

export const SOURCE_LABEL: Record<PhotoSource, string> = {
  openverse: "Openverse · só CC0 e domínio público (sem crédito obrigatório)",
  pexels: "Fotos do Pexels (uso livre)",
};

interface AutoResponse {
  slots: PhotoSlot[];
  queries: string[];
  candidates: Photo[][];
  source: PhotoSource;
  fallback?: boolean;
  error?: string;
}

/**
 * Preenche os espaços de imagem vazios da página aberta com fotos do banco.
 * Cada espaço recebe uma foto diferente; se a primeira candidata falhar, tenta a próxima.
 */
export async function autoFillPhotos(onProgress?: (done: number, total: number) => void, opts?: { deadline?: number }): Promise<{ filled: number; total: number; queries: string[]; note?: string }> {
  const s = useStudio.getState();
  const settings = Object.fromEntries(Object.entries(s.settings).filter(([, v]) => typeof v === "string" && v.trim()));
  const signal = opts?.deadline ? AbortSignal.timeout(Math.max(0, opts.deadline - Date.now())) : undefined;
  const r = await json<AutoResponse>(
    await fetch("/api/photos/auto", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ draft: s.tree, brief: pageBrief(s) || undefined, settings: settings.kind ? settings : undefined }),
      signal,
    }),
  );
  const used = new Set<string>();
  // Galeria: as fotos novas entram depois das que já existem, na ordem dos espaços.
  const gallery = new Map<string, string[]>();
  let filled = 0;
  for (let i = 0; i < r.slots.length; i++) {
    // Tempo esgotado: para aqui e guarda o que já entrou (a galeria é fechada abaixo).
    if (opts?.deadline && Date.now() >= opts.deadline) break;
    onProgress?.(i, r.slots.length);
    const slot = r.slots[i];
    for (const photo of r.candidates[i] ?? []) {
      const key = `${photo.source}:${photo.id}`;
      if (used.has(key)) continue;
      used.add(key);
      try {
        const url = await importStock(photo);
        if (slot.key === "images") gallery.set(slot.nodeId, [...(gallery.get(slot.nodeId) ?? []), url]);
        else if (slot.key === "image") {
          // Hero: a foto só aparece se o estilo mostrar imagem (centralizado/gradiente viram imagem de fundo).
          const hero = findNode(useStudio.getState().tree, slot.nodeId);
          useStudio.getState().update(slot.nodeId, { image: url, variant: heroVariantWithPhoto(hero?.props.variant) ?? "" });
        } else useStudio.getState().update(slot.nodeId, { [slot.key]: url });
        filled++;
        break;
      } catch {
        // foto grande demais ou fora do ar: tenta a próxima candidata
      }
    }
  }
  for (const [nodeId, urls] of gallery) {
    const node = findNode(useStudio.getState().tree, nodeId);
    const current = (node?.props.images ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
    useStudio.getState().update(nodeId, { images: [...current, ...urls].join("\n") });
  }
  onProgress?.(r.slots.length, r.slots.length);
  const note = r.fallback ? `Buscas sem IA${r.error ? ` (${r.error})` : ""}: os termos podem ficar menos precisos.` : undefined;
  return { filled, total: r.slots.length, queries: r.queries, note };
}

/** Tempo máximo do preenchimento automático antes de reimaginar (todas as páginas somadas). */
export const AUTO_PHOTOS_BUDGET_MS = 25_000;

/**
 * Antes de reimaginar: preenche os espaços vazios das páginas dadas, com o mesmo caminho do botão.
 * Nunca lança: falha ou tempo esgotado viram só um aviso curto. Devolve a nota (ou undefined).
 */
export async function autoPhotosBeforeReimagine(pageIds: string[]): Promise<string | undefined> {
  const origin = useStudio.getState().pageId;
  if (!useStudio.getState().autoPhotos) return undefined;
  const deadline = Date.now() + AUTO_PHOTOS_BUDGET_MS;
  let filled = 0;
  let total = 0;
  let error: string | undefined;
  useStudio.getState().setBusy(true);
  try {
    for (const id of pageIds) {
      if (Date.now() >= deadline) break;
      // Páginas que já têm fotos (ou não têm espaço vazio) são puladas.
      useStudio.getState().switchPage(id);
      if (!shouldAutoFillPhotos(useStudio.getState().tree, useStudio.getState().autoPhotos)) continue;
      const r = await autoFillPhotos(undefined, { deadline });
      filled += r.filled;
      total += r.total;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  } finally {
    if (useStudio.getState().pageId !== origin) useStudio.getState().switchPage(origin);
    useStudio.getState().setBusy(false);
  }
  if (error) return `Fotos não preenchidas (${error}). Reimaginando sem elas.`;
  if (!total) return undefined;
  const late = Date.now() >= deadline && filled < total ? " Limite de tempo atingido: o resto fica para \"Preencher fotos vazias\"." : "";
  return `${filled} de ${total} foto(s) adicionada(s) antes de reimaginar.${late}`;
}

