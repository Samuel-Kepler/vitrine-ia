import { fetchPhoto, isValidPhotoId } from "@/lib/photos/photos";

export const runtime = "nodejs";

/**
 * GET /api/photos/file?source=openverse&id=<uuid> — baixa a foto pelo id.
 * O navegador comprime e guarda no projeto, então o export não depende do banco.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const source = url.searchParams.get("source") ?? "";
  const id = url.searchParams.get("id") ?? "";
  if (!isValidPhotoId(source, id)) return Response.json({ error: "Foto inválida." }, { status: 400 });
  try {
    const { bytes, type } = await fetchPhoto(source, id);
    return new Response(bytes as unknown as BodyInit, { headers: { "content-type": type, "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" } });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Erro ao baixar a foto." }, { status: 502 });
  }
}
