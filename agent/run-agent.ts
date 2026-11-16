// Entrypoint rodado pelo workflow (`.github/workflows/agent-loop.yml`)
// e localmente pelo aluno:
//
//   ISSUE_NUMBER=12 ISSUE_TITLE="..." ISSUE_BODY="..." \
//     npx tsx agent/run-agent.ts
//
// Lê a issue das env vars, roda o loop e grava um relatório JSON que o
// workflow usa para montar o PR (plano, arquivos, resultado dos testes).
import { promises as fs } from "node:fs";
import { getModelConfig } from "@/lib/provider";
import { loadConfig } from "./config";
import { buildIssueContext } from "./issue-context";
import { runAgentLoop } from "./loop";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`env ${name} é obrigatória`);
    process.exit(2);
  }
  return value;
}

async function main() {
  const issue = buildIssueContext({
    number: Number(requireEnv("ISSUE_NUMBER")),
    title: requireEnv("ISSUE_TITLE"),
    body: process.env.ISSUE_BODY ?? "",
    labels: (process.env.ISSUE_LABELS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  });

  const config = loadConfig();
  const { provider, modelId, model } = getModelConfig();
  console.log(`[agent] issue #${issue.number} "${issue.goal}"`);
  console.log(`[agent] provedor=${provider} modelo=${modelId}`);
  console.log(`[agent] branch=${issue.branchName} allowlist=${config.allowedPaths.join(", ")}`);

  const result = await runAgentLoop(model, issue, config);

  const report = {
    issueNumber: issue.number,
    branch: issue.branchName,
    provider,
    modelId,
    ...result,
  };
  const reportPath = process.env.AGENT_REPORT_PATH ?? "agent-report.json";
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log(`[agent] sucesso=${result.success} tentativas=${result.attempts} tokens=${result.totalTokens}`);
  console.log(`[agent] arquivos: ${result.changedFiles.join(", ") || "(nenhum)"}`);
  console.log(`[agent] relatório em ${reportPath}`);

  if (!result.success) process.exit(1);
}

main().catch((error) => {
  console.error("[agent] falha fatal:", error);
  process.exit(1);
});
