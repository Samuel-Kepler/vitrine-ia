import type { FileNode } from "@/lib/file-system";
import { getModelConfig } from "@/lib/provider";
import { runDesignReview } from "@/lib/review/review";
import { friendlyAIError, isRateLimit } from "@/lib/ai-errors";
import { NoObjectGeneratedError, NoOutputGeneratedError } from "ai";

interface ReviewRequestBody {
  files?: Record<string, FileNode>;
}

export async function POST(req: Request) {
  const { files }: ReviewRequestBody = await req.json().catch(() => ({}));

  const hasCode = Object.values(files ?? {}).some(
    (n) => n.type === "file" && n.content?.trim()
  );
  if (!hasCode) {
    return Response.json(
      { error: "Nada para revisar: gere um componente primeiro." },
      { status: 400 }
    );
  }

  let config;
  try {
    config = getModelConfig();
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
  const { provider, modelId, model } = config;
  console.log(`[review] ${provider}/${modelId}`);

  try {
    const review = await runDesignReview(model, files!);
    // `review` já é um DesignReview validado: score, summary, issues[]
    return Response.json({ review, provider, modelId });
  } catch (error) {
    console.error(error);
    if (NoObjectGeneratedError.isInstance(error) || NoOutputGeneratedError.isInstance(error)) {
      return Response.json(
        { error: "O modelo não devolveu um review válido. Tente de novo." },
        { status: 502 }
      );
    }
    return Response.json(
      { error: friendlyAIError(error, provider) },
      { status: isRateLimit(error) ? 429 : 502 }
    );
  }
}

// Folga para esperar o limite por minuto do free tier.
export const maxDuration = 120;
