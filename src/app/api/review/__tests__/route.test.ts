// @vitest-environment node
import { beforeEach, expect, test } from "vitest";
import { POST } from "../route";
import { DesignReview } from "@/lib/review/schema";

beforeEach(() => {
  process.env.AI_PROVIDER = "mock";
  process.env.MOCK_TOKEN_DELAY_MS = "0";
});

const files = {
  "/": { type: "directory", name: "", path: "/" },
  "/App.jsx": {
    type: "file",
    name: "App.jsx",
    path: "/App.jsx",
    content: "import Hero from '@/components/Hero';\nexport default function App(){return <Hero/>}",
  },
  "/components": { type: "directory", name: "components", path: "/components" },
  "/components/Hero.jsx": {
    type: "file",
    name: "Hero.jsx",
    path: "/components/Hero.jsx",
    content: "export default function Hero(){return <h1>Oi</h1>}",
  },
};

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/review", { method: "POST", body: JSON.stringify(body) })
  );
}

test("devolve um DesignReview validado pelo schema (end to end com o mock)", async () => {
  const res = await post({ files });
  expect(res.status).toBe(200);

  const json = await res.json();
  expect(json.provider).toBe("mock");
  const review = DesignReview.parse(json.review);
  expect(review.score).toBeGreaterThanOrEqual(0);
  expect(review.issues.length).toBeGreaterThan(0);
  // O mock aponta para arquivos que existem de verdade no projeto
  for (const issue of review.issues) {
    expect(Object.keys(files)).toContain(issue.file);
  }
});

test("400 quando não há código para revisar", async () => {
  const res = await post({ files: { "/": files["/"] } });
  expect(res.status).toBe(400);
});

test("500 com mensagem clara quando falta a chave do provedor", async () => {
  process.env.AI_PROVIDER = "google";
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const res = await post({ files });
  expect(res.status).toBe(500);
  expect((await res.json()).error).toMatch(/GOOGLE_GENERATIVE_AI_API_KEY/);
});
