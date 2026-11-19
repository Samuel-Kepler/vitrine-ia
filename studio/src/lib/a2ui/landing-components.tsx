// Componentes da landing em React puro (sem A2UI, sem imports do Studio).
// São usados pelo preview do Studio (views.tsx embrulha cada um no catálogo
// A2UI) e copiados tal e qual para o projeto React exportado: o que aparece no
// preview é exatamente o que vai no código. Só depende de react e lucide-react.
import { useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import { Check, Clock, Heart, Menu, Quote, Rocket, Shield, Sparkles, Star, X, Zap } from "lucide-react";

export const ICONS: Record<string, typeof Sparkles> = { sparkles: Sparkles, zap: Zap, shield: Shield, heart: Heart, clock: Clock, star: Star, rocket: Rocket, check: Check };

type Children = { children?: ReactNode };

export function Page({ palette = "ocean", children }: { palette?: string } & Children) {
  return <div className={`lp lp-${palette}`}>{children}</div>;
}

// Fecha o menu do celular ao escolher um link.
const closeMenu = (e: MouseEvent<HTMLElement>) => e.currentTarget.closest("details")?.removeAttribute("open");

export function Navbar({ brand, links = [], hrefs = [], cta, onCta }: { brand?: string; links?: string[]; hrefs?: string[]; cta?: string; onCta?: () => void }) {
  const href = (i: number) => hrefs[i] ?? "#";
  return (
    <header className="sticky top-0 z-10 border-b border-black/5 backdrop-blur" style={{ background: "color-mix(in srgb, var(--lp-bg) 88%, transparent)" }}>
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3 @3xl:gap-6 @3xl:px-6 @3xl:py-4">
        <span className="min-w-0 truncate text-lg font-extrabold tracking-tight">{brand}</span>
        <div className="ml-auto flex shrink-0 items-center gap-2 @3xl:gap-6">
          <nav className="hidden gap-6 text-sm @3xl:flex" style={{ color: "var(--lp-soft)" }}>
            {links.map((l, i) => (
              <a key={l} href={href(i)} className="hover:opacity-70">
                {l}
              </a>
            ))}
          </nav>
          {cta ? (
            <button className="lp-btn hidden py-2 text-sm @md:inline-flex" onClick={() => onCta?.()}>
              {cta}
            </button>
          ) : null}
          {links.length || cta ? (
            <details className="lp-menu @3xl:hidden">
              <summary aria-label="Abrir menu" className="flex size-11 items-center justify-center rounded-full" style={{ color: "var(--lp-fg)" }}>
                <Menu size={22} className="lp-menu-open" />
                <X size={22} className="lp-menu-close" />
              </summary>
              <nav className="absolute inset-x-0 top-full flex flex-col border-b border-black/5 px-5 pb-4 pt-1 shadow-lg" style={{ background: "var(--lp-bg)" }}>
                {links.map((l, i) => (
                  <a key={l} href={href(i)} onClick={closeMenu} className="flex min-h-11 items-center border-b border-black/5 text-base font-medium">
                    {l}
                  </a>
                ))}
                {cta ? (
                  <button
                    className="lp-btn mt-4 w-full @md:hidden"
                    onClick={(e) => {
                      closeMenu(e);
                      onCta?.();
                    }}
                  >
                    {cta}
                  </button>
                ) : null}
              </nav>
            </details>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export function Hero({ title, subtitle, cta, onCta, image, eyebrow }: { title?: string; subtitle?: string; cta?: string; onCta?: () => void; image?: string; eyebrow?: string }) {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: "radial-gradient(60% 60% at 80% 0%, var(--lp-accent-bg), transparent 70%)" }} />
      <div className={`relative mx-auto grid max-w-6xl items-center gap-8 px-5 py-14 @md:py-20 @3xl:gap-12 @3xl:px-6 @3xl:py-24 ${image ? "@3xl:grid-cols-2" : ""}`}>
        <div className={`lp-rise ${image ? "" : "mx-auto max-w-3xl text-center"}`}>
          {eyebrow ? (
            <span className="mb-5 inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider" style={{ background: "var(--lp-accent-bg)", color: "var(--lp-accent)" }}>
              {eyebrow}
            </span>
          ) : null}
          <h1 className="text-balance text-[2rem] font-extrabold leading-[1.08] tracking-tight @md:text-4xl @3xl:text-5xl @5xl:text-6xl">{title}</h1>
          {subtitle ? (
            <p className="mt-4 text-pretty text-base leading-relaxed @md:text-lg @3xl:mt-6 @3xl:text-xl" style={{ color: "var(--lp-soft)" }}>
              {subtitle}
            </p>
          ) : null}
          {cta ? (
            <div className={`mt-8 flex flex-col gap-3 @md:flex-row @3xl:mt-10 ${image ? "" : "justify-center"}`}>
              <button className="lp-btn w-full text-base @md:w-auto" onClick={() => onCta?.()}>
                {cta}
              </button>
            </div>
          ) : null}
        </div>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="lp-rise aspect-[4/3] w-full rounded-3xl object-cover shadow-2xl" />
        ) : null}
      </div>
    </section>
  );
}

