// Temas visuais da landing: tipografia (Google Fonts), cantos, sombras e peso
// dos títulos. Pares de fontes escolhidos com a skill ui-ux-pro-max. A cor
// continua vindo da paleta (lp-ocean, lp-sunset…); o tema é o "jeito".
// Sem imports: usado no catálogo (servidor), no preview e nas exportações.

export const THEMES = ["moderno", "elegante", "editorial", "suave", "tech"] as const;
export type Theme = (typeof THEMES)[number];
export const DEFAULT_THEME: Theme = "moderno";

export interface ThemeDef {
  label: string;
  /** Para o prompt e o seletor: quando usar. */
  hint: string;
  heading: string;
  body: string;
  /** Parâmetro family= do Google Fonts (css2). */
  families: string[];
}

export const THEME_DEFS: Record<Theme, ThemeDef> = {
  moderno: {
    label: "Moderno",
    hint: "limpo e versátil (uso geral, serviços, varejo)",
    heading: "Inter",
    body: "Inter",
    families: ["Inter:wght@400;500;600;700;800"],
  },
  elegante: {
    label: "Elegante",
    hint: "títulos com serifa, refinado (restaurante, café, beleza, hotel, casamento)",
    heading: "Playfair Display",
    body: "Karla",
    families: ["Playfair+Display:wght@500;600;700", "Karla:wght@400;500;600;700"],
  },
  editorial: {
    label: "Editorial",
    hint: "tipografia grande e sóbria, sem sombras (moda, arte, arquitetura, consultoria, escritório)",
    heading: "Libre Bodoni",
    body: "Public Sans",
    families: ["Libre+Bodoni:wght@500;600;700", "Public+Sans:wght@400;500;600;700"],
  },
  suave: {
    label: "Suave",
    hint: "arredondado e acolhedor (infantil, pets, saúde, bem-estar, educação)",
    heading: "Varela Round",
    body: "Nunito Sans",
    families: ["Varela+Round", "Nunito+Sans:wght@400;600;700;800"],
  },
  tech: {
    label: "Tech",
    hint: "geométrico e direto (tecnologia, startup, apps, cursos online)",
    heading: "Space Grotesk",
    body: "DM Sans",
    families: ["Space+Grotesk:wght@500;600;700", "DM+Sans:wght@400;500;600;700"],
  },
};

export const isTheme = (t: unknown): t is Theme => typeof t === "string" && (THEMES as readonly string[]).includes(t);

/** Link do Google Fonts para um tema (ou para todos, no preview do Studio). */
export function fontsHref(themes: readonly Theme[] = THEMES): string {
  const fam = [...new Set(themes.flatMap((t) => THEME_DEFS[t].families))].map((f) => `family=${f}`).join("&");
  return `https://fonts.googleapis.com/css2?${fam}&display=swap`;
}

/** Tags <link> para o <head> de uma página exportada. */
export function fontLinks(theme: Theme): string {
  return `<link rel="preconnect" href="https://fonts.googleapis.com" />\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n<link rel="stylesheet" href="${fontsHref([theme])}" />`;
}

// ---------- variações dos componentes ----------
export const HERO_VARIANTS = ["centered", "split", "image-bg", "gradient", "minimal"] as const;
export const FEATURE_VARIANTS = ["card", "icon-left", "minimal"] as const;
export const GRID_VARIANTS = ["even", "bento"] as const;
export const TESTIMONIAL_VARIANTS = ["card", "quote"] as const;
export const LOGO_VARIANTS = ["static", "marquee"] as const;

/** Movimento da página: none (parado), calm (seções surgem ao rolar), lively (+ sequência, flutuação, faixa rolando). */
export const MOTIONS = ["none", "calm", "lively"] as const;
export type Motion = (typeof MOTIONS)[number];
export const DEFAULT_MOTION: Motion = "calm";
export const MOTION_LABELS: Record<Motion, string> = { none: "Nenhum", calm: "Calmo", lively: "Animado" };
