// AULA 2 — parte 6 do ciclo: ESTADO E GUARDRAILS.
//
// Toda configuração do agente é env-var, com default seguro. Em produção
// esses valores vêm do workflow (`.github/workflows/agent-loop.yml`); em
// aula, o aluno roda local e brinca com os limites para ver o que muda.

export interface AgentConfig {
  // Quantas vezes o ciclo "editar → verificar" pode repetir antes de
  // o agente desistir e pedir ajuda humana. O erro de cada tentativa
  // volta para o modelo na próxima — isso é o loop.
  maxAttempts: number;

  // Teto de tool calls dentro de UMA tentativa (stopWhen do AI SDK).
  maxStepsPerAttempt: number;

  // Orçamento total de tokens da rodada inteira. Estourou, para.
  maxTotalTokens: number;

  // Únicos caminhos (prefixos relativos à raiz do repo) que o agente
  // pode ler e escrever. Fora disso a tool recusa a chamada.
  allowedPaths: string[];

  // Comandos de verificação rodados DEPOIS de cada tentativa.
  verifyCommands: string[];

  // Raiz do repo no disco (no runner é o checkout).
  workDir: string;

  // Limite de caracteres do texto da issue que entra no prompt.
  // Issue é input não confiável — truncar também limita injeção.
  maxIssueBodyChars: number;
}

export const DEFAULT_ALLOWED_PATHS = ["agent/demo-site/"];
export const DEFAULT_VERIFY_COMMANDS = ["npm run lint", "npm test -- --run"];

function intFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function csvFromEnv(name: string, fallback: string[]): string[] {
  const raw = process.env[name];
  if (!raw) return [...fallback];
  const items = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return items.length > 0 ? items : [...fallback];
}

export function loadConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    maxAttempts: intFromEnv("AGENT_MAX_ATTEMPTS", 3),
    maxStepsPerAttempt: intFromEnv("AGENT_MAX_STEPS", 10),
    maxTotalTokens: intFromEnv("AGENT_MAX_TOKENS", 120_000),
    allowedPaths: csvFromEnv("AGENT_ALLOWED_PATHS", DEFAULT_ALLOWED_PATHS),
    verifyCommands: csvFromEnv("AGENT_VERIFY_COMMANDS", DEFAULT_VERIFY_COMMANDS),
    workDir: process.env.AGENT_WORKDIR || process.cwd(),
    maxIssueBodyChars: intFromEnv("AGENT_MAX_ISSUE_BODY_CHARS", 4_000),
    ...overrides,
  };
}
