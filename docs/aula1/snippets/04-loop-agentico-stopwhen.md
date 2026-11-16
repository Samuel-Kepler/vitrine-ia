# O loop agêntico com `stopWhen`

**Onde:** `src/app/api/chat/route.ts:66-81`

```ts
    messages: await convertToModelMessages(messages, { tools }),
    tools,
    // Landing pages completas passam fácil de 10k tokens. Se o limite
    // estourar (finishReason "length"), o loop para no meio.
    maxOutputTokens: 32_000,
    // Loop agêntico: o modelo pode chamar ferramentas várias vezes
    // até terminar. O mock usa poucos passos para não se repetir.
    stopWhen: isStepCount(provider === "mock" ? 4 : 40),
    // Regra determinística em vez de torcer pelo modelo: no 1º passo de um
    // projeto novo, ele é OBRIGADO a chamar str_replace_editor.
    // Free tiers limitam tokens por minuto (Groq: 8 mil). Quando o provedor
    // responde 429, o SDK espera o tempo do header retry-after e tenta de novo.
    maxRetries: 6,
    prepareStep: ({ stepNumber }) =>
      stepNumber === 0 && forceFirstTool
        ? { toolChoice: { type: "tool", toolName: "str_replace_editor" } }
```

## O que está acontecendo

Loop agêntico: a IA lê o pedido, chama uma ferramenta, **olha o resultado** e decide o próximo passo, repetindo até terminar. Cada volta é um *step* (passo).

Quem faz o loop é o SDK: depois que as ferramentas rodam, ele chama o modelo de novo, já com os resultados. O `stopWhen: isStepCount(40)` é o freio: no máximo 40 voltas. Sem freio, um modelo confuso pode ficar girando e gastando token.

O `onFinish` loga por que parou (`stop`, `length`...), quantos passos e quantos tokens saíram.

## Por que importa

Na timeline da UI cada "loop · passo N" é uma volta dessas. No print 05 o Haiku criou 6 arquivos no passo 1 e, no passo 2, **corrigiu sozinho** um `style` inline que violava o system prompt. Isso é o loop: agir, olhar, corrigir.

> **Perceba:** Bug real que apareceu preparando esta aula: com `maxOutputTokens: 10_000`, uma landing completa estourava o limite (`finishReason: "length"`) e o loop parava no meio, com os arquivos pela metade. O log do `onFinish` mostrou ~11.700 tokens. Subimos para 32.000. A lição é olhar o motivo de parada.
