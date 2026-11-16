import { test, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MessageList } from "../MessageList";
import { toolPartToStep } from "../agent-steps";
import type { UIMessage } from "ai";

vi.mock("../MarkdownRenderer", () => ({
  MarkdownRenderer: ({ content }: { content: string }) => <div>{content}</div>,
}));

afterEach(() => {
  cleanup();
});

const user = (id: string, text: string): UIMessage => ({
  id,
  role: "user",
  parts: [{ type: "text", text }],
});

const toolPart = (state: string, input: object) =>
  ({ type: "tool-str_replace_editor", toolCallId: "t1", state, input, output: "ok" }) as any;

test("renders user messages", () => {
  render(<MessageList messages={[user("1", "Create a button component")]} />);
  expect(screen.getByText("Create a button component")).toBeDefined();
});

test("renders assistant text and a 'pronto' footer when finished", () => {
  const messages: UIMessage[] = [
    { id: "2", role: "assistant", parts: [{ type: "text", text: "I'll help you." }] },
  ];
  render(<MessageList messages={messages} />);
  expect(screen.getByText("I'll help you.")).toBeDefined();
  expect(screen.getByTestId("done").textContent).toContain("pronto");
  expect(screen.getByTestId("done").textContent).toContain("0 tool calls");
});

test("renders tool calls as timeline steps with verb, path and tool name", () => {
  const messages: UIMessage[] = [
    {
      id: "a",
      role: "assistant",
      parts: [
        { type: "text", text: "Creating your component..." },
        toolPart("output-available", { command: "create", path: "/App.jsx" }),
      ],
    },
  ];
  render(<MessageList messages={messages} />);
  expect(screen.getByText("Creating your component...")).toBeDefined();
  const step = screen.getByTestId("tool-step");
  expect(step.textContent).toContain("criou");
  expect(step.textContent).toContain("/App.jsx");
  expect(screen.getByText("str_replace_editor")).toBeDefined();
  expect(screen.getByTestId("done").textContent).toContain("1 tool call");
});

test("streams the last text token by token with a caret while loading", () => {
  const messages: UIMessage[] = [
    user("1", "Make a card"),
    {
      id: "2",
      role: "assistant",
      parts: [{ type: "text", text: "Generating your component", state: "streaming" }],
    },
  ];
  const { container } = render(<MessageList messages={messages} isLoading />);
  const streaming = screen.getByTestId("streaming-text");
  expect(streaming.textContent).toBe("Generating your component");
  expect(streaming.querySelectorAll(".token-in")).toHaveLength(3);
  expect(container.querySelector(".caret")).not.toBeNull();
  expect(screen.getByTestId("thinking")).toBeDefined();
  expect(screen.queryByTestId("done")).toBeNull();
});

test("shows 'pensando' while waiting for the first assistant chunk", () => {
  render(<MessageList messages={[user("1", "Make a card")]} isLoading />);
  expect(screen.getByTestId("thinking").textContent).toContain("pensando");
});

test("only the last assistant message is live", () => {
  const messages: UIMessage[] = [
    { id: "1", role: "assistant", parts: [{ type: "text", text: "First" }] },
    user("2", "again"),
    { id: "3", role: "assistant", parts: [{ type: "text", text: "Second" }] },
  ];
  render(<MessageList messages={messages} isLoading />);
  expect(screen.getAllByTestId("done")).toHaveLength(1);
  expect(screen.getAllByTestId("thinking")).toHaveLength(1);
});

test("marks loop iterations from step-start parts", () => {
  const messages: UIMessage[] = [
    {
      id: "1",
      role: "assistant",
      parts: [
        { type: "step-start" },
        { type: "text", text: "Step 1 content" },
        { type: "step-start" },
        { type: "text", text: "Step 2 content" },
      ],
    },
  ];
  render(<MessageList messages={messages} />);
  expect(screen.getByText("Step 1 content")).toBeDefined();
  expect(screen.getByText("Step 2 content")).toBeDefined();
  expect(screen.getByText(/loop · passo 2/)).toBeDefined();
  expect(screen.getByTestId("done").textContent).toContain("2 passos");
});

test("renders reasoning parts", () => {
  const messages: UIMessage[] = [
    {
      id: "1",
      role: "assistant",
      parts: [{ type: "reasoning", text: "The user wants a button." }],
    },
  ];
  render(<MessageList messages={messages} />);
  expect(screen.getByText("Reasoning")).toBeDefined();
  expect(screen.getByText("The user wants a button.")).toBeDefined();
});

test("renders messages in order", () => {
  const messages: UIMessage[] = [
    user("1", "First user"),
    { id: "2", role: "assistant", parts: [{ type: "text", text: "First assistant" }] },
    user("3", "Second user"),
  ];
  const { container } = render(<MessageList messages={messages} />);
  const roles = Array.from(container.querySelectorAll("[data-role]")).map((el) =>
    el.getAttribute("data-role")
  );
  expect(roles).toEqual(["user", "assistant", "user"]);
});

test("a tool without output in a finished message is marked as interrupted", () => {
  const messages: UIMessage[] = [
    { id: "a", role: "assistant", parts: [toolPart("input-available", { command: "create", path: "/App.jsx" })] },
  ];
  render(<MessageList messages={messages} />);
  expect(screen.getByTestId("tool-step").textContent).toContain("interrompido");
});

test("toolPartToStep maps commands and states", () => {
  expect(toolPartToStep(toolPart("input-available", { command: "str_replace", path: "/a.jsx" }))).toMatchObject({
    verb: "editando",
    target: "/a.jsx",
    state: "running",
  });
  expect(
    toolPartToStep({ ...toolPart("output-error", { command: "rename", path: "/a", new_path: "/b" }), type: "tool-file_manager" })
  ).toMatchObject({ verb: "moveu", target: "/a → /b", tool: "file_manager", state: "error" });
});
