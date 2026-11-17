// Catálogo A2UI do Vitrine Studio: contrato (zod) dos componentes de landing.
// Este arquivo NÃO importa React: é usado pelo servidor (prompt + validação
// via @a2ui/agent) e pelo navegador (renderer em ./views.tsx).
import { z } from "zod";
import { Catalog, CommonSchemas, basicCatalog } from "@a2ui/web_core/v1_0";

export const CATALOG_ID = "https://vitrine.studio/catalogs/landing/v1/catalog.json";
export const SURFACE_ID = "landing";

export const PALETTES = ["ocean", "sunset", "forest", "grape", "mono"] as const;
export const ICONS = ["sparkles", "zap", "shield", "heart", "clock", "star", "rocket", "check"] as const;
export const TONES = ["default", "muted", "accent", "dark"] as const;

const S = CommonSchemas;

export const PageApi = {
  name: "Page",
  description: "Root wrapper of a landing page. Use exactly once, as root. Sets the color palette.",
  schema: z.object({
    child: S.ComponentId.describe("Id of a Column holding all page sections in order."),
    palette: z.enum(PALETTES).optional().describe("Color palette of the whole page."),
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
    image: S.DynamicString.optional().describe("Image URL (https). Omit if unknown."),
    eyebrow: S.DynamicString.optional().describe("Small label above the headline."),
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
    tone: z.enum(TONES).optional(),
  }),
};

export const GridApi = {
  name: "Grid",
  description: "Responsive grid. Use for features, pricing plans and testimonials.",
  schema: z.object({
    children: S.ChildList,
    columns: z.enum(["2", "3", "4"]).optional(),
  }),
};

export const FeatureApi = {
  name: "Feature",
  description: "Benefit item with icon, title and short text.",
  schema: z.object({
    icon: z.enum(ICONS).optional(),
    title: S.DynamicString,
    text: S.DynamicString,
  }),
};

export const TestimonialApi = {
  name: "Testimonial",
  description: "Customer quote.",
  schema: z.object({
    quote: S.DynamicString,
    author: S.DynamicString,
    role: S.DynamicString.optional(),
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
