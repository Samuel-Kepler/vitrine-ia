// Componentes da landing em React puro (sem A2UI, sem imports do Studio).
// São usados pelo preview do Studio (views.tsx embrulha cada um no catálogo
// A2UI) e copiados tal e qual para o projeto React exportado: o que aparece no
// preview é exatamente o que vai no código. Só depende de react e lucide-react.
import { useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import { Check, Clock, Heart, Mail, MapPin, Menu, MessageCircle, Phone, Plus, Quote, Rocket, Shield, Sparkles, Star, X, Zap } from "lucide-react";

export const ICONS: Record<string, typeof Sparkles> = { sparkles: Sparkles, zap: Zap, shield: Shield, heart: Heart, clock: Clock, star: Star, rocket: Rocket, check: Check };

type Children = { children?: ReactNode };

/** Raiz: paleta (cores) + tema (tipografia, cantos, sombras) + movimento. */
export function Page({ palette = "ocean", theme = "moderno", motion = "calm", children }: { palette?: string; theme?: string; motion?: string } & Children) {
  return <div className={`lp lp-${palette} lp-theme-${theme} lp-motion-${motion}`}>{children}</div>;
}

// Fecha o menu do celular ao escolher um link.
const closeMenu = (e: MouseEvent<HTMLElement>) => e.currentTarget.closest("details")?.removeAttribute("open");

export function Navbar({ brand, links = [], hrefs = [], cta, onCta }: { brand?: string; links?: string[]; hrefs?: string[]; cta?: string; onCta?: () => void }) {
  const href = (i: number) => hrefs[i] ?? "#";
  return (
    <header className="sticky top-0 z-10 border-b border-black/5 backdrop-blur" style={{ background: "color-mix(in srgb, var(--lp-bg) 88%, transparent)" }}>
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3 @3xl:gap-6 @3xl:px-6 @3xl:py-4">
        <span className="lp-h min-w-0 truncate text-lg">{brand}</span>
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

type HeroProps = { title?: string; subtitle?: string; cta?: string; onCta?: () => void; image?: string; eyebrow?: string; variant?: string };

/**
 * Hero em 5 variações: centered, split (texto + imagem), image-bg (imagem atrás
 * do texto), gradient (fundo de cor animado) e minimal (tipografia grande).
 * Sem variant: split se houver imagem, centered se não.
 */
export function Hero({ title, subtitle, cta, onCta, image, eyebrow, variant }: HeroProps) {
  const v = variant ?? (image ? "split" : "centered");
  const button = cta ? (
    <button className="lp-btn w-full text-base @md:w-auto" onClick={() => onCta?.()}>
      {cta}
    </button>
  ) : null;
  const tag = eyebrow ? <span className="lp-eyebrow mb-5">{eyebrow}</span> : null;

  if (v === "image-bg" || v === "gradient") {
    const photo = v === "image-bg" && image;
    return (
      <section className={`relative overflow-hidden ${photo ? "lp-hero-image" : "lp-hero-gradient"}`} style={photo ? { backgroundImage: `url(${JSON.stringify(image)})` } : undefined}>
        <div className="relative mx-auto max-w-6xl px-5 py-20 @md:py-28 @3xl:px-6 @3xl:py-36">
          <div className="lp-rise max-w-3xl">
            {tag}
            <h1 className="lp-h text-balance text-[2.25rem] leading-[1.05] @md:text-5xl @3xl:text-6xl @5xl:text-7xl">{title}</h1>
            {subtitle ? <p className="mt-5 max-w-2xl text-pretty text-base leading-relaxed @md:text-lg @3xl:text-xl" style={{ color: "var(--lp-soft)" }}>{subtitle}</p> : null}
            {button ? <div className="mt-8 flex flex-col gap-3 @md:flex-row @3xl:mt-10">{button}</div> : null}
          </div>
        </div>
      </section>
    );
  }

  if (v === "minimal") {
    return (
      <section className="border-b border-black/5">
        <div className="lp-rise mx-auto max-w-6xl px-5 pb-12 pt-16 @3xl:px-6 @3xl:pb-20 @3xl:pt-28">
          {tag}
          <h1 className="lp-h max-w-5xl text-balance text-[2.5rem] leading-[1.02] @md:text-6xl @5xl:text-8xl">{title}</h1>
          <div className="mt-8 flex flex-col gap-6 @3xl:mt-12 @3xl:flex-row @3xl:items-end @3xl:justify-between">
            {subtitle ? <p className="max-w-xl text-pretty text-base leading-relaxed @md:text-lg" style={{ color: "var(--lp-soft)" }}>{subtitle}</p> : <span />}
            {button}
          </div>
        </div>
      </section>
    );
  }

  const split = v === "split";
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: "radial-gradient(60% 60% at 80% 0%, var(--lp-accent-bg), transparent 70%)" }} />
      <div className={`relative mx-auto grid max-w-6xl items-center gap-8 px-5 py-14 @md:py-20 @3xl:gap-12 @3xl:px-6 @3xl:py-24 ${split ? "@3xl:grid-cols-2" : ""}`}>
        <div className={`lp-rise ${split ? "" : "mx-auto max-w-3xl text-center"}`}>
          {tag}
          <h1 className="lp-h text-balance text-[2rem] leading-[1.08] @md:text-4xl @3xl:text-5xl @5xl:text-6xl">{title}</h1>
          {subtitle ? (
            <p className="mt-4 text-pretty text-base leading-relaxed @md:text-lg @3xl:mt-6 @3xl:text-xl" style={{ color: "var(--lp-soft)" }}>
              {subtitle}
            </p>
          ) : null}
          {button ? <div className={`mt-8 flex flex-col gap-3 @md:flex-row @3xl:mt-10 ${split ? "" : "justify-center"}`}>{button}</div> : null}
        </div>
        {split ? (
          image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="lp-rise lp-media aspect-[4/3] w-full object-cover" />
          ) : (
            <div className="lp-rise lp-deco aspect-[4/3] w-full" aria-hidden />
          )
        ) : null}
      </div>
    </section>
  );
}

