// ============================================================
// AULA 2 — O LOOP. O coração da aula cabe em ~80 linhas.
//
//   tentativa 1..N:
//     1. generateText com tools (o modelo lê e edita arquivos)
//     2. stopWhen: teto de passos — o modelo não roda para sempre
//     3. verificação real no shell (lint + testes)
//     4. falhou? a saída do erro vira a próxima mensagem do usuário
//   passou? devolve sucesso + resumo para o PR
//
// Os guardrails ficam FORA do modelo: allowlist nas tools (tools.ts),
// limites aqui embaixo. Prompt não é cinto de segurança — código é.
// ============================================================
import { generateText, stepCountIs, type LanguageModel, type ModelMessage } from "ai";
import type { AgentConfig } from "./config";
import type { IssueContext } from "./issue-context";
import { createFsTools } from "./tools";
import { runVerification, type VerificationResult } from "./verify";
import { systemPrompt, initialUserMessage, verificationFeedback } from "./prompts";

export interface AgentLoopResult {
  success: boolean;
  attempts: number;
  totalTokens: number;
  stoppedByBudget: boolean;
  changedFiles: string[];
  summary: string; // texto final do modelo → vira corpo do PR
  lastVerification: VerificationResult;
}

// Costura para testes: a verificação real (shell) pode ser trocada por
// uma fake. Em produção/CI, usa a de verdade — `verify.ts`.
export interface AgentLoopDeps {
  verify?: typeof runVerification;
}

export async function runAgentLoop(
  model: LanguageModel,
  issue: IssueContext,
  config: AgentConfig,
  deps: AgentLoopDeps = {}
): Promise<AgentLoopResult> {
  const verify = deps.verify ?? runVerification;
  const { tools, getChangedFiles } = createFsTools({
    workDir: config.workDir,
    allowedPaths: config.allowedPaths,
  });

  let totalTokens = 0;
  let summary = "";
  let lastVerification: VerificationResult = {
    ok: false,
    failedCommand: null,
    output: "(verificação ainda não rodou)",
  };

  // A conversa sobrevive entre tentativas: o erro entra como mensagem
  // nova e o modelo decide a próxima edição com o contexto do que tentou.
  const messages: ModelMessage[] = [
    { role: "user", content: initialUserMessage(issue.renderedSection) },
  ];

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    const result = await generateText({
      model,
      instructions: systemPrompt,
      messages,
      tools,
      // Guardrail 1: teto de passos dentro da tentativa.
      stopWhen: stepCountIs(config.maxStepsPerAttempt),
    });

    totalTokens += result.totalUsage?.totalTokens ?? result.usage?.totalTokens ?? 0;
    summary = result.text.trim() || summary;

    // Guardrail 2: orçamento total de tokens. Estourou, encerra digno.
    if (totalTokens > config.maxTotalTokens) {
      return finish(false, attempt, true);
    }

    lastVerification = await verify(config.verifyCommands, config.workDir);
    if (lastVerification.ok) {
      return finish(true, attempt, false);
    }

    // O LOOP: o erro volta para o modelo como mensagem do usuário.
    messages.push(...result.response.messages);
    messages.push({
      role: "user",
      content: verificationFeedback(attempt, config.maxAttempts, lastVerification.output),
    });
  }

  return finish(false, config.maxAttempts, false);

  function finish(success: boolean, attempts: number, stoppedByBudget: boolean): AgentLoopResult {
    return {
      success,
      attempts,
      totalTokens,
      stoppedByBudget,
      changedFiles: getChangedFiles(),
      summary,
      lastVerification,
    };
  }
}
