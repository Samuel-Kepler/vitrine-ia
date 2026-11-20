import { z } from "zod";
import { DraftSchema } from "@/lib/draft/tree";
import { ProviderSettingsSchema } from "@/lib/ai/settings";
import { ProviderConfigError } from "@/lib/ai/providers";
import { fallbackQueries, photoQueries, photoSlots } from "@/lib/photos/auto";
import { photoSource, searchPhotos, type Photo } from "@/lib/photos/photos";

export const runtime = "nodejs";
export const maxDuration = 120;

const BodySchema = z.object({
  draft: DraftSchema,
  brief: z.string().max(2000).optional(),
  settings: ProviderSettingsSchema.optional(),
});

/** Buscas distintas por pedido: o Openverse sem chave limita a frequência. */
const MAX_QUERIES = 8;
/** Teto de buscas por pedido, contando as de reserva (busca sem resultado). */
const MAX_SEARCHES = 20;

/**
 * POST /api/photos/auto — espaços vazios da página + candidatas para cada um.
 * Quem escolhe e baixa é o navegador (uma foto diferente por espaço).
 */
export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Requisição inválida: " + parsed.error.issues[0]?.message }, { status: 400 });
  const slots = photoSlots(parsed.data.draft);
  if (!slots.length) return Response.json({ slots: [], queries: [], candidates: [], source: photoSource() });
  try {
    const q = await photoQueries({ slots, brief: parsed.data.brief, settings: parsed.data.settings });
    const distinct = [...new Set(q.queries)].slice(0, MAX_QUERIES);
    // Cache por termo: um termo de reserva repetido em vários espaços é buscado uma vez só.
    const cache = new Map<string, Photo[]>();
    let attempts = 0;
    const search = async (query: string) => {
      const hit = cache.get(query);
      if (hit) return hit;
      attempts++;
      const got = await searchPhotos(query, { perPage: 12 });
      cache.set(query, got);
      return got;
    };
    const found = new Map<string, Photo[]>();
    let lastErr: unknown;
    for (const query of distinct) {
      let got: Photo[] = [];
      // Sem resultado ou erro (o Openverse dá 504 de vez em quando): tenta buscas
      // mais amplas (ver fallbackQueries) até achar alguma foto.
      for (const alt of fallbackQueries(query, q.broad)) {
        if (alt !== query && attempts >= MAX_SEARCHES) break;
        try {
          got = await search(alt);
        } catch (err) {
          lastErr = err;
          got = [];
        }
        if (got.length) break;
      }
      found.set(query, got);
    }
    // A busca ampla do negócio entra no fim de cada lista como reserva: cobre busca
    // sem resultado, fora do limite, ou cujas fotos já foram usadas/falharam no download.
    const broad = q.broad ? await searchPhotos(q.broad, { perPage: 30 }).catch(() => [] as Photo[]) : [];
    // Nenhuma busca respondeu: devolve o erro em vez de "0 fotos".
    if (lastErr && !cache.size && !broad.length) throw lastErr;
    const candidates = q.queries.map((query) => [...(found.get(query) ?? []), ...broad]);
    console.log(`[photos] ${slots.length} espaço(s) · ${distinct.length} busca(s) · ${q.provider}/${q.modelId}${q.fallback ? " (sem IA)" : ""}`);
    return Response.json({ slots, queries: q.queries, candidates, source: photoSource(), fallback: q.fallback, error: q.error });
  } catch (err) {
    if (err instanceof ProviderConfigError) return Response.json({ error: err.message }, { status: 400 });
    return Response.json({ error: err instanceof Error ? err.message : "Erro ao buscar fotos." }, { status: 502 });
  }
}
