import { tool } from "ai";
import { z } from "zod";
import { VirtualFileSystem } from "@/lib/file-system";
import { transformJSX } from "@/lib/transform/jsx-transformer";

// Depois de gravar, compila o arquivo com o mesmo Babel do preview. Se tiver
// erro de sintaxe, o modelo recebe o erro como resultado da ferramenta e
// corrige no próximo passo do loop, em vez de entregar um preview quebrado.
export function withSyntaxCheck(fileSystem: VirtualFileSystem, path: string, result: string) {
  if (result.startsWith("Error") || !/\.(jsx?|tsx?)$/.test(path)) return result;
  const code = fileSystem.readFile(path) ?? "";
  const { error } = transformJSX(code, path, new Set());
  if (!error) return result;
  return `${result}\nERRO DE SINTAXE em ${path} (o preview vai quebrar): ${error}\nCorrija este arquivo agora com str_replace.`;
}

const TextEditorInput = z.object({
  command: z
    .enum(["view", "create", "str_replace", "insert", "undo_edit"])
    .describe("The operation to perform"),
  path: z.string().describe("Absolute path of the file, e.g. /App.jsx"),
  file_text: z
    .string()
    .optional()
    .describe("Full file content. Required for `create`."),
  insert_line: z
    .number()
    .optional()
    .describe("Line number after which to insert `new_str`. Required for `insert`."),
  new_str: z
    .string()
    .optional()
    .describe("Replacement text for `str_replace`, or text to insert for `insert`."),
  old_str: z
    .string()
    .optional()
    .describe("Exact text to replace. Must match exactly once. Required for `str_replace`."),
  view_range: z
    .array(z.number())
    .optional()
    .describe("Optional [start, end] line range for `view`."),
});

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
          return withSyntaxCheck(fileSystem, path, fileSystem.createFileWithParents(path, file_text || ""));

        case "str_replace":
          return withSyntaxCheck(fileSystem, path, fileSystem.replaceInFile(path, old_str || "", new_str || ""));

        case "insert":
          return withSyntaxCheck(fileSystem, path, fileSystem.insertInFile(path, insert_line || 0, new_str || ""));

        case "undo_edit":
          return `Error: undo_edit command is not supported in this version. Use str_replace to revert changes.`;
      }
    },
  });
