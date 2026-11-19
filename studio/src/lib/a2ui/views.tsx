"use client";
// Implementações React dos componentes do catálogo (só no navegador:
// @a2ui/react acessa HTMLElement ao ser importado).
import type { ReactNode } from "react";
import { createComponentImplementation } from "@a2ui/react/v0_9";
import { Check, Clock, Heart, Menu, Quote, Rocket, Shield, Sparkles, Star, X, Zap } from "lucide-react";
import {
  FeatureApi,
  FooterApi,
  GridApi,
  HeadingApi,
  HeroApi,
  NavbarApi,
  PageApi,
  PricingCardApi,
  SectionApi,
  TestimonialApi,
  buildCatalog,
} from "./catalog-api";

type Any = any; // tipos do renderer são v0_9; o runtime v1.0 é compatível.
type Build = (id: string, basePath?: string) => ReactNode;

const ICONS: Record<string, typeof Sparkles> = { sparkles: Sparkles, zap: Zap, shield: Shield, heart: Heart, clock: Clock, star: Star, rocket: Rocket, check: Check };

function children(list: unknown, build: Build): ReactNode[] {
  if (!Array.isArray(list)) return [];
  return list.map((c) =>
    typeof c === "string" ? <div key={c}>{build(c)}</div> : <div key={`${c.id}:${c.basePath}`}>{build(c.id, c.basePath)}</div>,
  );
}

const Page = createComponentImplementation(PageApi as Any, ({ props, buildChild }: Any) => (
  <div className={`lp lp-${props.palette ?? "ocean"}`}>{props.child ? buildChild(props.child) : null}</div>
));

// Fecha o menu do celular ao escolher um link (no preview; no HTML exportado a página navega).
const closeMenu = (e: React.MouseEvent<HTMLElement>) => e.currentTarget.closest("details")?.removeAttribute("open");

const Navbar = createComponentImplementation(NavbarApi as Any, ({ props }: Any) => {
  const links: string[] = props.links ?? [];
  return (
    <header className="sticky top-0 z-10 border-b border-black/5 backdrop-blur" style={{ background: "color-mix(in srgb, var(--lp-bg) 88%, transparent)" }}>
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3 @3xl:gap-6 @3xl:px-6 @3xl:py-4">
        <span className="min-w-0 truncate text-lg font-extrabold tracking-tight">{props.brand}</span>
        <div className="ml-auto flex shrink-0 items-center gap-2 @3xl:gap-6">
          <nav className="hidden gap-6 text-sm @3xl:flex" style={{ color: "var(--lp-soft)" }}>
            {links.map((l) => (
              <a key={l} href="#" className="hover:opacity-70">
                {l}
              </a>
            ))}
          </nav>
          {props.cta ? (
            <button className="lp-btn hidden py-2 text-sm @md:inline-flex" onClick={() => props.onCta?.()}>
              {props.cta}
            </button>
          ) : null}
          {links.length || props.cta ? (
            <details className="lp-menu @3xl:hidden">
              <summary aria-label="Abrir menu" className="flex size-11 items-center justify-center rounded-full" style={{ color: "var(--lp-fg)" }}>
                <Menu size={22} className="lp-menu-open" />
                <X size={22} className="lp-menu-close" />
              </summary>
              <nav className="absolute inset-x-0 top-full flex flex-col border-b border-black/5 px-5 pb-4 pt-1 shadow-lg" style={{ background: "var(--lp-bg)" }}>
                {links.map((l) => (
                  <a key={l} href="#" onClick={closeMenu} className="flex min-h-11 items-center border-b border-black/5 text-base font-medium">
                    {l}
                  </a>
                ))}
                {props.cta ? (
                  <button className="lp-btn mt-4 w-full @md:hidden" onClick={(e) => { closeMenu(e); props.onCta?.(); }}>
                    {props.cta}
                  </button>
                ) : null}
              </nav>
            </details>
          ) : null}
        </div>
      </div>
    </header>
  );
});

const Hero = createComponentImplementation(HeroApi as Any, ({ props }: Any) => (
  <section className="relative overflow-hidden">
    <div
      className="pointer-events-none absolute inset-0 opacity-60"
      style={{ background: "radial-gradient(60% 60% at 80% 0%, var(--lp-accent-bg), transparent 70%)" }}
    />
    <div className={`relative mx-auto grid max-w-6xl items-center gap-8 px-5 py-14 @md:py-20 @3xl:gap-12 @3xl:px-6 @3xl:py-24 ${props.image ? "@3xl:grid-cols-2" : ""}`}>
      <div className={`lp-rise ${props.image ? "" : "mx-auto max-w-3xl text-center"}`}>
        {props.eyebrow ? (
          <span className="mb-5 inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider" style={{ background: "var(--lp-accent-bg)", color: "var(--lp-accent)" }}>
            {props.eyebrow}
          </span>
        ) : null}
        <h1 className="text-balance text-[2rem] font-extrabold leading-[1.08] tracking-tight @md:text-4xl @3xl:text-5xl @5xl:text-6xl">{props.title}</h1>
        {props.subtitle ? (
          <p className="mt-4 text-pretty text-base leading-relaxed @md:text-lg @3xl:mt-6 @3xl:text-xl" style={{ color: "var(--lp-soft)" }}>
            {props.subtitle}
          </p>
        ) : null}
        {props.cta ? (
          <div className={`mt-8 flex flex-col gap-3 @md:flex-row @3xl:mt-10 ${props.image ? "" : "justify-center"}`}>
            <button className="lp-btn w-full text-base @md:w-auto" onClick={() => props.onCta?.()}>
              {props.cta}
            </button>
          </div>
        ) : null}
      </div>
      {props.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={props.image} alt="" className="lp-rise aspect-[4/3] w-full rounded-3xl object-cover shadow-2xl" />
      ) : null}
    </div>
  </section>
));

