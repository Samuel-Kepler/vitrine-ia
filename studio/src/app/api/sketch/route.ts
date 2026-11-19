import { z } from "zod";
import { ProviderSettingsSchema } from "@/lib/ai/settings";
import { ProviderConfigError } from "@/lib/ai/providers";
import { runSketch } from "@/lib/draft/sketch";
import { MAX_SKETCH_BYTES } from "@/lib/draft/sketch-shared";

export const runtime = "nodejs";
export const maxDuration = 120;

const BodySchema = z
  .object({
    image: z
      .string()
      .max(MAX_SKETCH_BYTES, "Desenho grande demais.")
      .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, "Imagem inválida.")
      .optional(),
    name: z.string().max(200).optional(),
    description: z.string().max(2000).optional(),
    brief: z.string().max(2000).optional(),
    settings: ProviderSettingsSchema.optional(),
  })
  .refine((b) => b.image || b.description?.trim() || b.name?.trim(), "Desenhe algo ou descreva o bloco.");

export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Requisição inválida" }, { status: 400 });
  try {
    const r = await runSketch(parsed.data);
    console.log(`[sketch] ${r.provider}/${r.modelId} · ${r.fallback ? `modelo: ${r.error ?? "mock"}` : `${r.draft.length} blocos`}`);
    return Response.json(r);
  } catch (err) {
    if (err instanceof ProviderConfigError) return Response.json({ error: err.message }, { status: 400 });
    console.error("[sketch] erro", err);
    return Response.json({ error: err instanceof Error ? err.message : "Erro inesperado" }, { status: 500 });
  }
}
