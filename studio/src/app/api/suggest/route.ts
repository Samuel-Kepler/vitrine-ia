import { z } from "zod";
import { DraftSchema } from "@/lib/draft/tree";
import { ProviderSettingsSchema } from "@/lib/ai/settings";
import { ProviderConfigError } from "@/lib/ai/providers";
import { suggest } from "@/lib/infer/suggest";

export const runtime = "nodejs";
export const maxDuration = 300;

const BodySchema = z.object({
  draft: DraftSchema,
  brief: z.string().max(2000).optional(),
  settings: ProviderSettingsSchema.optional(),
});

export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Requisição inválida: " + parsed.error.issues[0]?.message }, { status: 400 });
  try {
    const r = await suggest(parsed.data);
    console.log(`[suggest] ${r.provider}/${r.modelId} · ${r.fallback ? `fallback: ${r.error}` : "ok"}`);
    return Response.json(r);
  } catch (err) {
    if (err instanceof ProviderConfigError) return Response.json({ error: err.message }, { status: 400 });
    console.error("[suggest] erro", err);
    return Response.json({ error: err instanceof Error ? err.message : "Erro inesperado" }, { status: 500 });
  }
}
