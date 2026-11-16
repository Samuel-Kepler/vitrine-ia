// AULA 2 — parte 3 do ciclo: AÇÃO (as "mãos" do agente).
//
// Tools do AI SDK: o modelo pede `write_file("agent/demo-site/styles.css",
// "...conteúdo...")` e ESTE código executa — depois de passar pelos
// guardrails. Tudo fora da allowlist é recusado com uma mensagem que o
// próprio modelo lê e pode corrigir na próxima tool call.
//
// O agente NÃO ganha uma tool de shell: os testes rodam fora do modelo,
// no `verify.ts`. Modelo propõe, código verifica.
import { tool, type Tool } from "ai";
import { z } from "zod";
import { promises as fs } from "node:fs";
import path from "node:path";
import { isPathAllowed } from "./guardrails";

export interface FsToolsOptions {
  workDir: string;
  allowedPaths: string[];
}

export interface FsToolsResult {
  tools: {
    list_files: Tool;
    read_file: Tool;
    write_file: Tool;
  };
  // Arquivos que o agente escreveu ao longo de toda a rodada —
  // o workflow usa isso para montar o resumo do PR.
  getChangedFiles: () => string[];
}

const DENIED = (p: string) =>
  `RECUSADO: "${p}" está fora dos caminhos permitidos (allowlist). ` +
  `Liste os arquivos com list_files e edite apenas o que estiver liberado.`;

export function createFsTools({ workDir, allowedPaths }: FsToolsOptions): FsToolsResult {
  const changed = new Set<string>();

  const abs = (p: string) => path.join(workDir, p);

  async function listAllowedFiles(): Promise<string[]> {
    const out: string[] = [];
    for (const prefix of allowedPaths) {
      async function walk(relDir: string) {
        const entries = await fs.readdir(abs(relDir), { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
          const rel = `${relDir.replace(/\/$/, "")}/${entry.name}`;
          if (entry.isDirectory() && allowedPaths.some((p) => rel.startsWith(p.replace(/\/$/, "")))) {
            await walk(rel);
          } else if (entry.isFile() && isPathAllowed(rel, allowedPaths)) {
            out.push(rel);
          }
        }
      }
      const stat = await fs.stat(abs(prefix.replace(/\/$/, ""))).catch(() => null);
      if (stat?.isDirectory()) await walk(prefix.replace(/\/$/, ""));
      else if (stat?.isFile()) out.push(prefix.replace(/\/$/, ""));
    }
    return [...new Set(out)].sort();
  }

  const tools = {
    list_files: tool({
      description:
        "Lista os arquivos que você tem permissão de ver e editar (allowlist). Chame primeiro para se orientar.",
      inputSchema: z.object({}),
      execute: async () => ({ files: await listAllowedFiles() }),
    }),

    read_file: tool({
      description: "Lê um arquivo permitido. Caminho relativo à raiz do repositório.",
      inputSchema: z.object({ path: z.string().describe('ex.: "agent/demo-site/styles.css"') }),
      execute: async ({ path: p }) => {
        if (!isPathAllowed(p, allowedPaths)) return { error: DENIED(p) };
        try {
          return { path: p, content: await fs.readFile(abs(p), "utf8") };
        } catch {
          return { error: `Arquivo não encontrado: ${p}` };
        }
      },
    }),

    write_file: tool({
      description:
        "Escreve o conteúdo COMPLETO de um arquivo permitido (sobrescreve). Só edite o necessário para a issue.",
      inputSchema: z.object({
        path: z.string(),
        content: z.string().describe("conteúdo completo do arquivo"),
      }),
      execute: async ({ path: p, content }) => {
        if (!isPathAllowed(p, allowedPaths)) return { error: DENIED(p) };
        if (content.length > 200_000) return { error: "RECUSADO: conteúdo grande demais." };
        await fs.mkdir(path.dirname(abs(p)), { recursive: true });
        await fs.writeFile(abs(p), content, "utf8");
        changed.add(p);
        return { ok: true, path: p, bytes: Buffer.byteLength(content) };
      },
    }),
  };

  return { tools, getChangedFiles: () => [...changed].sort() };
}
