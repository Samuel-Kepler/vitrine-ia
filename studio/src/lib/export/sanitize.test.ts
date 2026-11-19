// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { escapeHtml, isSafeLinkUrl, isSafeMediaUrl, sanitizeBodyHtml, sanitizeCss } from "./sanitize";

describe("isSafeLinkUrl", () => {
  it.each(["https://exemplo.com", "http://x.y", "mailto:a@b.com", "tel:+5511999999999", "#contato", "/sobre", "./a"])(
    "aceita %s",
    (url) => expect(isSafeLinkUrl(url)).toBe(true),
  );
  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    " java\tscript:alert(1)",
    "java\nscript:alert(1)",
    "vbscript:msgbox(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
  ])("bloqueia %j", (url) => expect(isSafeLinkUrl(url)).toBe(false));
});

describe("isSafeMediaUrl", () => {
  it("aceita https e imagem raster em data:", () => {
    expect(isSafeMediaUrl("https://images.unsplash.com/x.jpg")).toBe(true);
    expect(isSafeMediaUrl("data:image/png;base64,iVBORw0KGgo=")).toBe(true);
  });
  it("bloqueia SVG e HTML em data:, e javascript:", () => {
    expect(isSafeMediaUrl("data:image/svg+xml,<svg onload=alert(1)>")).toBe(false);
    expect(isSafeMediaUrl("data:text/html,<script>")).toBe(false);
    expect(isSafeMediaUrl("javascript:alert(1)")).toBe(false);
  });
});

describe("sanitizeBodyHtml", () => {
  it("remove scripts, iframes e handlers on*", () => {
    const out = sanitizeBodyHtml(
      `<h1 onclick="alert(1)">Oi</h1><script>alert(1)</script><iframe src="https://x"></iframe><img src="https://a/b.png" onerror="alert(1)">`,
    );
    expect(out).not.toMatch(/script|iframe|onclick|onerror/i);
    expect(out).toContain("<h1>Oi</h1>");
    expect(out).toContain('src="https://a/b.png"');
  });

  it("troca href perigoso por # e remove src perigoso", () => {
    const out = sanitizeBodyHtml(
      `<a href="data:text/html,x">a</a><a href="https://ok.com">b</a><img src="data:image/svg+xml,<svg>">`,
    );
    expect(out).toContain('<a href="#">a</a>');
    expect(out).toContain('<a href="https://ok.com">b</a>');
    expect(out).not.toContain("svg+xml");
  });

  it("limpa url() perigoso no style e mantém o resto", () => {
    const out = sanitizeBodyHtml(
      `<section style="color: red; background-image: url('javascript:alert(1)')">x</section><div style="background-image: url(&quot;https://a/b.jpg&quot;)">y</div>`,
    );
    expect(out).toContain("color: red");
    expect(out).not.toContain("javascript");
    expect(out).toContain("https://a/b.jpg");
  });

  it("protege target=_blank com rel=noopener", () => {
    expect(sanitizeBodyHtml(`<a href="https://x" target="_blank">x</a>`)).toContain('rel="noopener noreferrer"');
  });

  it("limpa dentro de declarative shadow DOM e preserva o template", () => {
    const out = sanitizeBodyHtml(
      `<div><template shadowrootmode="open"><style>p{color:red}</style><p onmouseover="x()">t</p><a href="javascript:x()">l</a><script>x()</script></template></div>`,
    );
    expect(out).toContain('<template shadowrootmode="open">');
    expect(out).toContain("<style>p{color:red}</style>");
    expect(out).not.toMatch(/onmouseover|javascript|<script/i);
  });

  it("não deixa texto virar tag", () => {
    const out = sanitizeBodyHtml(`<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>`);
    expect(out).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
  });
});

describe("sanitizeCss e escapeHtml", () => {
  it("não deixa o CSS fechar a tag <style>", () => {
    expect(sanitizeCss(`a{} </style><script>x()</script>`)).not.toContain("</style");
  });
  it("escapa o título", () => {
    expect(escapeHtml(`<b>"Café" & Cia</b>`)).toBe("&lt;b&gt;&quot;Café&quot; &amp; Cia&lt;/b&gt;");
  });
});
