import { z } from "zod";
import { ProviderSettingsSchema } from "@/lib/ai/settings";
import { ProviderConfigError } from "@/lib/ai/providers";
import { generatePage } from "@/lib/draft/generate";

export const runtime = "nodejs";
export const maxDuration = 120;

const BodySchema = z.object({
  prompt: z.string().trim().min(3, "Descreva a página em pelo menos algumas palavras.").max(2000),
  brief: z.string().max(2000).optional(),
  settings: ProviderSettingsSchema.optional(),
});

export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Requisição inválida" }, { status: 400 });
  try {
    const r = await generatePage(parsed.data);
    console.log(`[generate] ${r.provider}/${r.modelId} · ${r.fallback ? `modelo: ${r.error}` : `${r.draft.length} blocos`}`);
    return Response.json(r);
  } catch (err) {
    if (err instanceof ProviderConfigError) return Response.json({ error: err.message }, { status: 400 });
    console.error("[generate] erro", err);
    return Response.json({ error: err instanceof Error ? err.message : "Erro inesperado" }, { status: 500 });
  }
}
