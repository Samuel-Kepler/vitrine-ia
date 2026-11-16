# Renderizando as `parts` da mensagem (a timeline)

**Onde:** `src/components/chat/MessageList.tsx:93-118`

```tsx
  const lastTextIndex = parts.map((p) => p.type).lastIndexOf("text");

  return (
    <ol className="timeline relative" data-testid="agent-timeline">
      {parts.map((part, i) => {
        if (isToolUIPart(part)) return <ToolNode key={i} step={toolPartToStep(part, live)} />;
        switch (part.type) {
          case "step-start":
            loopIndex++;
            return loopIndex > 1 ? (
              <Node key={i} icon={<RotateCw className="h-3 w-3" />}>
                <span className="text-[11px] font-medium uppercase tracking-widest text-zinc-500">
                  loop · passo {loopIndex}
                </span>
              </Node>
            ) : null;
          case "text":
            if (!part.text.trim()) return null;
            return (
              <Node key={i} tone="accent" icon={<Sparkles className="h-3 w-3" />}>
                <div className="text-sm text-zinc-200">
                  <StreamingText
                    text={part.text}
                    streaming={live && i === lastTextIndex && part.state === "streaming"}
                  />
                </div>
```

## O que está acontecendo

No AI SDK 7, uma mensagem não é uma string: é uma lista de `parts` (partes) em ordem. Pode ser `text`, `reasoning` (o raciocínio do modelo, quando o provedor manda), uma tool call (`tool-str_replace_editor`) ou `step-start` (começou uma nova volta do loop).

A timeline é só um `map` nessa lista, decidindo o desenho de cada tipo. A tool call vira "criando /App.jsx" via `toolPartToStep`, uma função pura e testada que olha o `state` da parte (`input-streaming`, `output-available`...).

## Por que importa

É isso que deixa o loop **visível** para o aluno: cada parte que chega no stream vira um nó animado. Nenhuma mágica, só renderizar o que o SDK já entrega.

> **Perceba:** O texto que ainda está chegando é dividido em `<span>` por pedaço, cada um com uma animação de entrada. O React só monta os spans novos, então só os pedaços novos animam.
