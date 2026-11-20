import { photoSource, searchPhotos } from "@/lib/photos/photos";

export const runtime = "nodejs";

/** GET /api/photos?q=café&page=1 — busca no banco de fotos gratuito. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q || q.length > 100) return Response.json({ error: "Informe uma busca de até 100 caracteres." }, { status: 400 });
  const page = Number(url.searchParams.get("page") ?? 1) || 1;
  try {
    return Response.json({ source: photoSource(), photos: await searchPhotos(q, { page }) });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Erro na busca." }, { status: 502 });
  }
}
