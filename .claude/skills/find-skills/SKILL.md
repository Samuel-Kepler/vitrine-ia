---
name: find-skills
description: Helps users discover and install agent skills when they ask questions like "how do I do X", "find a skill for X", "is there a skill that can...", or express interest in extending capabilities. In this repo (Vitrine Studio) also use it to find skills that improve the generated FRONTEND (A2UI landing -> HTML / React+Vite+Tailwind) and BACKEND (Hono + Postgres + Redis + Docker, SQL/Prisma/Drizzle/DBML), always keeping A2UI as the base. Triggers include "procure uma skill", "tem skill para", "skill para gerar backend/front".
---

# Find Skills

This skill helps you discover and install skills from the open agent skills ecosystem.

## Vitrine Studio: regras deste projeto (leia primeiro)

O Studio (`studio/`) gera tudo a partir de **A2UI** (a2ui.org, v1.0). Uma skill só serve se
reforçar esse fluxo, nunca se o substituir:

```
rascunho (blocos) --Reimaginar--> A2UI validado (catálogo em studio/src/lib/a2ui/catalog-api.ts)
   ├─ frontend: HTML estático + React (Vite + Tailwind) exportados do A2UI (landing-components.tsx, landing.css)
   └─ "Sugerir da landing" -> Arquitetura (Hono/Node, Postgres, Redis, filas/workers, docker-compose, zod, node:test)
                            -> Banco (SQL Postgres/MySQL/SQLite, Prisma, Drizzle, DBML)
```

**A2UI é a base, sempre.** Rejeite (ou só use como referência de ideias) skills que:
- gerem UI fora do A2UI (geradores shadcn/v0/JSX livre, "page builders") ou que façam o modelo escrever React/HTML direto em vez de A2UI;
- troquem a stack gerada (ex.: Express/Nest no lugar de Hono, ORMs sem Prisma/Drizzle/SQL, Kubernetes no lugar de docker-compose) sem o usuário pedir;
- exijam script/JS no HTML exportado (a CSP do export proíbe scripts) ou bibliotecas de animação (o projeto usa só CSS).

### Buscas sugeridas (rode em paralelo; prefira 2–3 palavras)

| Alvo | Consultas |
|---|---|
| A2UI (prioridade) | `a2ui`, `a2ui renderer`, `agent ui protocol`, `--owner a2ui-project` |
| Frontend gerado | `landing page`, `tailwind`, `accessibility`, `web design`, `copywriting`, `seo` |
| Backend gerado | `hono`, `zod`, `postgres`, `docker compose`, `redis queue`, `node testing` |
| Banco | `drizzle`, `prisma`, `sql schema`, `dbml` |
| Studio em si | `nextjs`, `ai sdk`, `react best practices` |

Já encontrados (verifique se ainda valem): `a2ui-project/a2ui@a2ui` (oficial A2UI),
`copilotkit/copilotkit@a2ui-renderer`, `yusukebe/hono-skill@hono` (autor do Hono),
`honojs/skills@*`, `vercel-labs/agent-skills` (React/Next).

O comando `npx skills find <consulta>` funciona sem interação quando recebe a consulta.
Para economizar tokens, as buscas podem rodar num subagente Haiku que devolve só a tabela final.

### Como avaliar uma skill para o Vitrine

Para cada candidata, diga numa tabela: nome, instalações, fonte, **o que melhora no Studio**
(qual arquivo/gerador: prompt do Reimaginar, catálogo A2UI, export React, codegen do backend
`studio/src/lib/arch/codegen.ts`, gerador de schema `studio/src/lib/db/`), e **se respeita o A2UI**
(sim / só referência / não). Ordem de preferência: oficial do A2UI ou do autor da ferramenta
(a2ui-project, honojs/yusukebe, drizzle-team, prisma, vercel-labs, anthropics) > 1K+ instalações > resto.

### Instalação neste projeto

- Instale **no projeto** e **só para o Claude Code**, como cópia (para poder revisar e adaptar):
  `npx skills add <owner/repo@skill> -a claude-code --copy -y` (rodar em `vitrine-ia/`; vai para `.claude/skills/`).
  Não use `-g` aqui, a menos que o usuário peça.
- **Leia o SKILL.md inteiro (e qualquer script) antes de usar.** Se a skill sugerir algo que contradiz
  as regras acima, adapte o SKILL.md copiado (ex.: acrescente uma seção "No Vitrine Studio") em vez de seguir cegamente.
- Peça confirmação ao usuário antes de instalar; mostre a tabela primeiro.

