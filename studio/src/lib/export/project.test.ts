import { describe, expect, it } from "vitest";
import { starterDraft } from "@/lib/draft/starter";
import { inferFromDraft } from "@/lib/infer/from-draft";
import { expandArch, expandDb } from "@/lib/infer/expand";
import { hasProjectContent, projectFiles, WEB_PORT } from "./project";

const HTML = "<!doctype html><html><body><h1>Café Aurora</h1></body></html>";

function full() {
  const s = inferFromDraft(starterDraft());
  return { arch: expandArch(s.arch), db: expandDb(s.db) };
}
const paths = (fs: { path: string }[]) => fs.map((f) => f.path);

describe("projectFiles", () => {
  it("junta landing, backend e banco, com serviço web no compose", () => {
    const { arch, db } = full();
    const files = projectFiles({ landingHtml: HTML, arch, db });
    const p = paths(files);
    expect(p[0]).toBe("README.md");
    expect(p).toContain("web/index.html");
    expect(p).toContain("docker-compose.yml");
    expect(p).toContain("db/schema.postgres.sql");
    expect(p.filter((x) => x === "README.md")).toHaveLength(1);
    expect(new Set(p).size).toBe(p.length);
    const compose = files.find((f) => f.path === "docker-compose.yml")!.content;
    expect(compose).toMatch(/^services:\n  web:\n    image: nginx/m);
    expect(compose).toContain(`"${WEB_PORT}:80"`);
    expect(compose).toContain("./web:/usr/share/nginx/html:ro");
    const readme = files[0].content;
    expect(readme).toContain(`http://localhost:${WEB_PORT}`);
    expect(readme).toMatch(/## Backend: /);
    expect(files.find((f) => f.path === "web/index.html")!.content).toBe(HTML);
  });

  it("sem Reimaginar: exporta backend sem web e avisa no README", () => {
    const { arch, db } = full();
    const files = projectFiles({ landingHtml: null, arch, db });
    expect(paths(files)).not.toContain("web/index.html");
    expect(files.find((f) => f.path === "docker-compose.yml")!.content).not.toContain("nginx");
    expect(files[0].content).toContain("Reimaginar");
  });

  it("só landing: README ensina abrir o HTML", () => {
    const files = projectFiles({ landingHtml: HTML, arch: { nodes: [], edges: [] }, db: { tables: [], relations: [] } });
    expect(paths(files)).toEqual(["README.md", "web/index.html"]);
    expect(files[0].content).toContain("npx serve web");
  });

  it("só banco: inclui os schemas em db/", () => {
    const { db } = full();
    const files = projectFiles({ landingHtml: null, arch: { nodes: [], edges: [] }, db });
    expect(paths(files)).toContain("db/schema.dbml");
    expect(paths(files)).not.toContain("docker-compose.yml");
  });

  it("nada desenhado: botão desabilitado", () => {
    expect(hasProjectContent({ landingHtml: null, arch: { nodes: [], edges: [] }, db: { tables: [], relations: [] } })).toBe(false);
  });
});
