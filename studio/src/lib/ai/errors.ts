// Traduz erros de provedor para mensagens úteis em português.
import { APICallError, RetryError } from "ai";
import type { ProviderKind } from "./settings";

function rootCause(error: unknown): unknown {
  if (RetryError.isInstance(error)) return error.errors.find(isRateLimit) ?? error.lastError;
  return error;
}

function isRateLimit(error: unknown): boolean {
  if (APICallError.isInstance(error)) return error.statusCode === 429 || /rate limit/i.test(error.message);
  return error instanceof Error && /rate limit/i.test(error.message);
}

function isConnectionError(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string }; message?: string } | undefined;
  const code = e?.code ?? e?.cause?.code;
  return (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    /ECONNREFUSED|fetch failed|ENOTFOUND/i.test(e?.message ?? "") ||
    (APICallError.isInstance(error) && !error.statusCode)
  );
}

export function friendlyAIError(error: unknown, kind: ProviderKind, baseURL?: string): string {
  const cause = rootCause(error);
  // Pedido maior que o limite por minuto (ex.: Groq free tier, 8 mil tokens/min):
  // esperar não resolve, precisa diminuir o pedido ou trocar de provedor.
  if (cause instanceof Error && /request too large|reduce your message size|context.{0,20}(length|window)/i.test(cause.message)) {
    return `O pedido ficou grande demais para o limite do ${kind}${kind === "groq" ? " (free tier: ~8 mil tokens por minuto)" : ""}. Tente um pedido mais curto, um projeto menor ou outro provedor na engrenagem.`;
  }
  if (isRateLimit(cause)) {
    const daily = /per day|TPD|RPD|daily/i.test((cause as Error).message ?? "");
    return daily
      ? `A cota diária do ${kind} para este modelo acabou. Troque de modelo na engrenagem ou tente amanhã.`
      : `Limite de uso do ${kind} atingido${kind === "groq" ? " (free tier: ~8 mil tokens por minuto)" : ""}. Espere cerca de 1 minuto e tente de novo.`;
  }
  if (APICallError.isInstance(cause) && (cause.statusCode === 401 || cause.statusCode === 403)) {
    return `A chave do ${kind} foi recusada (${cause.statusCode}). Confira a chave.`;
  }
  if (APICallError.isInstance(cause) && cause.statusCode === 404 && (kind === "ollama" || kind === "openai-compatible")) {
    return `O servidor local respondeu 404: o modelo não existe lá. No Ollama, rode "ollama pull <modelo>" ou escolha outro na engrenagem.`;
  }
  if (isConnectionError(cause)) {
    if (kind === "ollama") return `Não consegui falar com o Ollama em ${baseURL}. Ele está aberto? (ollama serve)`;
    if (kind === "openai-compatible") return `Não consegui falar com o servidor local em ${baseURL}. Ele está rodando?`;
    return `Não deu para conectar ao ${kind}. Confira a internet e tente de novo.`;
  }
  return cause instanceof Error ? cause.message : "Erro desconhecido na chamada ao modelo.";
}
