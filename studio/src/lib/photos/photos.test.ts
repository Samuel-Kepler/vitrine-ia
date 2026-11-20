import { describe, expect, it } from "vitest";
import { createNode } from "@/lib/draft/tree";
import { fetchPhoto, isValidPhotoId, MAX_PHOTO_BYTES, photoSource, searchPhotos } from "./photos";
import { fallbackQueries, photoQueries, photoSlots } from "./auto";

const OV_ID = "560cadfd-c4dc-44f6-ba6d-7a3af6e9a307";
type Call = { url: string; headers: Record<string, string> };

function fakeFetch(routes: Record<string, () => Response>, calls: Call[] = []) {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    const hit = Object.keys(routes).find((k) => url.startsWith(k));
    return hit ? routes[hit]() : new Response("não achei", { status: 404 });
  }) as typeof fetch;
}
const json = (v: unknown) => () => Response.json(v);
const image = (bytes: number, type = "image/jpeg", headers: Record<string, string> = {}) => () =>
  new Response(new Uint8Array(bytes), { headers: { "content-type": type, ...headers } });

describe("searchPhotos", () => {
  it("Openverse sem chave: pede só CC0/PDM e fotografias, e descarta arquivos gigantes", async () => {
    const calls: Call[] = [];
    const f = fakeFetch(
      {
        "https://api.openverse.org/v1/images/?": json({
          results: [
            { id: OV_ID, title: "Coffee", url: "https://upload.wikimedia.org/a.jpg", thumbnail: "https://api.openverse.org/t/1", width: 800, height: 600, license: "cc0", creator: "Ana" },
            { id: "x", title: "Enorme", url: "https://x/b.jpg", thumbnail: "https://t/2", filesize: MAX_PHOTO_BYTES + 1 },
          ],
        }),
      },
      calls,
    );
    const r = await searchPhotos("coffee shop", {}, {}, f);
    expect(new URL(calls[0].url).searchParams.get("license")).toBe("cc0,pdm");
    expect(new URL(calls[0].url).searchParams.get("category")).toBe("photograph");
    expect(r).toEqual([expect.objectContaining({ source: "openverse", id: OV_ID, thumb: "https://api.openverse.org/t/1", license: "CC0" })]);
  });

  it("com PEXELS_API_KEY usa o Pexels com a chave no cabeçalho", async () => {
    const calls: Call[] = [];
    const f = fakeFetch({ "https://api.pexels.com/v1/search": json({ photos: [{ id: 42, alt: "Latte", photographer: "Bia", src: { medium: "https://images.pexels.com/m.jpg" } }] }) }, calls);
    const env = { PEXELS_API_KEY: "chave" };
    expect(photoSource(env)).toBe("pexels");
    const r = await searchPhotos("latte", {}, env, f);
    expect(calls[0].headers.authorization).toBe("chave");
    expect(r[0]).toMatchObject({ source: "pexels", id: "42", title: "Latte", creator: "Bia" });
  });

  it("limite do banco vira mensagem clara", async () => {
    const f = fakeFetch({ "https://api.openverse.org": () => new Response("", { status: 429 }) });
    await expect(searchPhotos("x", {}, {}, f)).rejects.toThrow(/limitou/);
  });
});

describe("fetchPhoto", () => {
  const meta = (url: string, license = "cc0") => json({ id: OV_ID, url, license });

  it("baixa pelo id (a URL vem da API do banco, não do cliente)", async () => {
    const f = fakeFetch({ [`https://api.openverse.org/v1/images/${OV_ID}/`]: meta("https://upload.wikimedia.org/a.jpg"), "https://upload.wikimedia.org/": image(1000) });
    const r = await fetchPhoto("openverse", OV_ID, {}, f);
    expect(r.type).toBe("image/jpeg");
    expect(r.bytes.byteLength).toBe(1000);
  });

  it("recusa id inválido, licença com crédito, http, não-imagem e arquivo grande", async () => {
    expect(isValidPhotoId("openverse", "../../etc")).toBe(false);
    expect(isValidPhotoId("pexels", "12a")).toBe(false);
    expect(isValidPhotoId("outro", OV_ID)).toBe(false);
    await expect(fetchPhoto("openverse", "abc", {}, fakeFetch({}))).rejects.toThrow(/inválida/);
    const base = `https://api.openverse.org/v1/images/${OV_ID}/`;
    await expect(fetchPhoto("openverse", OV_ID, {}, fakeFetch({ [base]: meta("https://x/a.jpg", "by") }))).rejects.toThrow(/crédito/);
    await expect(fetchPhoto("openverse", OV_ID, {}, fakeFetch({ [base]: meta("http://x/a.jpg") }))).rejects.toThrow(/https/);
    await expect(fetchPhoto("openverse", OV_ID, {}, fakeFetch({ [base]: meta("https://x/a.svg"), "https://x/": image(10, "image/svg+xml") }))).rejects.toThrow(/imagem/);
    await expect(
      fetchPhoto("openverse", OV_ID, {}, fakeFetch({ [base]: meta("https://x/a.jpg"), "https://x/": image(MAX_PHOTO_BYTES + 1, "image/jpeg", { "content-length": "1" }) })),
    ).rejects.toThrow(/grande/);
  });
});

