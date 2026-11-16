// Traduz uma tool call (part da mensagem) em um passo legível da timeline.
// Função pura: fácil de testar e de explicar em aula.
import { getToolName, type ToolUIPart, type DynamicToolUIPart } from "ai";

export type StepState = "running" | "done" | "error" | "interrupted";

export interface AgentStep {
  verb: string; // "criando", "editando"...
  target: string; // "/App.jsx"
  tool: string; // nome técnico da ferramenta
  command?: string;
  state: StepState;
}

const VERBS: Record<string, [running: string, done: string]> = {
  create: ["criando", "criou"],
  str_replace: ["editando", "editou"],
  insert: ["inserindo em", "inseriu em"],
  view: ["lendo", "leu"],
  undo_edit: ["desfazendo", "desfez"],
  rename: ["movendo", "moveu"],
  delete: ["apagando", "apagou"],
  list: ["listando", "listou"],
};

// `live` = a resposta ainda está chegando. Se já terminou e a tool não
// tem resultado, o loop foi interrompido (ex.: limite de tokens).
export function toolPartToStep(part: ToolUIPart | DynamicToolUIPart, live = true): AgentStep {
  const input = (part.input ?? {}) as { command?: string; path?: string; new_path?: string };
  const state: StepState =
    part.state === "output-available"
      ? "done"
      : part.state === "output-error"
        ? "error"
        : live
          ? "running"
          : "interrupted";
  const [running, done] = VERBS[input.command ?? ""] ?? ["chamando", "chamou"];
  const target = input.new_path ? `${input.path} → ${input.new_path}` : (input.path ?? "…");
  return {
    verb: state === "running" ? running : state === "interrupted" ? "interrompido" : done,
    target,
    tool: getToolName(part),
    command: input.command,
    state,
  };
}
