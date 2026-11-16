import { test, expect } from "vitest";
import { normalizeMessages } from "../legacy-messages";

test("converts AI SDK 4 messages to UIMessage parts", () => {
  const legacy = [
    { id: "1", role: "user", content: "Make a card" },
    {
      id: "2",
      role: "assistant",
      content: "",
      parts: [
        { type: "text", text: "Creating..." },
        {
          type: "tool-invocation",
          toolInvocation: {
            toolCallId: "c1",
            toolName: "str_replace_editor",
            state: "result",
            args: { command: "create", path: "/App.jsx" },
            result: "ok",
          },
        },
      ],
    },
  ];

  expect(normalizeMessages(legacy)).toEqual([
    { id: "1", role: "user", parts: [{ type: "text", text: "Make a card" }] },
    {
      id: "2",
      role: "assistant",
      parts: [
        { type: "text", text: "Creating..." },
        {
          type: "tool-str_replace_editor",
          toolCallId: "c1",
          state: "output-available",
          input: { command: "create", path: "/App.jsx" },
          output: "ok",
        },
      ],
    },
  ]);
});

test("keeps messages already in the new format", () => {
  const current = [{ id: "1", role: "user", parts: [{ type: "text", text: "hi" }] }];
  expect(normalizeMessages(current)).toEqual(current);
});

test("returns [] for invalid input", () => {
  expect(normalizeMessages(null)).toEqual([]);
});
