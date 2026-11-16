# Uma ferramenta (*tool*) com `inputSchema`

**Onde:** `src/lib/tools/str-replace.ts:5-9`

```ts
const TextEditorInput = z.object({
  command: z
    .enum(["view", "create", "str_replace", "insert", "undo_edit"])
    .describe("The operation to perform"),
  path: z.string().describe("Absolute path of the file, e.g. /App.jsx"),
```

**Onde:** `src/lib/tools/str-replace.ts:32-54`

```ts
export const buildStrReplaceTool = (fileSystem: VirtualFileSystem) =>
  tool({
    description:
      "View, create and edit files in the virtual file system. Use `create` for new files, `str_replace` for targeted edits, `insert` to add lines and `view` to read a file.",
    inputSchema: TextEditorInput,
    execute: async ({
      command,
      path,
      file_text,
      insert_line,
      new_str,
      old_str,
      view_range,
    }) => {
      switch (command) {
        case "view":
          return fileSystem.viewFile(
            path,
            view_range as [number, number] | undefined
          );

        case "create":
          return fileSystem.createFileWithParents(path, file_text || "");
```

## O que está acontecendo

Uma *tool* (ferramenta) nada mais é do que uma função sua que o modelo pode pedir para rodar. Ela tem três partes:

1. `description`: texto que explica ao modelo para que ela serve (sim, é prompt também).
2. `inputSchema`: um schema zod com os argumentos. O SDK transforma isso em JSON Schema e manda para o modelo, que devolve os argumentos nesse formato.
3. `execute`: o código que roda **no servidor** quando o modelo chama a ferramenta.

O modelo não executa nada. Ele só escreve "quero chamar `str_replace_editor` com `{ command: "create", path: "/App.jsx", ... }`". Quem executa é o seu código.

## Por que importa

É assim que a IA sai do "texto" e passa a **agir** num sistema: criar arquivo, consultar banco, mandar e-mail. E o `.describe()` de cada campo é contexto que melhora a chance de o modelo acertar os argumentos.

> **Perceba:** O arquivo é criado num sistema de arquivos **virtual** (memória), nunca no disco do servidor.