const Heading = createComponentImplementation(HeadingApi as Any, ({ props }: Any) => {
  const level = props.level ?? "2";
  const cls = level === "1" ? "text-3xl @md:text-4xl @3xl:text-5xl" : level === "2" ? "text-2xl @md:text-3xl @3xl:text-4xl" : "text-lg @3xl:text-2xl";
  const Tag = (`h${level}` as "h1" | "h2" | "h3");
  return <Tag className={`${cls} text-balance font-bold tracking-tight ${props.align === "center" ? "text-center" : ""}`}>{props.text}</Tag>;
});

const Section = createComponentImplementation(SectionApi as Any, ({ props, buildChild }: Any) => (
  <section className={`tone-${props.tone ?? "default"} px-5 py-14 @3xl:px-6 @3xl:py-20`}>
    <div className="lp-rise mx-auto max-w-6xl">{props.child ? buildChild(props.child) : null}</div>
  </section>
));

const COLS: Record<string, string> = { "2": "@xl:grid-cols-2", "3": "@xl:grid-cols-2 @3xl:grid-cols-3", "4": "@xl:grid-cols-2 @5xl:grid-cols-4" };
const Grid = createComponentImplementation(GridApi as Any, ({ props, buildChild }: Any) => (
  <div className={`grid gap-4 @3xl:gap-6 ${COLS[props.columns ?? "3"]}`}>{children(props.children, buildChild)}</div>
));

const Feature = createComponentImplementation(FeatureApi as Any, ({ props }: Any) => {
  const Icon = ICONS[props.icon ?? "sparkles"] ?? Sparkles;
  return (
    <div className="lp-card h-full p-5 @3xl:p-6">
      <div className="mb-4 inline-flex size-11 items-center justify-center rounded-xl" style={{ background: "var(--lp-accent-bg)", color: "var(--lp-accent)" }}>
        <Icon size={22} />
      </div>
      <h3 className="text-lg font-semibold">{props.title}</h3>
      <p className="mt-2 leading-relaxed" style={{ color: "var(--lp-soft)" }}>
        {props.text}
      </p>
    </div>
  );
});

const Testimonial = createComponentImplementation(TestimonialApi as Any, ({ props }: Any) => (
  <figure className="lp-card h-full p-5 @3xl:p-6">
    <Quote size={22} style={{ color: "var(--lp-accent)" }} />
    <blockquote className="mt-3 text-base leading-relaxed @3xl:text-lg">“{props.quote}”</blockquote>
    <figcaption className="mt-4 text-sm">
      <strong>{props.author}</strong>
      {props.role ? <span style={{ color: "var(--lp-soft)" }}> · {props.role}</span> : null}
    </figcaption>
  </figure>
));

const PricingCard = createComponentImplementation(PricingCardApi as Any, ({ props }: Any) => (
  <div
    className="lp-card flex h-full flex-col p-6 @3xl:p-7"
    style={props.highlighted ? { borderColor: "var(--lp-accent)", boxShadow: "0 20px 50px -25px var(--lp-accent)" } : undefined}
  >
    <div className="flex items-center justify-between">
      <h3 className="text-lg font-semibold">{props.name}</h3>
      {props.highlighted ? (
        <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: "var(--lp-accent)", color: "var(--lp-accent-fg)" }}>
          Popular
        </span>
      ) : null}
    </div>
    <p className="mt-4">
      <span className="text-3xl font-extrabold tracking-tight @3xl:text-4xl">{props.price}</span>
      {props.period ? <span style={{ color: "var(--lp-soft)" }}> {props.period}</span> : null}
    </p>
    <ul className="mt-6 flex-1 space-y-2.5">
      {(props.features ?? []).map((f: string) => (
        <li key={f} className="flex items-start gap-2">
          <Check size={18} className="mt-0.5 shrink-0" style={{ color: "var(--lp-accent)" }} />
          <span>{f}</span>
        </li>
      ))}
    </ul>
    <button className={`lp-btn mt-8 w-full ${props.highlighted ? "" : "lp-btn-ghost"}`} onClick={() => props.onCta?.()}>
      {props.cta}
    </button>
  </div>
));

const Footer = createComponentImplementation(FooterApi as Any, ({ props }: Any) => (
  <footer className="tone-dark px-5 py-10 @3xl:px-6">
    <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-center text-sm @3xl:flex-row @3xl:text-left">
      <span style={{ color: "var(--lp-soft)" }}>{props.text}</span>
      <nav className="flex flex-wrap justify-center gap-x-5 gap-y-1">
        {(props.links ?? []).map((l: string) => (
          <a key={l} href="#" className="inline-flex min-h-11 items-center hover:opacity-70">
            {l}
          </a>
        ))}
      </nav>
    </div>
  </footer>
));

export const landingCatalog = buildCatalog([Page, Navbar, Hero, Heading, Section, Grid, Feature, Testimonial, PricingCard, Footer] as Any);
