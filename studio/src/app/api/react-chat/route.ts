import { z } from "zod";
import { ProviderSettingsSchema } from "@/lib/ai/settings";
import { ProviderConfigError } from "@/lib/ai/providers";
import { runReactChat } from "@/lib/react-chat/agent";

export const runtime = "nodejs";
export const maxDuration = 180;

const BodySchema = z.object({
  message: z.string().trim().min(2, "Escreva o que quer mudar.").max(4000),
  files: z.record(z.string().regex(/^\/[\w./-]+$/), z.string().max(200_000)).refine((f) => Object.keys(f).length <= 200, "Arquivos demais."),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) })).max(20).optional(),
  settings: ProviderSettingsSchema.optional(),
});

export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Requisição inválida" }, { status: 400 });
  try {
    const r = await runReactChat(parsed.data);
    console.log(`[react-chat] ${r.provider}/${r.modelId} · ${r.error ? `erro: ${r.error}` : `${r.steps} passos, ${Object.keys(r.changed).length} arquivo(s)`}`);
    return Response.json(r);
  } catch (err) {
    if (err instanceof ProviderConfigError) return Response.json({ error: err.message }, { status: 400 });
    console.error("[react-chat] erro", err);
    return Response.json({ error: err instanceof Error ? err.message : "Erro inesperado" }, { status: 500 });
  }
}
