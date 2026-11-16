// O LOOP em si, testado com um modelo fake (MockLanguageModelV4 do AI SDK).
// O que está em jogo aqui não é "o modelo acerta?" — é: o erro da
// verificação volta para o modelo? Os limites param o loop?
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runAgentLoop } from "../loop";
import { buildIssueContext } from "../issue-context";
import { loadConfig } from "../config";
import type { AgentConfig } from "../config";
import type { VerificationResult } from "../verify";

const USAGE = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};

const FINISH = (unified: "stop" | "tool-calls") => ({ unified, raw: undefined });

// Modelo fake: 1ª chamada de cada tentativa escreve arquivo via tool,
// 2ª responde texto (fim da tentativa, por causa do stopWhen).
function fakeModel(opts: { content?: string; promptLog: string[] }) {
  let call = 0;
  return new MockLanguageModelV4({
    doGenerate: async (options) => {
      call++;
      opts.promptLog.push(JSON.stringify(options.prompt));
      if (call % 2 === 1) {
        return {
          content: [
            {
              type: "tool-call",
              toolCallId: `call-${call}`,
              toolName: "write_file",
              input: JSON.stringify({
                path: "site/index.html",
                content: opts.content ?? "<html>ok</html>",
              }),
            },
          ],
          finishReason: FINISH("tool-calls"),
          usage: USAGE,
          warnings: [],
        };
      }
      return {
        content: [{ type: "text", text: "Ajustei o contraste do subtítulo." }],
        finishReason: FINISH("stop"),
        usage: USAGE,
        warnings: [],
      };
    },
  });
}

const issue = buildIssueContext({
  number: 1,
  title: "Corrigir contraste",
  body: "escurecer o subtítulo",
  labels: ["agent:ready"],
});

let workDir: string;
let config: AgentConfig;

beforeEach(async () => {
  workDir = await fs.mkdtemp(path.join(os.tmpdir(), "agent-loop-test-"));
  await fs.mkdir(path.join(workDir, "site"));
  await fs.writeFile(path.join(workDir, "site/index.html"), "<html>ruim</html>", "utf8");
  config = loadConfig({
    workDir,
    allowedPaths: ["site/"],
    verifyCommands: ["true"],
    maxAttempts: 3,
    maxStepsPerAttempt: 5,
  });
});

afterEach(async () => {
  await fs.rm(workDir, { recursive: true, force: true });
});

const failThenPass = (failures: number) => {
  let n = 0;
  return async (): Promise<VerificationResult> =>
    ++n <= failures
      ? { ok: false, failedCommand: "npm run lint", output: "LINT ERRO simulado" }
      : { ok: true, failedCommand: null, output: "ok" };
};

describe("runAgentLoop", () => {
  it("passa de primeira quando a verificação aprova", async () => {
    const promptLog: string[] = [];
    const result = await runAgentLoop(fakeModel({ promptLog }), issue, config, {
      verify: failThenPass(0),
    });
    expect(result.success).toBe(true);
    expect(result.attempts).toBe(1);
    expect(result.changedFiles).toEqual(["site/index.html"]);
    expect(result.summary).toContain("contraste");
    // o arquivo foi escrito de verdade no disco
    await expect(fs.readFile(path.join(workDir, "site/index.html"), "utf8")).resolves.toContain(
      "ok"
    );
  });

  it("o LOOP: erro da verificação volta como mensagem para o modelo", async () => {
    const promptLog: string[] = [];
    const result = await runAgentLoop(fakeModel({ promptLog }), issue, config, {
      verify: failThenPass(1),
    });
    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
    // na 2ª tentativa, o prompt contém a saída do verificador da 1ª
    expect(promptLog.some((p) => p.includes("LINT ERRO simulado"))).toBe(true);
    expect(promptLog.some((p) => p.includes("A verificação falhou (tentativa 1/3)"))).toBe(true);
  });

  it("guardrail: desiste depois de maxAttempts sem sucesso", async () => {
    const promptLog: string[] = [];
    const result = await runAgentLoop(fakeModel({ promptLog }), issue, config, {
      verify: failThenPass(99),
    });
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(config.maxAttempts);
    expect(result.lastVerification.failedCommand).toBe("npm run lint");
  });

  it("guardrail: para quando estoura o orçamento de tokens", async () => {
    const promptLog: string[] = [];
    const result = await runAgentLoop(fakeModel({ promptLog }), issue, {
      ...config,
      maxTotalTokens: 5, // modelo fake gasta 15 por chamada
    });
    expect(result.success).toBe(false);
    expect(result.stoppedByBudget).toBe(true);
  });
});