## When to Use This Skill

Use this skill when the user:

- Asks "how do I do X" where X might be a common task with an existing skill
- Says "find a skill for X" or "is there a skill for X"
- Asks "can you do X" where X is a specialized capability
- Expresses interest in extending agent capabilities
- Wants to search for tools, templates, or workflows
- Mentions they wish they had help with a specific domain (design, testing, deployment, etc.)

## What is the Skills CLI?

The Skills CLI (`npx skills`) is the package manager for the open agent skills ecosystem. Skills are modular packages that extend agent capabilities with specialized knowledge, workflows, and tools.

**Key commands:**

- `npx skills find [query] [--owner <owner>]` - Search for skills interactively or by keyword, optionally scoped to a GitHub owner
- `npx skills add <package>` - Install a skill from GitHub or other sources
- `npx skills update` - Update all installed skills

**Browse skills at:** https://skills.sh/

## How to Help Users Find Skills

### Step 1: Understand What They Need

When a user asks for help with something, identify:

1. The domain (e.g., React, testing, design, deployment)
2. The specific task (e.g., writing tests, creating animations, reviewing PRs)
3. Whether this is a common enough task that a skill likely exists

### Step 2: Check the Leaderboard First

Before running a CLI search, check the [skills.sh leaderboard](https://skills.sh/) to see if a well-known skill already exists for the domain. The leaderboard ranks skills by total installs, surfacing the most popular and battle-tested options.

For example, top skills for web development include:
- `vercel-labs/agent-skills` — React, Next.js, web design (100K+ installs each)
- `anthropics/skills` — Frontend design, document processing (100K+ installs)

### Step 3: Search for Skills

If the leaderboard doesn't cover the user's need, run the find command:

```bash
npx skills find [query] [--owner <owner>]
```

For example:

- User asks "how do I make my React app faster?" → `npx skills find react performance`
- User asks "can you help me with PR reviews?" → `npx skills find pr review`
- User asks "I need to create a changelog" → `npx skills find changelog`

### Step 4: Verify Quality Before Recommending

**Do not recommend a skill based solely on search results.** Always verify:

1. **Install count** — Prefer skills with 1K+ installs. Be cautious with anything under 100.
2. **Source reputation** — Official sources (`vercel-labs`, `anthropics`, `microsoft`) are more trustworthy than unknown authors.
3. **GitHub stars** — Check the source repository. A skill from a repo with <100 stars should be treated with skepticism.

### Step 5: Present Options to the User

When you find relevant skills, present them to the user with:

1. The skill name and what it does
2. The install count and source
3. The install command they can run
4. A link to learn more at skills.sh

Example response:

```
I found a skill that might help! The "react-best-practices" skill provides
React and Next.js performance optimization guidelines from Vercel Engineering.
(185K installs)

To install it:
npx skills add vercel-labs/agent-skills@react-best-practices

Learn more: https://skills.sh/vercel-labs/agent-skills/react-best-practices
```

### Step 6: Offer to Install

If the user wants to proceed, you can install the skill for them:

```bash
npx skills add <owner/repo@skill> -g -y
```

The `-g` flag installs globally (user-level) and `-y` skips confirmation prompts.
(In the Vitrine repo, install project-level instead — see "Instalação neste projeto" above.)

## Common Skill Categories

When searching, consider these common categories:

| Category        | Example Queries                          |
| --------------- | ---------------------------------------- |
| Web Development | react, nextjs, typescript, css, tailwind |
| Testing         | testing, jest, playwright, e2e           |
| DevOps          | deploy, docker, kubernetes, ci-cd        |
| Documentation   | docs, readme, changelog, api-docs        |
| Code Quality    | review, lint, refactor, best-practices   |
| Design          | ui, ux, design-system, accessibility     |
| Productivity    | workflow, automation, git                |

## Tips for Effective Searches

1. **Use specific keywords**: "react testing" is better than just "testing"
2. **Try alternative terms**: If "deploy" doesn't work, try "deployment" or "ci-cd"
3. **Check popular sources**: Many skills come from `vercel-labs/agent-skills` or `ComposioHQ/awesome-claude-skills`

## When No Skills Are Found

If no relevant skills exist:

1. Acknowledge that no existing skill was found
2. Offer to help with the task directly using your general capabilities
3. Suggest the user could create their own skill with `npx skills init`

Example:

```
I searched for skills related to "xyz" but didn't find any matches.
I can still help you with this task directly! Would you like me to proceed?

If this is something you do often, you could create your own skill:
npx skills init my-xyz-skill
```