export function Heading({ text, level = "2", align }: { text?: string; level?: string; align?: string }) {
  const cls = level === "1" ? "text-3xl @md:text-4xl @3xl:text-5xl" : level === "2" ? "text-2xl @md:text-3xl @3xl:text-4xl" : "text-lg @3xl:text-2xl";
  const Tag = `h${level === "1" || level === "3" ? level : "2"}` as "h1" | "h2" | "h3";
  return <Tag className={`${cls} text-balance font-bold tracking-tight ${align === "center" ? "text-center" : ""}`}>{text}</Tag>;
}

export function Section({ tone = "default", children }: { tone?: string } & Children) {
  return (
    <section className={`tone-${tone} px-5 py-14 @3xl:px-6 @3xl:py-20`}>
      <div className="lp-rise mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

const COLS: Record<string, string> = { "2": "@xl:grid-cols-2", "3": "@xl:grid-cols-2 @3xl:grid-cols-3", "4": "@xl:grid-cols-2 @5xl:grid-cols-4" };
export function Grid({ columns = "3", children }: { columns?: string } & Children) {
  return <div className={`grid gap-4 @3xl:gap-6 ${COLS[columns] ?? COLS["3"]}`}>{children}</div>;
}

export function Feature({ icon = "sparkles", title, text }: { icon?: string; title?: string; text?: string }) {
  const Icon = ICONS[icon] ?? Sparkles;
  return (
    <div className="lp-card h-full p-5 @3xl:p-6">
      <div className="mb-4 inline-flex size-11 items-center justify-center rounded-xl" style={{ background: "var(--lp-accent-bg)", color: "var(--lp-accent)" }}>
        <Icon size={22} />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 leading-relaxed" style={{ color: "var(--lp-soft)" }}>
        {text}
      </p>
    </div>
  );
}

export function Testimonial({ quote, author, role }: { quote?: string; author?: string; role?: string }) {
  return (
    <figure className="lp-card h-full p-5 @3xl:p-6">
      <Quote size={22} style={{ color: "var(--lp-accent)" }} />
      <blockquote className="mt-3 text-base leading-relaxed @3xl:text-lg">“{quote}”</blockquote>
      <figcaption className="mt-4 text-sm">
        <strong>{author}</strong>
        {role ? <span style={{ color: "var(--lp-soft)" }}> · {role}</span> : null}
      </figcaption>
    </figure>
  );
}

export function PricingCard({ name, price, period, features = [], cta, onCta, highlighted }: { name?: string; price?: string; period?: string; features?: string[]; cta?: string; onCta?: () => void; highlighted?: boolean }) {
  return (
    <div className="lp-card flex h-full flex-col p-6 @3xl:p-7" style={highlighted ? { borderColor: "var(--lp-accent)", boxShadow: "0 20px 50px -25px var(--lp-accent)" } : undefined}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{name}</h3>
        {highlighted ? (
          <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: "var(--lp-accent)", color: "var(--lp-accent-fg)" }}>
            Popular
          </span>
        ) : null}
      </div>
      <p className="mt-4">
        <span className="text-3xl font-extrabold tracking-tight @3xl:text-4xl">{price}</span>
        {period ? <span style={{ color: "var(--lp-soft)" }}> {period}</span> : null}
      </p>
      <ul className="mt-6 flex-1 space-y-2.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check size={18} className="mt-0.5 shrink-0" style={{ color: "var(--lp-accent)" }} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <button className={`lp-btn mt-8 w-full ${highlighted ? "" : "lp-btn-ghost"}`} onClick={() => onCta?.()}>
        {cta}
      </button>
    </div>
  );
}

