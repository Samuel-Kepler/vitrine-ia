// Traduz erros do provedor para uma mensagem que o aluno entende.
// O padrão do AI SDK é mandar só "An error occurred." para o navegador.
import { APICallError, RetryError } from "ai";

function rootCause(error: unknown): unknown {
  // Depois de esgotar as tentativas, o SDK embrulha tudo num RetryError.
  if (RetryError.isInstance(error)) {
    const rateLimited = error.errors.find((e) => isRateLimit(e));
    return rateLimited ?? error.lastError;
  }
  return error;
}

export function isRateLimit(error: unknown): boolean {
  if (RetryError.isInstance(error)) return error.errors.some(isRateLimit);
  if (APICallError.isInstance(error)) {
    return error.statusCode === 429 || /rate limit/i.test(error.message);
  }
  return error instanceof Error && /rate limit/i.test(error.message);
}

export function friendlyAIError(error: unknown, provider: string): string {
  const cause = rootCause(error);
  if (isRateLimit(cause) && /per day|TPD|RPD|daily/i.test((cause as Error).message ?? "")) {
    return (
      `A cota diária do ${provider} para este modelo acabou. Cada modelo tem a sua cota: ` +
      `troque o AI_MODEL no .env (ex.: openai/gpt-oss-20b no Groq) ou tente amanhã.`
    );
  }
  if (isRateLimit(cause)) {
    const hint = provider === "groq" ? " (free tier: 8 mil tokens por minuto)" : "";
    return (
      `Limite de uso do ${provider} atingido${hint}. ` +
      `Espere cerca de 1 minuto e mande "continue": os arquivos já criados ficam salvos.`
    );
  }
  if (APICallError.isInstance(cause) && cause.statusCode === 401) {
    return `A chave do ${provider} foi recusada (401). Confira a chave no .env.`;
  }
  if (APICallError.isInstance(cause) && !cause.statusCode) {
    return `Não deu para conectar ao ${provider}. Confira a internet e tente de novo.`;
  }
  return cause instanceof Error ? cause.message : "Erro desconhecido na chamada ao modelo.";
}
