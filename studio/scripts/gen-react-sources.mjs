// Gera src/lib/export/react-sources.ts com o código dos componentes da landing
// e o CSS dela, para o "Exportar projeto" copiar para o projeto React.
// Rode depois de mudar landing-components.tsx ou landing.css: npm run gen:sources
// (o teste react.test.ts falha se o arquivo gerado estiver desatualizado).
import { readFileSync, writeFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const out = `// GERADO por scripts/gen-react-sources.mjs. Não edite à mão: npm run gen:sources.
export const LANDING_COMPONENTS_TSX = ${JSON.stringify(read("src/lib/a2ui/landing-components.tsx"))};
export const LANDING_CSS = ${JSON.stringify(read("src/lib/a2ui/landing.css"))};
`;
writeFileSync(new URL("../src/lib/export/react-sources.ts", import.meta.url), out);
console.log("react-sources.ts atualizado");
