import { z } from "zod";
import { DraftSchema } from "@/lib/draft/tree";
import { ProviderSettingsSchema } from "@/lib/ai/settings";
import { ProviderConfigError } from "@/lib/ai/providers";
import { photoQueries, photoSlots } from "@/lib/photos/auto";
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
    const found = new Map<string, Photo[]>();
    for (const query of distinct) {
      try {
        found.set(query, await searchPhotos(query, { perPage: 12 }));
      } catch (err) {
        if (!found.size) throw err; // nem a primeira busca deu: devolve o erro
        found.set(query, []);
      }
    }
    // A busca ampla do negócio entra no fim de cada lista como reserva: cobre busca
    // sem resultado, fora do limite, ou cujas fotos já foram usadas/falharam no download.
    const broad = q.broad ? await searchPhotos(q.broad, { perPage: 30 }).catch(() => [] as Photo[]) : [];
    const candidates = q.queries.map((query) => [...(found.get(query) ?? []), ...broad]);
    console.log(`[photos] ${slots.length} espaço(s) · ${distinct.length} busca(s) · ${q.provider}/${q.modelId}${q.fallback ? " (sem IA)" : ""}`);
    return Response.json({ slots, queries: q.queries, candidates, source: photoSource(), fallback: q.fallback, error: q.error });
  } catch (err) {
    if (err instanceof ProviderConfigError) return Response.json({ error: err.message }, { status: 400 });
    return Response.json({ error: err instanceof Error ? err.message : "Erro ao buscar fotos." }, { status: 502 });
  }
}
