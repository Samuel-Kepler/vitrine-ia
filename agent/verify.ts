// AULA 2 — parte 4 do ciclo: VERIFICAÇÃO.
//
// Roda de verdade: lint e testes do repositório, no shell do runner.
// A saída (cortada no tamanho) é o que volta para o modelo quando falha.
import { exec } from "node:child_process";

export interface VerificationResult {
  ok: boolean;
  failedCommand: string | null;
  output: string; // últimas ~4000 chars, prontas para o prompt
}

const MAX_OUTPUT_CHARS = 4_000;

function run(command: string, cwd: string): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    exec(command, { cwd, shell: "/bin/bash", timeout: 5 * 60_000 }, (error, stdout, stderr) => {
      const code = error && typeof error.code === "number" ? error.code : 0;
      resolve({ code, output: `${stdout}\n${stderr}`.trim() });
    });
  });
}

export async function runVerification(
  commands: string[],
  workDir: string
): Promise<VerificationResult> {
  for (const command of commands) {
    const { code, output } = await run(command, workDir);
    if (code !== 0) {
      return {
        ok: false,
        failedCommand: command,
        output: `$ ${command}\n${output.slice(-MAX_OUTPUT_CHARS)}`,
      };
    }
  }
  return { ok: true, failedCommand: null, output: "todos os comandos passaram" };
}
