// Fotos de banco gratuito para os blocos com imagem (servidor).
// - Openverse (padrão, sem chave): só licenças CC0 e domínio público (PDM), que
//   dispensam crédito e permitem uso comercial.
// - Pexels (se PEXELS_API_KEY estiver no .env): acervo maior e mais "de site";
//   licença Pexels, uso livre sem crédito obrigatório.
// O download é feito pelo id da foto, nunca por uma URL vinda do navegador: o
// servidor não vira proxy aberto (SSRF).

export type PhotoSource = "openverse" | "pexels";

export interface Photo {
  source: PhotoSource;
  id: string;
  /** Miniatura para a grade de escolha. */
  thumb: string;
  width?: number;
  height?: number;
  title: string;
  creator?: string;
  license: string;
  /** Página da foto no banco (para quem quiser dar crédito mesmo sem obrigação). */
  page?: string;
}

type Fetch = typeof fetch;
type Env = Record<string, string | undefined>;

const OPENVERSE = "https://api.openverse.org/v1/images/";
const PEXELS = "https://api.pexels.com/v1/";
/** Original maior que isso é pesado demais para baixar e comprimir no navegador. */
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
const OPENVERSE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PEXELS_ID = /^\d{1,12}$/;
const IMAGE_TYPE = /^image\/(jpeg|png|webp|gif)\b/;

export function photoSource(env: Env = process.env): PhotoSource {
  return env.PEXELS_API_KEY?.trim() ? "pexels" : "openverse";
}

export function isValidPhotoId(source: string, id: string): source is PhotoSource {
  return (source === "openverse" && OPENVERSE_ID.test(id)) || (source === "pexels" && PEXELS_ID.test(id));
}

interface OpenverseImage {
  id: string;
  title?: string;
  url?: string;
  thumbnail?: string;
  width?: number;
  height?: number;
  filesize?: number;
  creator?: string;
  license?: string;
  foreign_landing_url?: string;
}

interface PexelsPhoto {
  id: number;
  width?: number;
  height?: number;
  alt?: string;
  url?: string;
  photographer?: string;
  src?: { large2x?: string; large?: string; medium?: string; tiny?: string };
}

async function getJson<T>(f: Fetch, url: string, headers: Record<string, string> = {}): Promise<T> {
  const res = await f(url, { headers: { accept: "application/json", ...headers }, signal: AbortSignal.timeout(15_000) });
  if (res.status === 429) throw new Error("O banco de fotos limitou as buscas por agora. Espere um pouco e tente de novo.");
  if (!res.ok) throw new Error(`O banco de fotos respondeu ${res.status}.`);
  return (await res.json()) as T;
}

/** Busca fotos. `perPage` até 30. */
export async function searchPhotos(query: string, opts: { perPage?: number; page?: number } = {}, env: Env = process.env, f: Fetch = fetch): Promise<Photo[]> {
  const q = query.trim().slice(0, 100);
  if (!q) return [];
  const perPage = Math.min(Math.max(opts.perPage ?? 18, 1), 30);
  const page = Math.min(Math.max(opts.page ?? 1, 1), 10);
  if (photoSource(env) === "pexels") {
    const url = `${PEXELS}search?${new URLSearchParams({ query: q, per_page: String(perPage), page: String(page) })}`;
    const data = await getJson<{ photos?: PexelsPhoto[] }>(f, url, { authorization: env.PEXELS_API_KEY!.trim() });
    return (data.photos ?? [])
      .filter((p) => p.src?.medium)
      .map((p) => ({ source: "pexels", id: String(p.id), thumb: p.src!.medium!, width: p.width, height: p.height, title: p.alt || q, creator: p.photographer, license: "Pexels", page: p.url }));
  }
  const url = `${OPENVERSE}?${new URLSearchParams({ q, license: "cc0,pdm", category: "photograph", mature: "false", page_size: String(perPage), page: String(page) })}`;
  const data = await getJson<{ results?: OpenverseImage[] }>(f, url);
  return (data.results ?? [])
    .filter((r) => r.thumbnail && r.url && (!r.filesize || r.filesize <= MAX_PHOTO_BYTES))
    .map((r) => ({
      source: "openverse",
      id: r.id,
      thumb: r.thumbnail!,
      width: r.width,
      height: r.height,
      title: r.title || q,
      creator: r.creator,
      license: (r.license ?? "cc0").toUpperCase(),
      page: r.foreign_landing_url,
    }));
}

/** URL do arquivo da foto, descoberta pelo id na API do banco (nunca vinda do cliente). */
async function fileUrl(source: PhotoSource, id: string, env: Env, f: Fetch): Promise<string> {
  if (source === "pexels") {
    const key = env.PEXELS_API_KEY?.trim();
    if (!key) throw new Error("PEXELS_API_KEY não está definida.");
    const p = await getJson<PexelsPhoto>(f, `${PEXELS}photos/${id}`, { authorization: key });
    const url = p.src?.large2x ?? p.src?.large;
    if (!url) throw new Error("Foto sem arquivo.");
    return url;
  }
  const r = await getJson<OpenverseImage>(f, `${OPENVERSE}${id}/`);
  if (r.license && !/^(cc0|pdm)$/i.test(r.license)) throw new Error("Licença da foto não é livre de crédito.");
  if (!r.url) throw new Error("Foto sem arquivo.");
  return r.url;
}

/** Baixa a foto (só https, só imagem, até MAX_PHOTO_BYTES). */
export async function fetchPhoto(source: PhotoSource, id: string, env: Env = process.env, f: Fetch = fetch): Promise<{ bytes: Uint8Array; type: string }> {
  if (!isValidPhotoId(source, id)) throw new Error("Foto inválida.");
  const url = await fileUrl(source, id, env, f);
  if (!url.startsWith("https://")) throw new Error("A foto não está em https.");
  const res = await f(url, { headers: { "user-agent": "VitrineStudio/1.0 (fotos de banco gratuito)" }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Não deu para baixar a foto (${res.status}).`);
  const type = res.headers.get("content-type") ?? "";
  if (!IMAGE_TYPE.test(type)) throw new Error("O arquivo não é uma imagem suportada.");
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_PHOTO_BYTES) throw new Error("Foto grande demais.");
  // Lê em partes e corta se passar do limite (content-length pode faltar ou mentir).
  const reader = res.body!.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_PHOTO_BYTES) {
      await reader.cancel();
      throw new Error("Foto grande demais.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.byteLength;
  }
  return { bytes, type: type.split(";")[0] };
}