export function Heading({ text, level = "2", align }: { text?: string; level?: string; align?: string }) {
  const cls = level === "1" ? "text-3xl @md:text-4xl @3xl:text-5xl" : level === "2" ? "text-2xl @md:text-3xl @3xl:text-4xl" : "text-lg @3xl:text-2xl";
  const Tag = `h${level === "1" || level === "3" ? level : "2"}` as "h1" | "h2" | "h3";
  return <Tag className={`${cls} lp-h text-balance ${align === "center" ? "text-center" : ""}`}>{text}</Tag>;
}

/** animation: rise (padrão) | slide | zoom | blur | none — CSS ligado à rolagem, ver landing.css. */
export function Section({ tone = "default", animation, children }: { tone?: string; animation?: string } & Children) {
  return (
    <section className={`tone-${tone} ${animation ? `lp-anim-${animation} ` : ""}px-5 py-14 @3xl:px-6 @3xl:py-20`}>
      <div className="lp-reveal mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

const COLS: Record<string, string> = { "2": "@xl:grid-cols-2", "3": "@xl:grid-cols-2 @3xl:grid-cols-3", "4": "@xl:grid-cols-2 @5xl:grid-cols-4" };
/** Grade de colunas iguais, ou bento (o primeiro item ocupa 2x2 a partir de 768px). */
export function Grid({ columns = "3", variant, children }: { columns?: string; variant?: string } & Children) {
  if (variant === "bento") return <div className="lp-bento lp-stagger grid gap-4 @3xl:gap-6">{children}</div>;
  return <div className={`lp-stagger grid gap-4 @3xl:gap-6 ${COLS[columns] ?? COLS["3"]}`}>{children}</div>;
}

/** Benefício: card (padrão), icon-left (ícone ao lado, sem caixa) ou minimal (só um traço em cima). */
export function Feature({ icon = "sparkles", title, text, variant = "card" }: { icon?: string; title?: string; text?: string; variant?: string }) {
  const Icon = ICONS[icon] ?? Sparkles;
  const badge = (
    <div className="lp-icon inline-flex size-11 shrink-0 items-center justify-center" style={{ background: "var(--lp-accent-bg)", color: "var(--lp-accent)" }}>
      <Icon size={22} />
    </div>
  );
  if (variant === "icon-left") {
    return (
      <div className="flex h-full gap-4 py-2">
        {badge}
        <div>
          <h3 className="lp-hf text-lg font-semibold">{title}</h3>
          <p className="mt-1 leading-relaxed" style={{ color: "var(--lp-soft)" }}>
            {text}
          </p>
        </div>
      </div>
    );
  }
  if (variant === "minimal") {
    return (
      <div className="h-full border-t-2 pt-5" style={{ borderColor: "var(--lp-accent)" }}>
        <Icon size={22} style={{ color: "var(--lp-accent)" }} />
        <h3 className="lp-hf mt-3 text-lg font-semibold">{title}</h3>
        <p className="mt-2 leading-relaxed" style={{ color: "var(--lp-soft)" }}>
          {text}
        </p>
      </div>
    );
  }
  return (
    <div className="lp-card h-full p-5 @3xl:p-6">
      <div className="mb-4">{badge}</div>
      <h3 className="lp-hf text-lg font-semibold">{title}</h3>
      <p className="mt-2 leading-relaxed" style={{ color: "var(--lp-soft)" }}>
        {text}
      </p>
    </div>
  );
}

/** Depoimento: card (padrão) ou quote (citação grande centralizada). */
export function Testimonial({ quote, author, role, variant = "card" }: { quote?: string; author?: string; role?: string; variant?: string }) {
  if (variant === "quote") {
    return (
      <figure className="mx-auto max-w-3xl py-4 text-center">
        <Quote size={34} className="mx-auto" style={{ color: "var(--lp-accent)" }} />
        <blockquote className="lp-hf mt-5 text-balance text-2xl leading-snug @3xl:text-3xl">“{quote}”</blockquote>
        <figcaption className="mt-6 text-sm">
          <strong>{author}</strong>
          {role ? <span style={{ color: "var(--lp-soft)" }}> · {role}</span> : null}
        </figcaption>
      </figure>
    );
  }
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
        <h3 className="lp-hf text-lg font-semibold">{name}</h3>
        {highlighted ? (
          <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: "var(--lp-accent)", color: "var(--lp-accent-fg)" }}>
            Popular
          </span>
        ) : null}
      </div>
      <p className="mt-4">
        <span className="lp-h text-3xl @3xl:text-4xl">{price}</span>
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

/** Coluna. flush = sem espaço entre os filhos (a coluna raiz da página: as seções encostam). */
export function Column({ flush, children }: { flush?: boolean } & Children) {
  return <div className={flush ? "flex flex-col" : "flex flex-col gap-6"}>{children}</div>;
}

export function Row({ children }: Children) {
  return <div className="flex flex-wrap items-center gap-4">{children}</div>;
}

export function Text({ children }: Children) {
  return <p className="leading-relaxed">{children}</p>;
}

export function Button({ variant = "primary", type = "button", onClick, children }: { variant?: string; type?: "button" | "submit"; onClick?: () => void } & Children) {
  return (
    <button type={type} onClick={onClick} className={`lp-btn self-start ${variant === "primary" ? "" : "lp-btn-ghost"}`}>
      {children}
    </button>
  );
}

export function Card({ children }: Children) {
  return <div className="lp-card mx-auto w-full max-w-[560px] p-5 @md:p-7">{children}</div>;
}

export function Image({ src, alt = "" }: { src?: string; alt?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={alt} className="lp-img w-full rounded-2xl object-cover" /> : <div className="aspect-[4/3] w-full rounded-2xl" style={{ background: "var(--lp-muted-bg)" }} role="img" aria-label={alt} />;
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

// ---------- Seções extras (números, perguntas, passos, equipe, contato, logos, galeria) ----------

/** Número de destaque: só com números reais do negócio. */
export function Stat({ value, label }: { value?: string; label?: string }) {
  return (
    <div className="text-center">
      <p className="lp-h text-4xl @3xl:text-5xl" style={{ color: "var(--lp-accent)" }}>
        {value}
      </p>
      <p className="mt-2 text-sm leading-snug @3xl:text-base" style={{ color: "var(--lp-soft)" }}>
        {label}
      </p>
    </div>
  );
}

/** Pergunta frequente: abre e fecha com <details> (funciona sem JS no HTML exportado). */
export function FaqItem({ question, answer }: { question?: string; answer?: string }) {
  return (
    <details className="lp-faq border-b" style={{ borderColor: "color-mix(in srgb, var(--lp-fg) 12%, transparent)" }}>
      <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-4 py-4 text-left text-base font-semibold @3xl:text-lg">
        <span>{question}</span>
        <Plus size={20} className="lp-faq-icon shrink-0" style={{ color: "var(--lp-accent)" }} />
      </summary>
      <p className="pb-5 pr-8 leading-relaxed" style={{ color: "var(--lp-soft)" }}>
        {answer}
      </p>
    </details>
  );
}

/** Passo de um "como funciona": número, título e texto. */
export function Step({ index, title, text }: { index?: string; title?: string; text?: string }) {
  return (
    <div className="h-full">
      {index ? (
        <span className="lp-h inline-flex size-11 items-center justify-center rounded-full text-lg" style={{ background: "var(--lp-accent)", color: "var(--lp-accent-fg)" }}>
          {index}
        </span>
      ) : null}
      <h3 className="lp-hf mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 leading-relaxed" style={{ color: "var(--lp-soft)" }}>
        {text}
      </p>
    </div>
  );
}

const initials = (name = "") =>
  name
    .replace(/[[\]]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

/** Item de cardápio: foto opcional, nome, preço alinhado à direita e descrição curta. */
export function MenuItem({ name, price, description, photo }: { name?: string; price?: string; description?: string; photo?: string }) {
  return (
    <div className="flex h-full items-start gap-4">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt={name ?? ""} className="size-20 shrink-0 rounded-xl object-cover" />
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <h3 className="lp-hf text-lg font-semibold">{name}</h3>
          <span className="min-w-4 flex-1 border-b border-dotted" style={{ borderColor: "var(--lp-soft)", opacity: 0.5 }} aria-hidden />
          {price ? (
            <span className="lp-hf shrink-0 font-semibold" style={{ color: "var(--lp-accent)" }}>
              {price}
            </span>
          ) : null}
        </div>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--lp-soft)" }}>
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Pessoa da equipe: foto (ou iniciais), nome, cargo e uma linha sobre ela. */
export function TeamMember({ name, role, bio, photo }: { name?: string; role?: string; bio?: string; photo?: string }) {
  return (
    <div className="h-full text-center">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt={name ?? ""} className="mx-auto size-28 rounded-full object-cover" />
      ) : (
        <div className="lp-h mx-auto flex size-28 items-center justify-center rounded-full text-3xl" style={{ background: "var(--lp-accent-bg)", color: "var(--lp-accent)" }} aria-hidden>
          {initials(name)}
        </div>
      )}
      <h3 className="lp-hf mt-4 text-lg font-semibold">{name}</h3>
      {role ? (
        <p className="text-sm" style={{ color: "var(--lp-accent)" }}>
          {role}
        </p>
      ) : null}
      {bio ? (
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--lp-soft)" }}>
          {bio}
        </p>
      ) : null}
    </div>
  );
}

const digits = (s = "") => s.replace(/\D/g, "");

/** Horários, endereço e contato, com links de telefone, e-mail e WhatsApp. */
export function ContactInfo({ hours = [], address, phone, email, whatsapp }: { hours?: string[]; address?: string; phone?: string; email?: string; whatsapp?: string }) {
  const row = (Icon: typeof Clock, label: string, body: ReactNode) => (
    <div className="flex gap-3">
      <span className="lp-icon inline-flex size-10 shrink-0 items-center justify-center" style={{ background: "var(--lp-accent-bg)", color: "var(--lp-accent)" }}>
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <div className="mt-0.5 text-sm leading-relaxed" style={{ color: "var(--lp-soft)" }}>
          {body}
        </div>
      </div>
    </div>
  );
  const wa = digits(whatsapp);
  return (
    <div className="lp-card grid gap-6 p-6 @xl:grid-cols-2 @3xl:p-8">
      {hours.length ? row(Clock, "Horários", hours.map((h) => <p key={h}>{h}</p>)) : null}
      {address ? row(MapPin, "Endereço", <p>{address}</p>) : null}
      {phone ? row(Phone, "Telefone", <a href={`tel:${digits(phone)}`} className="underline-offset-2 hover:underline">{phone}</a>) : null}
      {whatsapp ? row(MessageCircle, "WhatsApp", <a href={wa ? `https://wa.me/${wa.length <= 11 ? `55${wa}` : wa}` : "#"} className="underline-offset-2 hover:underline">{whatsapp}</a>) : null}
      {email ? row(Mail, "E-mail", <a href={`mailto:${email}`} className="break-all underline-offset-2 hover:underline">{email}</a>) : null}
    </div>
  );
}

/** Faixa de clientes ou parceiros (nomes em texto, sem imagens). Só com nomes reais. */
export function LogoStrip({ title, names = [], variant = "static" }: { title?: string; names?: string[]; variant?: string }) {
  const item = (n: string, key: string, hidden?: boolean) => (
    <span key={key} aria-hidden={hidden} className="lp-hf shrink-0 text-xl font-semibold opacity-60 @3xl:text-2xl">
      {n}
    </span>
  );
  return (
    <div className="text-center">
      {title ? (
        <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--lp-soft)" }}>
          {title}
        </p>
      ) : null}
      {variant === "marquee" ? (
        // Faixa rolando: a lista vai duas vezes (a cópia é decorativa) e anda até a metade.
        <div className="lp-marquee mt-6 overflow-hidden">
          <div className="lp-marquee-track flex w-max items-center gap-x-12">
            {names.map((n, i) => item(n, `a${i}`))}
            {names.map((n, i) => item(n, `b${i}`, true))}
          </div>
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">{names.map((n, i) => item(n, `a${i}`))}</div>
      )}
    </div>
  );
}

/** Galeria: fotos em grade; sem URL, um espaço reservado com a legenda. */
export function Gallery({ images = [], captions = [] }: { images?: string[]; captions?: string[] }) {
  const count = Math.max(images.length, captions.length, 3);
  return (
    <div className="grid gap-3 @md:grid-cols-2 @3xl:grid-cols-3 @3xl:gap-4">
      {Array.from({ length: count }, (_, i) => {
        const src = images[i];
        const caption = captions[i];
        return (
          <figure key={i} className="overflow-hidden" style={{ borderRadius: "var(--lp-radius)" }}>
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={caption ?? ""} className="lp-img aspect-[4/3] w-full object-cover" />
            ) : (
              <div className="lp-deco flex aspect-[4/3] w-full items-end p-3" role="img" aria-label={caption ?? "foto"}>
                <span className="rounded-md px-2 py-1 text-xs" style={{ background: "var(--lp-bg)", color: "var(--lp-soft)" }}>
                  {caption ?? "[foto]"}
                </span>
              </div>
            )}
            {src && caption ? <figcaption className="pt-2 text-sm" style={{ color: "var(--lp-soft)" }}>{caption}</figcaption> : null}
          </figure>
        );
      })}
    </div>
  );
}
