import { z } from "zod";
import { DraftSchema } from "@/lib/draft/tree";
import { ProviderSettingsSchema } from "@/lib/ai/settings";
import { ProviderConfigError } from "@/lib/ai/providers";
import { reimagine } from "@/lib/reimagine/reimagine";

export const runtime = "nodejs";
export const maxDuration = 300;

const BodySchema = z.object({
  draft: DraftSchema,
  brief: z.string().max(2000).optional(),
  palette: z.string().max(20).optional(),
  theme: z.string().max(20).optional(),
  motion: z.string().max(20).optional(),
  settings: ProviderSettingsSchema.optional(),
});

export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Requisição inválida: " + parsed.error.issues[0]?.message }, { status: 400 });
  }
  try {
    const result = await reimagine(parsed.data);
    console.log(
      `[reimagine] ${result.provider}/${result.modelId} · tentativas ${result.attempts} · ${result.fallback ? "fallback" : "ok"}` +
        (result.usage ? ` · tokens ${result.usage.inputTokens}/${result.usage.outputTokens}` : ""),
    );
    return Response.json(result);
  } catch (err) {
    if (err instanceof ProviderConfigError) return Response.json({ error: err.message }, { status: 400 });
    console.error("[reimagine] erro", err);
    return Response.json({ error: err instanceof Error ? err.message : "Erro inesperado" }, { status: 500 });
  }
}