describe("photoSlots", () => {
  const node = (type: Parameters<typeof createNode>[0], props: Record<string, string>) => {
    const n = createNode(type);
    n.props = { ...n.props, ...props };
    return n;
  };

  it("hero sem foto (estilos com imagem), imagem sem URL e galeria até o número de legendas", () => {
    const hero = node("hero", { title: "Café fresco", subtitle: "Torra semanal", image: "", variant: "split" });
    const centered = node("hero", { title: "Outro", image: "", variant: "centered" });
    const img = node("image", { url: "", alt: "Balcão da loja" });
    const gallery = node("gallery", { images: "https://a/1.jpg", captions: "Balcão\nTorra\nGrãos\nMesa" });
    const team = node("team", { photo: "" });
    const slots = photoSlots([hero, centered, img, gallery, team]);
    expect(slots.map((s) => `${s.key}${s.index ?? ""}:${s.text}`)).toEqual(["image:Café fresco. Torra semanal", "url:Balcão da loja", "images1:Torra", "images2:Grãos", "images3:Mesa"]);
  });

  it("galeria sem legendas pede 3 fotos; fotos da equipe nunca", () => {
    expect(photoSlots([node("gallery", { images: "", captions: "" })])).toHaveLength(3);
    expect(photoSlots([node("team", { photo: "" })])).toEqual([]);
  });

  it("sem IA (mock): usa o próprio texto, curto", async () => {
    const slots = photoSlots([node("image", { url: "", alt: "Balcão da loja com xícaras. Luz natural" })]);
    const r = await photoQueries({ slots, settings: { kind: "mock" } });
    expect(r.queries).toEqual(["counter shop cup"]);
  });
});

describe("buscas sem IA (glossário)", () => {
  it("traduz termos comuns e junta o tipo de negócio do briefing", async () => {
    const { businessTerm, glossaryQuery } = await import("./auto");
    const biz = businessTerm("Torra Viva, cafeteria e torrefação artesanal em BH");
    expect(biz).toBe("coffee shop");
    expect(glossaryQuery("Café sendo coado", biz)).toBe("coffee pour over");
    expect(glossaryQuery("Grãos selecionados", biz)).toBe("beans coffee shop");
    expect(glossaryQuery("Interior da loja", biz)).toBe("interior shop coffee shop");
    expect(glossaryQuery("Ambiente externo", "")).toBe("ambience outdoor");
    expect(businessTerm("Studio de pilates no Leblon")).toBe("yoga");
    expect(businessTerm("algo sem negócio conhecido")).toBe("");
  });
});

describe("fallbackQueries (buscas de reserva para espaços sem foto)", () => {
  it("vai da busca completa para as mais amplas, sem repetir e sem buscas só genéricas", () => {
    expect(fallbackQueries("modern barbershop interior lighting", "barbershop")).toEqual([
      "modern barbershop interior lighting",
      "modern barbershop",
      "barbershop",
    ]);
  });

  it("começa pela busca completa e inclui o termo específico", () => {
    const r = fallbackQueries("modern barbershop interior lighting", "barbershop");
    expect(r[0]).toBe("modern barbershop interior lighting");
    expect(r).toContain("barbershop");
    expect(r).not.toContain("lighting");
  });

  it("acrescenta o termo amplo do negócio no fim, se for diferente", () => {
    expect(fallbackQueries("modern barbershop interior lighting", "coffee shop")).toEqual([
      "modern barbershop interior lighting",
      "modern barbershop",
      "barbershop",
      "coffee shop",
    ]);
  });

  it("deduplica sem diferenciar maiúsculas e ignora termo amplo vazio", () => {
    expect(fallbackQueries("Barbershop", "barbershop")).toEqual(["Barbershop"]);
    expect(fallbackQueries("coffee beans", "  ")).toEqual(["coffee beans", "coffee", "beans"]);
  });

  it("consulta só genérica continua valendo como primeira tentativa; vazio não gera nada", () => {
    expect(fallbackQueries("modern lighting")).toEqual(["modern lighting"]);
    expect(fallbackQueries("   ")).toEqual([]);
  });
});

describe("store: várias fotos chegando antes de entrar no bloco", () => {
  it("addAsset em sequência não apaga as anteriores ainda não usadas", async () => {
    const { useStudio } = await import("@/lib/draft/store");
    const s = useStudio.getState();
    const urls = ["data:image/webp;base64,AAA", "data:image/webp;base64,BBB", "data:image/webp;base64,CCC"].map((d) => s.addAsset(d));
    const ids = urls.map((u) => u.replace("https://asset.invalid/", ""));
    expect(ids.every((id) => id in useStudio.getState().assets)).toBe(true);
  });
});
