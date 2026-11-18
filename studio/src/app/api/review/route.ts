import { z } from "zod";
import { DraftSchema } from "@/lib/draft/tree";
import { ArchGraphSchema } from "@/lib/arch/model";
import { ErModelSchema } from "@/lib/db/model";
import { ProviderSettingsSchema } from "@/lib/ai/settings";
import { ProviderConfigError } from "@/lib/ai/providers";
import { REVIEW_MODES, reviewInput } from "@/lib/review/ai-input";
import { aiReview } from "@/lib/review/ai";

export const runtime = "nodejs";
export const maxDuration = 120;

const BodySchema = z.object({
  mode: z.enum(REVIEW_MODES),
  draft: DraftSchema,
  brief: z.string().max(2000).optional(),
  messages: z.array(z.unknown()).max(400).nullable().optional(),
  arch: ArchGraphSchema,
  db: ErModelSchema,
  settings: ProviderSettingsSchema.optional(),
});

export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Requisição inválida: " + parsed.error.issues[0]?.message }, { status: 400 });
  const { mode, settings, ...state } = parsed.data;
  if (!reviewInput(mode, state).trim() || (mode === "landing" && !state.draft.length)) {
    return Response.json({ error: "Nada para revisar ainda neste modo." }, { status: 400 });
  }
  try {
    const r = await aiReview(mode, state, settings);
    console.log(`[review] ${mode} ${r.provider}/${r.modelId} · ${r.fallback ? `regras: ${r.error ?? "mock"}` : `nota ${r.score}`}`);
    return Response.json(r);
  } catch (err) {
    if (err instanceof ProviderConfigError) return Response.json({ error: err.message }, { status: 400 });
    console.error("[review] erro", err);
    return Response.json({ error: err instanceof Error ? err.message : "Erro inesperado" }, { status: 500 });
  }
}
