import { describe, expect, it } from "vitest";
import { reactProject } from "@/lib/export/react";
import { compileResponse } from "@/lib/a2ui/agent";
import { draftToExpress } from "@/lib/draft/to-express";
import { starterDraft } from "@/lib/draft/starter";
import { isAiEditablePath, isCleanAbsolutePath, isSafeZipPath } from "./paths";

describe("isAiEditablePath", () => {
  it.each(["/src/pages/Inicio.tsx", "/src/components/Faq.tsx", "/src/index.css", "/src/lib/util.ts", "/cardapio.html", "/index.html"])(
    "permite %s",
    (p) => expect(isAiEditablePath(p)).toBe(true),
  );
  it.each([
    "/package.json",
    "/vite.config.ts",
    "/vite.config.js",
    "/tsconfig.json",
    "/.npmrc",
    "/.env",
    "/src/.env",
    "/src/../package.json",
    "/src//x.tsx",
    "/src/x.json",
    "/scripts/postinstall.js",
    "/public/x.html",
    "src/x.tsx",
    "/src\\x.tsx",
  ])("bloqueia %j", (p) => expect(isAiEditablePath(p)).toBe(false));
});

describe("isCleanAbsolutePath", () => {
  it("aceita os arquivos do projeto React gerado, inclusive package.json", () => {
    expect(isCleanAbsolutePath("/package.json")).toBe(true);
    expect(isCleanAbsolutePath("/src/pages/Inicio.tsx")).toBe(true);
  });
  it("recusa travessia e ocultos", () => {
    expect(isCleanAbsolutePath("/../etc/passwd")).toBe(false);
    expect(isCleanAbsolutePath("/a/./b")).toBe(false);
    expect(isCleanAbsolutePath("/.npmrc")).toBe(false);
  });
});

describe("isSafeZipPath", () => {
  it.each(["react/package.json", "backend/.env.example", "backend/.dockerignore", "db/schema.prisma", "a/b/c.ts"])("aceita %s", (p) =>
    expect(isSafeZipPath(p)).toBe(true),
  );
  it.each(["../x", "a/../../x", "/etc/passwd", "C:/x", "a\\..\\x", "a//b", "./a"])("recusa %j", (p) => expect(isSafeZipPath(p)).toBe(false));

  it("todos os arquivos do projeto React exportado passam", () => {
    const pages = [{ name: "Início", file: "index.html", messages: compileResponse(draftToExpress(starterDraft())).messages }];
    for (const f of reactProject(pages)) expect(isSafeZipPath(f.path), f.path).toBe(true);
  });
});
