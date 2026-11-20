import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { STEPS, TOOLS } from "./tools";

const STUDIO_HREF = "/studio";

/** Página inicial (servidor): explica o Studio e leva ao editor em /studio. */
export function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-6">
          <span className="flex items-baseline gap-1.5">
            <span className="text-[15px] font-semibold tracking-tight">vitrine</span>
            <span className="label-mono">studio</span>
          </span>
          <nav aria-label="Principal" className="ml-auto flex items-center gap-1 text-sm">
            <a href="#como-funciona" className="rounded-md px-3 py-1.5 text-muted hover:text-ink">
              Como funciona
            </a>
            <a href="#ferramentas" className="hidden rounded-md px-3 py-1.5 text-muted hover:text-ink sm:inline-block">
              Ferramentas
            </a>
            <Link href={STUDIO_HREF} className="ml-2 rounded-md bg-brand px-3.5 py-1.5 font-semibold text-panel transition hover:brightness-110">
              Abrir o Studio
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section aria-labelledby="hero-titulo" className="border-b border-line bg-panel">
          <div className="mx-auto max-w-4xl px-6 py-16 text-center sm:py-24">
            <p className="label-mono">Editor de landing pages com IA</p>
            <h1 id="hero-titulo" className="mt-4 text-3xl font-semibold tracking-tight text-ink sm:text-5xl">
              Monte a página com blocos e deixe a IA transformá-la em landing page
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
              No Vitrine Studio você arrasta blocos ou descreve o que quer. O botão <strong className="font-semibold text-ink">Reimaginar</strong> transforma o rascunho
              numa landing page validada (A2UI). Depois, o mesmo projeto gera o backend, o banco e o site para exportar.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={STUDIO_HREF}
                className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-panel shadow-sm transition hover:brightness-110"
              >
                Abrir o Studio <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <a
                href="#como-funciona"
                className="inline-flex items-center rounded-lg border border-line bg-panel px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-brand-soft"
              >
                Como funciona
              </a>
            </div>
          </div>
        </section>

        <section id="como-funciona" aria-labelledby="como-funciona-titulo" className="scroll-mt-16">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <p className="label-mono">Fluxo</p>
            <h2 id="como-funciona-titulo" className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Como funciona
            </h2>
            <ol aria-label="Passos do fluxo" className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex flex-col rounded-xl border border-line bg-panel p-5 shadow-sm">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-soft font-mono text-sm font-semibold text-brand">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-ink">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="ferramentas" aria-labelledby="ferramentas-titulo" className="scroll-mt-16 border-t border-line bg-panel">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <p className="label-mono">Recursos</p>
            <h2 id="ferramentas-titulo" className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              Ferramentas do Studio
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
              Tudo fica num só lugar: do primeiro bloco ao projeto exportado com backend e banco.
            </p>
            <ul aria-label="Lista de ferramentas" className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {TOOLS.map((tool) => (
                <li key={tool.name} className="rounded-xl border border-line bg-canvas p-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand">
                    <tool.icon size={18} aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-ink">{tool.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{tool.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="privacidade-titulo" className="border-t border-line">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="flex flex-col gap-6 rounded-xl border border-line bg-panel p-6 sm:flex-row sm:items-start sm:p-8">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <Lock size={18} aria-hidden="true" />
              </span>
              <div>
                <h2 id="privacidade-titulo" className="text-lg font-semibold text-ink">
                  Privacidade e IA local
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
                  Os projetos ficam salvos no seu navegador. Você escolhe o provedor de IA na engrenagem do topo, e essa escolha também fica só no navegador.
                  Com um servidor local, como Ollama ou LM Studio, o conteúdo não sai do seu computador. Com um provedor na nuvem, o que você envia para a IA
                  vai para esse provedor.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-panel">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>Vitrine Studio · landing pages com A2UI e arquitetura de backend</span>
          <Link href={STUDIO_HREF} className="font-medium text-brand hover:underline">
            Abrir o Studio
          </Link>
        </div>
      </footer>
    </div>
  );
}
