// Catálogo A2UI do Vitrine Studio: contrato (zod) dos componentes de landing.
// Este arquivo NÃO importa React: é usado pelo servidor (prompt + validação
// via @a2ui/agent) e pelo navegador (renderer em ./views.tsx).
import { z } from "zod";
import { Catalog, CommonSchemas, basicCatalog } from "@a2ui/web_core/v1_0";
import { FEATURE_VARIANTS, GRID_VARIANTS, HERO_VARIANTS, LOGO_VARIANTS, MOTIONS, SECTION_ANIMATIONS, TESTIMONIAL_VARIANTS, THEMES } from "./themes";
import { UNSAFE_MEDIA_URL_MESSAGE, isSafeMediaUrl } from "@/lib/security/url";

export const CATALOG_ID = "https://vitrine.studio/catalogs/landing/v1/catalog.json";
export const SURFACE_ID = "landing";

export const PALETTES = ["ocean", "sunset", "forest", "grape", "mono"] as const;
export const ICONS = ["sparkles", "zap", "shield", "heart", "clock", "star", "rocket", "check"] as const;
export const TONES = ["default", "muted", "accent", "dark", "gradient"] as const;

const S = CommonSchemas;

/**
 * URL de imagem vinda da IA. Rejeitar (em vez de limpar) faz o @a2ui/agent
 * devolver o erro ao modelo, que corrige na próxima tentativa. Vale para o
 * preview e para o export. Bindings ({path}) e funções passam: o valor final
 * é checado de novo no export (src/lib/export/sanitize.ts).
 */
const SafeImageUrl = S.DynamicString.refine((v: unknown) => typeof v !== "string" || isSafeMediaUrl(v), {
  message: UNSAFE_MEDIA_URL_MESSAGE,
});
const SafeImageUrlLiteral = z.string().refine(isSafeMediaUrl, { message: UNSAFE_MEDIA_URL_MESSAGE });

export const PageApi = {
  name: "Page",
  description: "Root wrapper of a landing page. Use exactly once, as root. Sets the color palette.",
  schema: z.object({
    child: S.ComponentId.describe("Id of a Column holding all page sections in order."),
    palette: z.enum(PALETTES).optional().describe("Color palette of the whole page."),
    theme: z
      .enum(THEMES)
      .optional()
      .describe("Visual theme (typography, corners, shadows): moderno (general), elegante (serif; food, beauty, hospitality), editorial (big sober type; fashion, art, consulting), suave (rounded; kids, pets, health), tech (geometric; tech, startups)."),
    motion: z
      .enum(MOTIONS)
      .optional()
      .describe("Motion: calm (default; sections fade in on scroll), lively (also staggered grids, floating shapes, scrolling logo strip; kids, events, tech), none (formal, legal, health)."),
  }),
};

export const NavbarApi = {
  name: "Navbar",
  description: "Top navigation bar with brand name, links and an optional call-to-action button.",
  schema: z.object({
    brand: S.DynamicString,
    links: z.array(z.string()).optional().describe("Short link labels."),
    cta: S.DynamicString.optional(),
    onCta: S.Action.optional(),
  }),
};

export const HeroApi = {
  name: "Hero",
  description: "Big landing hero: headline, supporting text, primary button and optional image.",
  schema: z.object({
    title: S.DynamicString,
    subtitle: S.DynamicString.optional(),
    cta: S.DynamicString.optional(),
    onCta: S.Action.optional(),
    image: SafeImageUrl.optional().describe("Image URL (https). Omit if unknown."),
    eyebrow: S.DynamicString.optional().describe("Small label above the headline."),
    variant: z
      .enum(HERO_VARIANTS)
      .optional()
      .describe("Layout: centered (default), split (text + image side by side), image-bg (image behind text; needs image), gradient (bold animated color background), minimal (big left-aligned type, no decoration)."),
  }),
};

export const HeadingApi = {
  name: "Heading",
  description: "Section title. Use instead of Text for headings.",
  schema: z.object({
    text: S.DynamicString,
    level: z.enum(["1", "2", "3"]).optional(),
    align: z.enum(["start", "center"]).optional(),
  }),
};

export const SectionApi = {
  name: "Section",
  description: "Full-width page band with padding and a background tone. Wrap each logical part of the page.",
  schema: z.object({
    child: S.ComponentId.describe("Id of the single child, usually a Column."),
    tone: z.enum(TONES).optional().describe("Background: default, muted, accent, dark, gradient (accent gradient; use at most once, e.g. a call-to-action band)."),
    animation: z
      .enum(SECTION_ANIMATIONS)
      .optional()
      .describe("Entrance animation on scroll: rise (default), slide, zoom (good for galleries/images), blur (soft, elegant), none. Vary along the page; omit to use the default."),
  }),
};

export const GridApi = {
  name: "Grid",
  description: "Responsive grid. Use for features, pricing plans and testimonials.",
  schema: z.object({
    children: S.ChildList,
    columns: z.enum(["2", "3", "4"]).optional(),
    variant: z.enum(GRID_VARIANTS).optional().describe("even (default) or bento (first item larger; good for 3-5 features)."),
  }),
};

