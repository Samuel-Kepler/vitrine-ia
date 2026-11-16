// @vitest-environment node
import { test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: { project: { update: vi.fn() } } }));
vi.mock("@/lib/auth", () => ({ getSession: vi.fn(async () => null) }));

import { POST } from "../route";

beforeEach(() => {
  process.env.AI_PROVIDER = "mock";
});

async function readStream(res: Response) {
  const text = await res.text();
  return text
    .split("\n")
    .filter((l) => l.startsWith("data: ") && !l.includes("[DONE]"))
    .map((l) => JSON.parse(l.slice(6)));
}

test("streams text and tool calls from the mock model (end to end)", async () => {
  const req = new Request("http://localhost/api/chat", {
    method: "POST",
    body: JSON.stringify({
      messages: [
        { id: "u1", role: "user", parts: [{ type: "text", text: "make a card" }] },
      ],
      files: { "/": { type: "directory", name: "", path: "/" } },
    }),
  });

  const res = await POST(req);
  expect(res.status).toBe(200);

  const chunks = await readStream(res);
  const types = chunks.map((c) => c.type);

  expect(types).toContain("text-delta");
  const toolInputs = chunks.filter((c) => c.type === "tool-input-available");
  expect(toolInputs.map((c) => c.toolName)).toContain("str_replace_editor");
  expect(toolInputs.map((c) => c.input.path)).toEqual(
    expect.arrayContaining(["/App.jsx", "/components/Card.jsx"])
  );
  expect(chunks.filter((c) => c.type === "tool-output-available").length).toBe(
    toolInputs.length
  );
  expect(types.at(-1)).toBe("finish");
}, 30_000);

test("returns 500 with a clear message when the provider key is missing", async () => {
  process.env.AI_PROVIDER = "groq";
  delete process.env.GROQ_API_KEY;
  const req = new Request("http://localhost/api/chat", {
    method: "POST",
    body: JSON.stringify({ messages: [], files: {} }),
  });
  const res = await POST(req);
  expect(res.status).toBe(500);
  expect((await res.json()).error).toMatch(/GROQ_API_KEY/);
});
