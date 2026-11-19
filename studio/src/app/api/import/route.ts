import { z } from "zod";
import { ProviderSettingsSchema } from "@/lib/ai/settings";
import { ProviderConfigError } from "@/lib/ai/providers";
import { importSite } from "@/lib/import/import";
import { MAX_IMPORT_PAGES, PageOutlineSchema } from "@/lib/import/outline";

export const runtime = "nodejs";
export const maxDuration = 120;

// Só o esboço (texto) chega aqui: o HTML é lido no navegador.
const BodySchema = z.object({
  outlines: z.array(PageOutlineSchema).min(1, "Escolha ao menos um arquivo .html.").max(MAX_IMPORT_PAGES, `No máximo ${MAX_IMPORT_PAGES} páginas por vez.`),
  brief: z.string().max(2000).optional(),
  settings: ProviderSettingsSchema.optional(),
});

export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Requisição inválida" }, { status: 400 });
  try {
    const r = await importSite(parsed.data);
    console.log(`[import] ${r.provider}/${r.modelId} · ${r.fallback ? `sem IA${r.error ? `: ${r.error}` : ""}` : `${r.pages.length} página(s)`}`);
    return Response.json(r);
  } catch (err) {
    if (err instanceof ProviderConfigError) return Response.json({ error: err.message }, { status: 400 });
    console.error("[import] erro", err);
    return Response.json({ error: err instanceof Error ? err.message : "Erro inesperado" }, { status: 500 });
  }
}