export function Footer({ text, links = [], hrefs = [] }: { text?: string; links?: string[]; hrefs?: string[] }) {
  return (
    <footer className="tone-dark px-5 py-10 @3xl:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-center text-sm @3xl:flex-row @3xl:text-left">
        <span style={{ color: "var(--lp-soft)" }}>{text}</span>
        <nav className="flex flex-wrap justify-center gap-x-5 gap-y-1">
          {links.map((l, i) => (
            <a key={l} href={hrefs[i] ?? "#"} className="inline-flex min-h-11 items-center hover:opacity-70">
              {l}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}

// ---------- Básicos (no Studio vêm do catálogo padrão do A2UI; aqui, versões simples) ----------

export function Column({ children }: Children) {
  return <div className="flex flex-col gap-6">{children}</div>;
}

export function Row({ children }: Children) {
  return <div className="flex flex-wrap items-center gap-4">{children}</div>;
}

export function Text({ children }: Children) {
  return <p className="leading-relaxed">{children}</p>;
}

export function Button({ variant = "primary", type = "button", onClick, children }: { variant?: string; type?: "button" | "submit"; onClick?: () => void } & Children) {
  return (
    <button type={type} onClick={onClick} className={`lp-btn ${variant === "primary" ? "" : "lp-btn-ghost"}`}>
      {children}
    </button>
  );
}

export function Card({ children }: Children) {
  return <div className="lp-card mx-auto w-full max-w-[560px] p-5 @md:p-7">{children}</div>;
}

export function Image({ src, alt = "" }: { src?: string; alt?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={alt} className="w-full rounded-2xl object-cover" /> : <div className="aspect-[4/3] w-full rounded-2xl" style={{ background: "var(--lp-muted-bg)" }} role="img" aria-label={alt} />;
}

export function Divider() {
  return <hr className="border-black/10" />;
}

export function Icon({ name = "sparkles" }: { name?: string }) {
  const I = ICONS[name] ?? Sparkles;
  return <I size={22} style={{ color: "var(--lp-accent)" }} />;
}

export function TextField({ label, name }: { label?: string; name?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      <input
        name={name}
        className="min-h-11 rounded-xl border px-3 text-base outline-none focus:ring-2"
        style={{ borderColor: "color-mix(in srgb, var(--lp-fg) 18%, transparent)", background: "var(--lp-bg)", color: "var(--lp-fg)" }}
      />
    </label>
  );
}

/**
 * Formulário: envia os campos em JSON para o endpoint (ex.: a API gerada pelo
 * Studio). Sem endpoint, só confirma na tela.
 */
export function FormCard({ endpoint, children }: { endpoint?: string } & Children) {
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    if (!endpoint) {
      setStatus("ok");
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
      setStatus(res.ok ? "ok" : "error");
    } catch {
      setStatus("error");
    }
  };
  return (
    <form onSubmit={onSubmit} className="lp-card mx-auto w-full max-w-[560px] p-5 @md:p-7">
      {children}
      {status !== "idle" ? (
        <p className="mt-4 text-sm" role="status" style={{ color: status === "error" ? "#b42318" : "var(--lp-soft)" }}>
          {status === "sending" ? "Enviando…" : status === "ok" ? "Recebido! Obrigado." : "Não deu para enviar agora. Tente de novo."}
        </p>
      ) : null}
    </form>
  );
}
