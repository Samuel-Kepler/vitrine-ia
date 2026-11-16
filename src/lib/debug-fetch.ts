// Mostra as requisições HTTP que o AI SDK faz ao provedor (Anthropic, Groq...).
//
// Todo provedor do AI SDK aceita um `fetch` próprio. Aqui embrulhamos o fetch
// padrão: ele loga um resumo no terminal e salva o corpo da requisição e da
// resposta (o stream cru) em logs/ai/. Liga com AI_DEBUG=1 (npm run dev:debug).
//
// Segurança: os headers NÃO são salvos (é onde vai a chave da API) e o
// parâmetro ?key= é apagado da URL.
import fs from "node:fs";
import path from "node:path";

type Json = Record<string, unknown>;

export function isAIDebug(env: Record<string, string | undefined> = process.env) {
  return env.AI_DEBUG === "1" || env.AI_DEBUG === "true";
}

export function redactUrl(url: string) {
  return url.replace(/([?&]key=)[^&]+/i, "$1***");
}

function kb(bytes: number) {
  return `${(bytes / 1024).toFixed(1).replace(".", ",")} KB`;
}

// Resumo em uma linha, para os formatos OpenAI (Groq, OpenRouter),
// Anthropic e Google.
export function summarizeRequest(body: Json, url: string, bytes: number): string {
  const model =
    (body.model as string | undefined) ?? url.match(/models\/([^:/?]+)/)?.[1] ?? "?";
  const messages = (body.messages ?? body.contents) as unknown[] | undefined;
  const rawTools = (body.tools ?? []) as Json[];
  const toolNames = rawTools.flatMap((t) => {
    if (Array.isArray(t.functionDeclarations))
      return (t.functionDeclarations as Json[]).map((f) => f.name as string);
    return [((t.function as Json | undefined)?.name ?? t.name) as string];
  });
  const choice = body.tool_choice ?? (body.toolConfig as Json | undefined)?.functionCallingConfig;
  const choiceText =
    choice === undefined
      ? "auto"
      : typeof choice === "string"
        ? choice
        : JSON.stringify(choice);

  return [
    model,
    `${messages?.length ?? 0} mensagens`,
    toolNames.length ? `tools [${toolNames.join(", ")}]` : "sem tools",
    `tool_choice=${choiceText}`,
    kb(bytes),
  ].join(" · ");
}

const sessionDir = path.join(
  process.cwd(),
  "logs",
  "ai",
  new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
);
let seq = 0;

function save(file: string, content: string) {
  try {
    fs.mkdirSync(sessionDir, { recursive: true });
    fs.writeFileSync(path.join(sessionDir, file), content);
  } catch (error) {
    console.error("[ai-debug] não consegui salvar o log:", error);
  }
}

export function createDebugFetch(provider: string): typeof fetch {
  return async (input, init) => {
    const n = ++seq;
    const id = String(n).padStart(3, "0");
    const url = redactUrl(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const rawBody = typeof init?.body === "string" ? init.body : "";
    let body: Json = {};
    try {
      body = JSON.parse(rawBody);
    } catch {}

    const short = url.replace(/^https?:\/\/[^/]+/, "");
    console.log(`[ai-debug] → #${n} ${provider} ${init?.method ?? "GET"} ${short} · ${summarizeRequest(body, url, rawBody.length)}`);
    save(`${id}-${provider}-request.json`, JSON.stringify({ url, method: init?.method, body }, null, 2));

    const started = Date.now();
    const res = await fetch(input, init);
    const head = `[ai-debug] ← #${n} ${res.status} em ${((Date.now() - started) / 1000).toFixed(1)} s`;

    if (!res.body) {
      console.log(head);
      return res;
    }

    // Duplica o stream: um vai para o AI SDK, o outro é gravado no arquivo.
    const [forSdk, forLog] = res.body.tee();
    void (async () => {
      const reader = forLog.getReader();
      const decoder = new TextDecoder();
      let text = "";
      let firstChunkMs: number | undefined;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        firstChunkMs ??= Date.now() - started;
        text += decoder.decode(value, { stream: true });
      }
      const events = (text.match(/^data: /gm) ?? []).length;
      const total = ((Date.now() - started) / 1000).toFixed(1);
      console.log(
        `${head} · 1º pedaço em ${((firstChunkMs ?? 0) / 1000).toFixed(1)} s · fim em ${total} s · ` +
          `${events ? `${events} eventos SSE · ` : ""}${kb(text.length)}`
      );
      save(`${id}-${provider}-response.${events ? "sse.txt" : "json"}`, text);
    })().catch((error) => console.error("[ai-debug] erro lendo a resposta:", error));

    return new Response(forSdk, { status: res.status, statusText: res.statusText, headers: res.headers });
  };
}
