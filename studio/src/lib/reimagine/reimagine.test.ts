import { describe, expect, it, vi } from "vitest";
import { createNode } from "@/lib/draft/tree";
import { reimagine } from "./reimagine";
import { MockLanguageModel } from "@/lib/ai/mock-model";
import * as providers from "@/lib/ai/providers";

const draft = [createNode("navbar"), createNode("hero"), createNode("feature"), createNode("feature"), createNode("form"), createNode("footer")];

describe("reimagine", () => {
  it("works end to end with the mock model", async () => {
    const r = await reimagine({ draft, settings: { kind: "mock" }, palette: "forest" });
    expect(r.ok).toBe(true);
    expect(r.fallback).toBe(false);
    expect(r.attempts).toBe(1);
    const create = r.messages.find((m) => "createSurface" in m)!.createSurface as any;
    expect(create.components.find((c: any) => c.id === "root").palette).toBe("forest");
  });

  it("feeds compiler errors back and retries, then falls back", async () => {
    const bad = new MockLanguageModel("bad");
    let calls = 0;
    bad.doGenerate = async () => {
      calls++;
      return {
        content: [{ type: "text", text: "<a2ui>\nroot = Page(child=x)\nx = Carousel()\n</a2ui>" }],
        finishReason: { unified: "stop", raw: undefined },
        usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
        warnings: [],
      };
    };
    const spy = vi.spyOn(providers, "resolveModel").mockReturnValue({ kind: "mock", modelId: "bad", model: bad });
    const r = await reimagine({ draft });
    spy.mockRestore();
    expect(calls).toBe(3);
    expect(r.fallback).toBe(true);
    expect(r.warnings[0]).toMatch(/Carousel/);
    expect(r.messages.length).toBeGreaterThan(0);
  });

  it("rejects remote baseURL that is not allowed", () => {
    expect(() => providers.assertAllowedBaseURL("http://169.254.169.254/latest")).toThrow(/não está liberado/);
    expect(providers.assertAllowedBaseURL("http://localhost:11434/api/")).toBe("http://localhost:11434/api");
  });
});