export const FeatureApi = {
  name: "Feature",
  description: "Benefit item with icon, title and short text.",
  schema: z.object({
    icon: z.enum(ICONS).optional(),
    title: S.DynamicString,
    text: S.DynamicString,
    variant: z.enum(FEATURE_VARIANTS).optional().describe("card (default), icon-left (lighter list look), minimal (no box). Use the same variant for siblings."),
  }),
};

export const TestimonialApi = {
  name: "Testimonial",
  description: "Customer quote.",
  schema: z.object({
    quote: S.DynamicString,
    author: S.DynamicString,
    role: S.DynamicString.optional(),
    variant: z.enum(TESTIMONIAL_VARIANTS).optional().describe("card (default) or quote (large centered quote; best for a single testimonial)."),
  }),
};

export const PricingCardApi = {
  name: "PricingCard",
  description: "Pricing plan card.",
  schema: z.object({
    name: S.DynamicString,
    price: S.DynamicString,
    period: S.DynamicString.optional(),
    features: z.array(z.string()).optional(),
    cta: S.DynamicString,
    onCta: S.Action,
    highlighted: z.boolean().optional(),
  }),
};

export const StatApi = {
  name: "Stat",
  description: "Highlighted number with a short label (put 2-4 in a Grid). Only with real data from the user/brief; otherwise use bracket placeholders like [número].",
  schema: z.object({ value: S.DynamicString.describe('e.g. "12 anos", "+500"'), label: S.DynamicString }),
};

export const FaqItemApi = {
  name: "FaqItem",
  description: "Frequently asked question that expands on click. Stack several in a Column inside a Section.",
  schema: z.object({ question: S.DynamicString, answer: S.DynamicString }),
};

export const StepApi = {
  name: "Step",
  description: "Numbered step of a 'how it works' (put 3-4 in a Grid, index 1, 2, 3…).",
  schema: z.object({ index: z.string().optional().describe('Step number, e.g. "1"'), title: S.DynamicString, text: S.DynamicString }),
};

export const TeamMemberApi = {
  name: "TeamMember",
  description: "Team member with photo (or initials), name, role and short bio (put several in a Grid). Only with real data from the user/brief; otherwise use bracket placeholders like [número].",
  schema: z.object({
    name: S.DynamicString,
    role: S.DynamicString.optional(),
    bio: S.DynamicString.optional(),
    photo: SafeImageUrl.optional().describe("Photo URL (https) given by the user. Omit if unknown."),
  }),
};

export const ContactInfoApi = {
  name: "ContactInfo",
  description: "Opening hours, address, phone, e-mail and WhatsApp with clickable links. Only with real data from the user/brief; otherwise use bracket placeholders like [número].",
  schema: z.object({
    hours: z.array(z.string()).optional().describe('e.g. ["Seg a sex: 9h às 18h"]'),
    address: S.DynamicString.optional(),
    phone: S.DynamicString.optional(),
    email: S.DynamicString.optional(),
    whatsapp: S.DynamicString.optional(),
  }),
};

export const LogoStripApi = {
  name: "LogoStrip",
  description: "Strip of client/partner names as text logos. Only names the user gave; never invent companies.",
  schema: z.object({
    title: S.DynamicString.optional(),
    names: z.array(z.string()),
    variant: z.enum(LOGO_VARIANTS).optional().describe("static (default) or marquee (endless scrolling strip; good with 5+ names)."),
  }),
};

export const GalleryApi = {
  name: "Gallery",
  description: "Photo grid. Only image URLs the user gave; without URLs it shows placeholders with the captions.",
  schema: z.object({ images: z.array(SafeImageUrlLiteral).describe("Image URLs (https)"), captions: z.array(z.string()).optional() }),
};

export const FooterApi = {
  name: "Footer",
  description: "Page footer with a line of text and link labels.",
  schema: z.object({
    text: S.DynamicString,
    links: z.array(z.string()).optional(),
  }),
};

export const CUSTOM_APIS = [
  PageApi,
  NavbarApi,
  HeroApi,
  HeadingApi,
  SectionApi,
  GridApi,
  FeatureApi,
  TestimonialApi,
  PricingCardApi,
  StatApi,
  FaqItemApi,
  StepApi,
  TeamMemberApi,
  ContactInfoApi,
  LogoStripApi,
  GalleryApi,
  FooterApi,
] as const;

/** Componentes do catálogo básico que a IA pode usar junto com os nossos. */
export const BASIC_ALLOWED = ["Column", "Row", "Text", "Button", "Card", "Image", "Divider", "TextField", "Icon"];

export type CatalogItem = { name: string };

/**
 * Monta o catálogo v1.0. No servidor passe as APIs (zod puro); no navegador,
 * as implementações React criadas com `createComponentImplementation`.
 */
export function buildCatalog(custom: readonly CatalogItem[]): Catalog<any> {
  const basic = basicCatalog as any;
  const customNames = new Set(custom.map((c) => c.name));
  const basicComponents = [...basic.components.values()].filter((c: CatalogItem) => !customNames.has(c.name));
  return new Catalog(CATALOG_ID, "1.0", [...basicComponents, ...custom] as any, [...basic.functions.values()] as any);
}
