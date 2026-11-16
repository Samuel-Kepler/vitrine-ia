import type { FileNode } from "@/lib/file-system";
import { VirtualFileSystem } from "@/lib/file-system";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { buildStrReplaceTool } from "@/lib/tools/str-replace";
import { buildFileManagerTool } from "@/lib/tools/file-manager";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getModelConfig } from "@/lib/provider";
import { generationPrompt } from "@/lib/prompts/generation";
import { friendlyAIError } from "@/lib/ai-errors";

interface ChatRequestBody {
  messages: UIMessage[];
  files: Record<string, FileNode>;
  projectId?: string;
}

export async function POST(req: Request) {
  const { messages, files, projectId }: ChatRequestBody = await req.json();

  // Reconstrói o sistema de arquivos virtual que veio do cliente
  const fileSystem = new VirtualFileSystem();
  fileSystem.deserializeFromNodes(files);

  const tools = {
    str_replace_editor: buildStrReplaceTool(fileSystem),
    file_manager: buildFileManagerTool(fileSystem),
  };

  let config;
  try {
    config = getModelConfig();
  } catch (error) {
    // Erro de configuração (provedor inválido ou chave ausente)
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
  const { provider, modelId, model } = config;
  console.log(`[chat] ${provider}/${modelId}`);

  // Projeto vazio = o usuário quer criar algo. Modelos abertos (ex.: gpt-oss
  // no Groq) às vezes "respondem" colando o código no chat em vez de chamar
  // a ferramenta, e aí nenhum arquivo é criado. Nesses provedores, o 1º passo
  // é obrigado a usar a ferramenta. O Haiku segue o prompt sozinho e ainda
  // escreve a frase de abertura em stream, então deixamos livre.
  const isNewProject = !fileSystem.getNode("/")?.children?.size;
  const forceFirstTool = isNewProject && provider !== "anthropic" && provider !== "mock";

  const result = streamText({
    model,
    // System prompt. O providerOptions de cache só é lido pela Anthropic;
    // os outros provedores ignoram.
    instructions: {
      role: "system",
      content: generationPrompt,
      providerOptions: {
        anthropic: { cacheControl: { type: "ephemeral" } },
      },
    },
    messages: await convertToModelMessages(messages, { tools }),
    tools,
    // Landing pages completas passam fácil de 10k tokens. Se o limite
    // estourar (finishReason "length"), o loop para no meio.
    maxOutputTokens: 32_000,
    // Loop agêntico: o modelo pode chamar ferramentas várias vezes
    // até terminar. O mock usa poucos passos para não se repetir.
    stopWhen: isStepCount(provider === "mock" ? 4 : 40),
    // Regra determinística em vez de torcer pelo modelo: no 1º passo de um
    // projeto novo, ele é OBRIGADO a chamar str_replace_editor.
    // Free tiers limitam tokens por minuto (Groq: 8 mil). Quando o provedor
    // responde 429, o SDK espera o tempo do header retry-after e tenta de novo.
    maxRetries: 6,
    prepareStep: ({ stepNumber }) =>
      stepNumber === 0 && forceFirstTool
        ? { toolChoice: { type: "tool", toolName: "str_replace_editor" } }
        : undefined,
    onError: ({ error }) => {
      console.error(error);
    },
    onFinish: ({ finishReason, steps, totalUsage }) => {
      console.log(
        `[chat] fim: ${finishReason} · ${steps.length} passos · ${totalUsage.outputTokens ?? "?"} tokens de saída`
      );
      // Roteadores como openrouter/free podem trocar de modelo a cada passo.
      const used = [...new Set(steps.map((s) => s.response.modelId))];
      if (used.length && used.join() !== modelId) console.log(`[chat] modelos usados: ${used.join(", ")}`);
    },
  });

  const stream = toUIMessageStream({
    stream: result.stream,
    tools,
    originalMessages: messages,
    // Sem isso o navegador recebe só "An error occurred.".
    onError: (error) => friendlyAIError(error, provider),
    redactToolErrors: false,
    onEnd: async ({ messages: allMessages }) => {
      if (!projectId) return;

      // Persiste conversa + arquivos se o usuário estiver autenticado
      try {
        const session = await getSession();
        if (!session) {
          console.error("User not authenticated, cannot save project");
          return;
        }

        await prisma.project.update({
          where: { id: projectId, userId: session.userId },
          data: {
            messages: JSON.stringify(allMessages),
            data: JSON.stringify(fileSystem.serialize()),
          },
        });
      } catch (error) {
        console.error("Failed to save project data:", error);
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}

export const maxDuration = 120;
