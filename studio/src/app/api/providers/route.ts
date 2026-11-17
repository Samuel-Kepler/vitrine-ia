import { listLocalModels, serverStatus } from "@/lib/ai/providers";
import { PROVIDER_KINDS, type ProviderKind } from "@/lib/ai/settings";

export const runtime = "nodejs";

/** GET → padrões do servidor. GET ?kind=ollama&baseURL=... → modelos locais. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") as ProviderKind | null;
  if (!kind) return Response.json(serverStatus());
  if (!PROVIDER_KINDS.includes(kind)) return Response.json({ error: "Provedor desconhecido" }, { status: 400 });
  try {
    const models = await listLocalModels(kind, url.searchParams.get("baseURL") ?? undefined);
    return Response.json({ ok: true, models });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const friendly = /fetch failed|ECONNREFUSED|timeout|aborted/i.test(msg)
      ? `Nenhum servidor respondeu${kind === "ollama" ? " (o Ollama está aberto?)" : ""}. Confira a URL.`
      : msg;
    return Response.json({ ok: false, models: [], error: friendly });
  }
}
