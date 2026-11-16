import { describe, expect, it } from "vitest";
import { VirtualFileSystem } from "@/lib/file-system";
import { withSyntaxCheck } from "@/lib/tools/str-replace";

describe("withSyntaxCheck", () => {
  it("devolve o resultado normal quando o JSX compila", () => {
    const fs = new VirtualFileSystem();
    const result = fs.createFileWithParents(
      "/App.jsx",
      "export default function App() { return <div className=\"p-4\">oi</div>; }"
    );
    expect(withSyntaxCheck(fs, "/App.jsx", result)).toBe(result);
  });

  it("avisa o modelo quando o JSX tem erro de sintaxe", () => {
    const fs = new VirtualFileSystem();
    // Erro real gerado pelo gpt-oss no Groq: um ")" sobrando no className
    const broken =
      "export default function Nav() { return <ul className={`a ${x}`)}><li /></ul>; }";
    const result = fs.createFileWithParents("/components/Nav.jsx", broken);
    const checked = withSyntaxCheck(fs, "/components/Nav.jsx", result);
    expect(checked).toContain("ERRO DE SINTAXE em /components/Nav.jsx");
    expect(checked).toContain("str_replace");
  });

  it("ignora arquivos que não são JS/TS", () => {
    const fs = new VirtualFileSystem();
    const result = fs.createFileWithParents("/styles.css", "a { color: red; ");
    expect(withSyntaxCheck(fs, "/styles.css", result)).toBe(result);
  });
});
