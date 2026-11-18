"use client";

export function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function cssOf(sheets: Iterable<CSSStyleSheet>): string {
  const out: string[] = [];
  for (const sheet of sheets) {
    try {
      for (const rule of Array.from(sheet.cssRules)) out.push(rule.cssText);
    } catch {
      /* folha de outra origem: ignora */
    }
  }
  return out.join("\n");
}

function shadowRootsIn(root: Element): ShadowRoot[] {
  const roots: ShadowRoot[] = [];
  const walk = (el: Element | ShadowRoot) => {
    for (const child of Array.from(el.children)) {
      if (child.shadowRoot) {
        roots.push(child.shadowRoot);
        walk(child.shadowRoot);
      }
      walk(child);
    }
  };
  walk(root);
  return roots;
}

/**
 * Gera um HTML estático da landing renderizada: copia o DOM (incluindo
 * shadow DOM dos componentes A2UI, como declarative shadow DOM) e o CSS.
 */
export function exportStandaloneHtml(frame: HTMLElement): string {
  const roots = shadowRootsIn(frame);
  const withShadow = frame as HTMLElement & { getHTML?: (o: unknown) => string };
  const body =
    typeof withShadow.getHTML === "function"
      ? withShadow.getHTML({ serializableShadowRoots: true, shadowRoots: roots })
      : frame.innerHTML;
  const css = cssOf([...Array.from(document.styleSheets), ...(document.adoptedStyleSheets ?? [])]);
  const shadowCss = roots.map((r) => cssOf(r.adoptedStyleSheets ?? [])).filter(Boolean);
  const title = frame.querySelector("h1")?.textContent?.trim() || "Landing page";
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title.replace(/</g, "&lt;")}</title>
<style>
${css}
</style>
${shadowCss.length ? `<!-- estilos internos dos componentes A2UI -->\n<style>${shadowCss.join("\n")}</style>` : ""}
</head>
<body>
${body}
</body>
</html>`;
}

export function downloadZip(name: string, files: { path: string; content: string }[]) {
  void import("fflate").then(({ strToU8, zipSync }) => {
    const zip = zipSync(Object.fromEntries(files.map((f) => [f.path, strToU8(f.content)])));
    const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}
