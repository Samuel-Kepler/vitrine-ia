# `onToolCall`: aplicando a tool call no FS do cliente

**Onde:** `src/lib/contexts/chat-context.tsx:55-57`

```tsx
    onToolCall: ({ toolCall }) => {
      handleToolCall(toolCall);
    },
```

**Onde:** `src/lib/contexts/file-system-context.tsx:148-164`

```tsx
  const handleToolCall = useCallback(
    (toolCall: ToolCall) => {
      const { toolName, input } = toolCall;

      // Handle str_replace_editor tool
      if (toolName === "str_replace_editor" && input) {
        const { command, path, file_text, old_str, new_str, insert_line } = input;

        switch (command) {
          case "create":
            if (path && file_text !== undefined) {
              const result = fileSystem.createFileWithParents(path, file_text);
              if (!result.startsWith("Error:")) {
                createFile(path, file_text);
              }
            }
            break;
```

## O que está acontecendo

A ferramenta roda no servidor, num FS virtual temporário. Mas o preview está no navegador. Como o arquivo chega lá?

Cada vez que o stream traz uma tool call, o `useChat` chama `onToolCall`. A gente repete a mesma operação no FS do navegador (`createFileWithParents`, `replaceInFile`...). O FS muda, o `refreshTrigger` muda, e o iframe do preview re-renderiza.

## Por que importa

É por isso que o preview aparece **enquanto** a IA ainda trabalha, arquivo por arquivo. O mesmo evento alimenta a timeline animada e o preview.

> **Perceba:** Servidor e cliente aplicam a mesma operação nos dois lados. Se divergirem, o próximo pedido manda o estado do cliente (snippet 06), que vira a verdade.
