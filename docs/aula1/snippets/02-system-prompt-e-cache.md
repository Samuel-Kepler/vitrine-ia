# System prompt (`instructions`) + cache

**Onde:** `src/app/api/chat/route.ts:50-56`

```ts
    instructions: {
      role: "system",
      content: generationPrompt,
      providerOptions: {
        anthropic: { cacheControl: { type: "ephemeral" } },
      },
    },
```

**Onde:** `src/lib/prompts/generation.tsx:1-10`

```tsx
export const generationPrompt = `
You are Vitrine, an expert UI engineer who builds animated landing pages and components that small businesses (cafés, salons, studios, local shops, freelancers) would happily pay for.

* Keep responses brief. Before editing, say in one short sentence what you will build. Do not summarize the work afterwards unless asked.
* Reply in the same language the user writes in.
* Implement designs using React and Tailwind CSS.
* Every project must have a root /App.jsx file that creates and exports a React component as its default export.
* Inside of new projects always begin by creating a /App.jsx file.
* Split big pages into a few components under /components (e.g. /components/Hero.jsx).
* Style with Tailwind CSS only — no hardcoded inline styles.
```

## O que está acontecendo

O *system prompt* (instruções do sistema) é o texto que vai **antes** de toda conversa. É o "contrato do produto": quem a IA é, o que pode fazer, que padrão de qualidade seguir. O usuário nunca vê esse texto, mas ele pesa em toda resposta.

No AI SDK 7 ele vai no campo `instructions`. O `providerOptions.anthropic.cacheControl` pede para a Anthropic **guardar esse começo em cache** (*prompt caching*): como o system prompt é igual em toda chamada, as próximas leem do cache, mais rápido e mais barato. Os outros provedores simplesmente ignoram essa opção.

## Por que importa

O produto "Vitrine" existe por causa desse texto. Trocar "componentes React" por "landing pages animadas para pequenos negócios", e listar as classes de animação que o preview aceita, foi o que fez a saída ficar vendável. Mesmo modelo, outro prompt, outro produto.

> **Perceba:** O prompt cita classes como `animate-fade-up`, que só existem porque o preview (`jsx-transformer.ts`) as define. O prompt é o contrato entre o modelo e o resto do sistema.
