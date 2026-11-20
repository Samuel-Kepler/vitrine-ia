// "Preencher fotos": acha os espaços de imagem vazios de uma página e monta
// buscas para o banco de fotos. A IA só traduz o contexto em termos de busca
// em inglês (os bancos indexam em inglês); sem IA, usa o próprio texto.
import { generateText, Output } from "ai";
import { z } from "zod";
import type { DraftNode } from "@/lib/draft/tree";
import { resolveModel } from "@/lib/ai/providers";
import type { ProviderSettings } from "@/lib/ai/settings";
import { friendlyAIError } from "@/lib/ai/errors";

export interface PhotoSlot {
  nodeId: string;
  /** Prop do bloco: hero.image, image.url, menuitem.photo ou gallery.images (com index). */
  key: "image" | "url" | "photo" | "images";
  /** Posição na galeria (uma foto por linha). */
  index?: number;
  /** Contexto em português: título, legenda, descrição. */
  text: string;
}

const lines = (s: string | undefined) => (s ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
/** Único estilo de hero sem espaço de imagem; os demais (centralizado, gradiente, sem estilo...) recebem foto. */
const HERO_NO_IMAGE = "minimal";
/** Galeria sem legendas: quantas fotos sugerir. */
const GALLERY_DEFAULT = 3;
const GALLERY_MAX = 9;

/**
 * Espaços vazios, na ordem da página. Fotos da Equipe ficam de fora de propósito:
 * rosto de banco de imagens no lugar da equipe real engana quem visita o site.
 */
export function photoSlots(draft: DraftNode[]): PhotoSlot[] {
  const out: PhotoSlot[] = [];
  const visit = (ns: DraftNode[]) => {
    for (const n of ns) {
      const p = n.props;
      if (n.type === "hero" && !p.image?.trim() && (p.variant ?? "") !== HERO_NO_IMAGE) {
        out.push({ nodeId: n.id, key: "image", text: [p.title, p.subtitle].filter(Boolean).join(". ") });
      } else if (n.type === "image" && !p.url?.trim()) {
        out.push({ nodeId: n.id, key: "url", text: p.alt || p.caption || "" });
      } else if (n.type === "menuitem" && !p.photo?.trim() && p.name?.trim() && !/^\[.*\]$/.test(p.name.trim())) {
        // Só com nome de produto de verdade; "[produto 1]" não vira busca.
        out.push({ nodeId: n.id, key: "photo", text: [p.name, p.description].filter(Boolean).join(". ") });
      } else if (n.type === "gallery") {
        const have = lines(p.images).length;
        const captions = lines(p.captions);
        const want = Math.min(Math.max(captions.length, GALLERY_DEFAULT), GALLERY_MAX);
        for (let i = have; i < want; i++) out.push({ nodeId: n.id, key: "images", index: i, text: captions[i] ?? "" });
      }
      visit(n.children ?? []);
    }
  };
  visit(draft);
  return out;
}

const QueriesSchema = z.object({ queries: z.array(z.string()) });

const SYSTEM = `You write search queries for a free stock photo site (Openverse/Pexels).
For each numbered slot, return ONE query in ENGLISH with 2 to 4 concrete, photographable words
(objects, place, scene). Use the business brief for context. No brand names, no people's names,
no text/logos. Different slots should get different queries. Return exactly one query per slot, in order.`;

// ---------------- sem IA: glossário português -> inglês ----------------
// Os bancos de fotos indexam em inglês: "Café sendo coado" acha 0 fotos e
// "coffee brewing" acha dezenas. Sem modelo, traduzimos o que for conhecido.

/** Tipo de negócio (procurado no briefing e no texto): vira o termo amplo da busca. */
const BUSINESS: [RegExp, string][] = [
  [/\b(cafeteria|cafe|torrefacao|torra)\b/, "coffee shop"],
  [/\b(padaria|confeitaria)\b/, "bakery"],
  [/\b(pizzaria|pizza)\b/, "pizza"],
  [/\b(hamburgueria|burger)\b/, "burger"],
  [/\b(restaurante|bistro|comida)\b/, "restaurant"],
  [/\b(bar|cervejaria|pub)\b/, "bar"],
  [/\bsorveteria\b/, "ice cream"],
  [/\b(salao|cabelo|cabeleireir\w*|beleza|estetica)\b/, "beauty salon"],
  [/\bbarbearia\b/, "barbershop"],
  [/\b(academia|personal|treino|crossfit)\b/, "gym fitness"],
  [/\b(yoga|pilates)\b/, "yoga"],
  [/\b(clinica|consultorio|saude|fisioterapia)\b/, "clinic"],
  [/\b(dentista|odontologia)\b/, "dentist"],
  [/\b(pet|petshop|veterinari\w*|cachorro|gato)\b/, "pet"],
  [/\b(escola|curso|aula)\b/, "classroom"],
  [/\b(hotel|pousada|hostel)\b/, "hotel"],
  [/\b(floricultura|flores)\b/, "flowers"],
  [/\b(loja|boutique|moda|roupas)\b/, "shop"],
  [/\b(escritorio|advocacia|contabilidade|consultoria)\b/, "office"],
  [/\b(imobiliaria|imoveis|apartamento)\b/, "house interior"],
];

const WORDS: Record<string, string> = {
  cafe: "coffee", xicara: "cup", grao: "beans", graos: "beans", torra: "roasting", torrado: "roasted",
  torradeira: "coffee roaster", coado: "pour over", espresso: "espresso", latte: "latte", leite: "milk", bolo: "cake",
  doce: "dessert", pao: "bread", paes: "bread", croissant: "croissant", pizza: "pizza", forno: "oven",
  massa: "pasta", prato: "dish", comida: "food", cozinha: "kitchen", chef: "chef", vinho: "wine",
  cerveja: "beer", drink: "cocktail", suco: "juice", fruta: "fruit", salada: "salad",
  balcao: "counter", mesa: "table", loja: "shop", interior: "interior", fachada: "storefront",
  ambiente: "ambience", externo: "outdoor", jardim: "garden", varanda: "terrace", salao: "salon",
  equipe: "team", cliente: "customer", barista: "barista", entrega: "delivery", caixa: "box",
  cabelo: "hair", corte: "haircut", unha: "nails", maquiagem: "makeup", spa: "spa", massagem: "massage",
  treino: "workout", academia: "gym", peso: "weights", corrida: "running", yoga: "yoga", bicicleta: "bicycle",
  cachorro: "dog", gato: "cat", flor: "flower", flores: "flowers", livro: "book", sala: "room",
  quarto: "bedroom", piscina: "pool", praia: "beach", montanha: "mountain", cidade: "city", rua: "street",
  escritorio: "office", reuniao: "meeting", computador: "laptop", notebook: "laptop", celular: "smartphone",
  fazenda: "farm", plantacao: "plantation", colheita: "harvest", maquina: "machine", ferramenta: "tools",
  noite: "night", manha: "morning", sol: "sunlight", artesanal: "artisan", fresco: "fresh",
};

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Termo amplo do negócio, achado no briefing (ou no texto da página). */
export function businessTerm(text: string): string {
  const t = fold(text);
  return BUSINESS.find(([re]) => re.test(t))?.[1] ?? "";
}

/** Busca sem IA: palavras conhecidas traduzidas + o tipo de negócio. */
export function glossaryQuery(text: string, business: string): string {
  const out: string[] = [];
  for (const w of fold(text).split(/[^a-z0-9]+/).filter(Boolean)) {
    const en = WORDS[w] ?? WORDS[w.replace(/e?s$/, "")];
    if (en && !out.includes(en)) out.push(en);
  }
  const terms = out.slice(0, 3);
  const head = business.split(" ")[0];
  if (business && !terms.some((t) => t.includes(head))) terms.push(business);
  return terms.join(" ").trim() || text.split(/\s+/).slice(0, 4).join(" ");
}

/** Palavras genéricas: sozinhas não acham foto de nada ("modern", "lighting"...). */
const GENERIC = new Set([
  "a", "an", "the", "of", "in", "on", "at", "to", "for", "with", "and", "or", "by", "from", "is", "are", "our", "its", "some", "very",
  "modern", "interior", "interiors", "lighting", "light", "beautiful", "professional", "close", "up", "view", "shot", "photo", "image",
  "picture", "background", "style", "clean", "nice", "great", "good", "high", "quality", "detail", "details", "wide", "top", "front",
  "side", "empty", "new", "natural", "bright", "simple",
]);

/**
 * Buscas em ordem de amplitude para um espaço cuja busca não achou nada: a completa,
 * as 2 últimas palavras, as 2 primeiras, cada palavra específica e o termo amplo do negócio.
 * Sem repetição (sem diferenciar maiúsculas) e sem buscas só de palavras genéricas.
 */
/**
 * Estilo do Hero depois que o preenchimento automático põe uma foto nele: centralizado,
 * gradiente ou sem estilo viram "Imagem de fundo" (a foto aparece no preview e a IA a mantém).
 * Dividido, minimalista e "A IA escolhe" não mudam.
 */
export function heroVariantWithPhoto(variant: string | undefined): string | undefined {
  if (variant === undefined || variant === "" || variant === "centered" || variant === "gradient") return "image-bg";
  return variant;
}

/** Antes de reimaginar: preenche só se a opção estiver ligada e houver espaço vazio. */
export function shouldAutoFillPhotos(draft: DraftNode[], enabled: boolean): boolean {
  return enabled && photoSlots(draft).length > 0;
}

export function fallbackQueries(query: string, broad?: string): string[] {
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const specific = (w: string) => {
    const k = w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    return k.length >= 3 && !GENERIC.has(k);
  };
  const cands = [words.join(" ")];
  if (words.length > 2) cands.push(words.slice(-2).join(" "), words.slice(0, 2).join(" "));
  for (const w of words) if (specific(w)) cands.push(w);
  if (broad?.trim()) cands.push(broad.trim());
  const seen = new Set<string>();
  return cands.filter((c, i) => {
    const k = c.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return i === 0 || c.split(/\s+/).some(specific);
  });
}

export interface QueriesResult {
  queries: string[];
  /** Busca ampla (tipo de negócio) para quando uma específica não achar nada. */
  broad: string;
  provider: string;
  modelId: string;
  fallback: boolean;
  error?: string;
}

export async function photoQueries(input: { slots: PhotoSlot[]; brief?: string; settings?: ProviderSettings }): Promise<QueriesResult> {
  const brief = input.brief?.trim() ?? "";
  const broad = businessTerm(brief) || businessTerm(input.slots.map((s) => s.text).join(" "));
  const raw = input.slots.map((s) => glossaryQuery(s.text || brief, broad));
  const resolved = resolveModel(input.settings);
  const base = { provider: resolved.kind, modelId: resolved.modelId };
  if (!input.slots.length) return { ...base, queries: [], broad, fallback: false };
  if (resolved.kind === "mock") return { ...base, queries: raw, broad, fallback: true };
  const prompt = [
    brief ? `Business brief: ${brief.slice(0, 600)}` : "",
    "Slots:",
    ...input.slots.map((s, i) => `${i + 1}. ${s.key === "image" ? "hero (main photo)" : s.key === "images" ? "gallery photo" : "photo"}: ${s.text || "(no text)"}`),
  ].join("\n");
  try {
    const res = await generateText({
      model: resolved.model,
      system: SYSTEM,
      prompt,
      output: Output.object({ schema: QueriesSchema }),
      temperature: 0.2,
      maxOutputTokens: 800,
      maxRetries: 2,
      providerOptions: resolved.providerOptions as never,
    });
    const got = (res.output as z.infer<typeof QueriesSchema>).queries.map((q) => q.trim().slice(0, 80));
    // Faltou ou sobrou: completa com o texto cru, posição a posição.
    return { ...base, queries: raw.map((r, i) => got[i] || r), broad, fallback: false };
  } catch (err) {
    return { ...base, queries: raw, broad, fallback: true, error: friendlyAIError(err, resolved.kind, resolved.baseURL) };
  }
}
