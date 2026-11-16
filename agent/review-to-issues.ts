// Fecha o ciclo com a Aula 1: roda o Design Review no site do cliente
// e transforma o resultado em issues do GitHub.
//
//   npx tsx agent/review-to-issues.ts --dry-run   # só mostra os rascunhos
//   npx tsx agent/review-to-issues.ts --create    # cria as issues (precisa de GH_TOKEN)
//
// Depende de `src/lib/review/review.ts` (Aula 1) e do contrato
// `src/lib/review/schema.ts` (já commitado): DesignReview -> reviewToIssues.
import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getModelConfig } from "@/lib/provider";
import { reviewToIssues, type GitHubIssueDraft } from "@/lib/review/schema";

// `src/lib/review/review.ts` é da Aula 1. Se você rodou isto antes do
// rebase no push da Aula 1, o erro abaixo explica o que fazer.
async function loadReview() {
  try {
    return (await import("@/lib/review/review")).runDesignReview;
  } catch {
    console.error(
      "[review-to-issues] src/lib/review/review.ts ainda não existe nesta branch.\n" +
        "Esse arquivo é da Aula 1 (Design Review). Faça o rebase depois que ela\n" +
        "fizer o push, ou rode primeiro só o agent-loop com issues criadas à mão."
    );
    process.exit(2);
  }
}
import type { FileNode } from "@/lib/file-system";

const run = promisify(execFile);

const SITE_DIR = process.env.REVIEW_SITE_DIR ?? "agent/demo-site";

// Lê o site do disco no formato que o Design Review espera (mesmo
// formato do FS virtual do app: Record<caminho, FileNode>).
async function siteFilesToNodes(dir: string): Promise<Record<string, FileNode>> {
  const files: Record<string, FileNode> = {};
  async function walk(rel: string) {
    for (const entry of await fs.readdir(path.join(dir, rel), { withFileTypes: true })) {
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(childRel);
      else if (/\.(html|css|js)$/.test(entry.name)) {
        files[`/demo-site/${childRel}`] = {
          type: "file",
          name: entry.name,
          path: `/demo-site/${childRel}`,
          content: await fs.readFile(path.join(dir, childRel), "utf8"),
        };
      }
    }
  }
  await walk("");
  return files;
}

async function gh(args: string[]): Promise<string> {
  const { stdout } = await run("gh", args);
  return stdout;
}

// Dedup por marcador estável: cada issue criada carrega
// `<!-- design-review-id: <slug> -->` no corpo (vindo de reviewToIssues).
const ID_MARKER = /<!-- design-review-id: (\S+) -->/;

async function existingReviewIds(): Promise<Set<string>> {
  const out = await gh([
    "issue", "list", "--label", "design-review", "--state", "open",
    "--limit", "100", "--json", "body", "--jq", ".[].body",
  ]);
  const ids = new Set<string>();
  for (const line of out.split("\n")) {
    const m = ID_MARKER.exec(line);
    if (m) ids.add(m[1]);
  }
  return ids;
}

async function createIssue(draft: GitHubIssueDraft): Promise<string> {
  const out = await gh([
    "issue", "create",
    "--title", draft.title,
    "--body", draft.body,
    ...draft.labels.flatMap((label) => ["--label", label]),
  ]);
  return out.trim(); // URL da issue criada
}

async function main() {
  const create = process.argv.includes("--create");

  const nodes = await siteFilesToNodes(SITE_DIR);
  console.log(`[review-to-issues] ${Object.keys(nodes).length} arquivos de ${SITE_DIR}`);

  const { provider, modelId, model } = getModelConfig();
  console.log(`[review-to-issues] review com ${provider}/${modelId}`);

  const runDesignReview = await loadReview();
  const review = await runDesignReview(model, nodes);
  console.log(`[review-to-issues] score=${review.score} — ${review.summary}`);

  const drafts = reviewToIssues(review);
  if (!create) {
    console.log(JSON.stringify(drafts, null, 2));
    return;
  }

  const existing = await existingReviewIds();
  for (const draft of drafts) {
    const id = ID_MARKER.exec(draft.body)?.[1];
    if (id && existing.has(id)) {
      console.log(`[review-to-issues] pulando (já existe issue aberta): ${id}`);
      continue;
    }
    const url = await createIssue(draft);
    console.log(`[review-to-issues] criada: ${url}`);
  }
}

main().catch((error) => {
  console.error("[review-to-issues] falha:", error);
  process.exit(1);
});
