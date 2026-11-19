import { describe, expect, it } from "vitest";
import { starterDraft } from "@/lib/draft/starter";
import { draftToExpress } from "@/lib/draft/to-express";
import { compileResponse } from "@/lib/a2ui/agent";
import { reactProject } from "@/lib/export/react";
import { buildTools, projectContext, reactChatSystem, syntaxError } from "./agent";

function project() {
  const pages = [{ name: "Início", file: "index.html", messages: compileResponse(draftToExpress(starterDraft())).messages }];
  return new Map(reactProject(pages).map((f) => [f.path.replace(/^react/, ""), f.content]));
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = (t: any, input: unknown) => t.execute(input, { toolCallId: "t", messages: [] }) as Promise<string>;

describe("ferramentas do chat de código", () => {
  it("str_replace troca trecho único, recusa ambíguo e acusa erro de sintaxe", async () => {
    const files = project();
    const touched = new Set<string>();
    const tools = buildTools(files, touched, new Set());
    expect(await run(tools.str_replace, { path: "/src/pages/Inicio.tsx", old_str: '"café bom no centro"', new_str: '"Café novo"' })).toMatch(/^OK/);
    expect(files.get("/src/pages/Inicio.tsx")).toContain('"Café novo"');
    expect(touched.has("/src/pages/Inicio.tsx")).toBe(true);
    expect(await run(tools.str_replace, { path: "/src/pages/Inicio.tsx", old_str: "<Section", new_str: "<Section" })).toMatch(/aparece \d+ vezes/);
    expect(await run(tools.str_replace, { path: "/nao/existe.tsx", old_str: "a", new_str: "b" })).toMatch(/não existe/);
    const broken = await run(tools.str_replace, { path: "/src/pages/Inicio.tsx", old_str: "  );\n}", new_str: "  ;\n}" });
    expect(broken).toMatch(/ERRO DE SINTAXE/);
  });

  it("write_file cria arquivo; delete_file protege entradas, html e componentes base", async () => {
    const files = project();
    const touched = new Set<string>();
    const deleted = new Set<string>();
    const tools = buildTools(files, touched, deleted);
    expect(await run(tools.write_file, { path: "/src/components/Faq.tsx", content: "export function Faq() { return <section>FAQ</section>; }\n" })).toMatch(/^OK/);
    expect(await run(tools.write_file, { path: "src/x.tsx", content: "" })).toMatch(/caminho absoluto/);
    expect(await run(tools.delete_file, { path: "/src/entries/index.tsx" })).toMatch(/necessário/);
    expect(await run(tools.delete_file, { path: "/src/components/landing.tsx" })).toMatch(/necessário/);
    expect(await run(tools.delete_file, { path: "/src/components/Faq.tsx" })).toMatch(/^OK/);
    expect(deleted.has("/src/components/Faq.tsx")).toBe(true);
    expect(await run(tools.view_file, { path: "/src/pages/Inicio.tsx", start: 1, end: 2 })).toMatch(/^ {3}1\| /);
    expect(await run(tools.list_files, {})).toContain("/src/components/landing.tsx");
  });

  it("contexto inclui páginas, componentes e css; prompt fala de container queries e de não inventar", () => {
    const ctx = projectContext(project());
    expect(ctx).toContain("### /src/pages/Inicio.tsx");
    // componentes e CSS ficam fora do contexto inicial (limite de tokens por minuto)
    expect(ctx).not.toContain("### /src/components/landing.tsx");
    expect(ctx).toContain("/src/components/landing.tsx");
    expect(ctx.length).toBeLessThan(12_000);
    expect(reactChatSystem()).toMatch(/@3xl:/);
    expect(reactChatSystem()).toMatch(/Não invente fatos/);
    expect(syntaxError("/a.tsx", "export const x = <div>;")).toBeTruthy();
    expect(syntaxError("/a.css", "{")).toBeNull();
  });
});

describe("POST /api/react-chat", () => {
  it("mock avisa que precisa de IA, sem mudar nada", async () => {
    const { POST } = await import("@/app/api/react-chat/route");
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ message: "mude o título", files: { "/a.tsx": "x" }, settings: { kind: "mock" } }) }));
    const json = await res.json();
    expect(json).toMatchObject({ provider: "mock", changed: {}, error: "provedor mock" });
  });
  it("caminho inválido dá 400", async () => {
    const { POST } = await import("@/app/api/react-chat/route");
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ message: "oi tudo", files: { "../etc/passwd": "x" } }) }));
    expect(res.status).toBe(400);
  });
});

describe("newFacts", () => {
  it("aponta horários, preços e porcentagens novos; ignora classes e o que já existia", async () => {
    const { newFacts } = await import("./agent");
    const before = { "/a.tsx": '<Feature text={"abre 7h da manhã"} />\n<Section className="py-14 @3xl:py-20">' };
    const after = { "/a.tsx": before["/a.tsx"] + '\n<li>Abrimos das 7h às 19h, café a R$ 7,90 com 15% off</li>\n<div className="h-12 w-1/2 py-24 @5xl:p-10" />' };
    expect(newFacts(before, after)).toEqual(["19h", "R$ 7,90", "15%"]);
    expect(newFacts(before, before)).toEqual([]);
  });
});
