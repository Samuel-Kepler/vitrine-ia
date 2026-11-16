import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { ChatProvider, useChat } from "../chat-context";
import { useFileSystem } from "../file-system-context";
import { useChat as useAIChat } from "@ai-sdk/react";
import * as anonTracker from "@/lib/anon-work-tracker";

// Mock dependencies
vi.mock("../file-system-context", () => ({
  useFileSystem: vi.fn(),
}));

vi.mock("@ai-sdk/react", () => ({
  useChat: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  setHasAnonWork: vi.fn(),
}));

// Helper component to access chat context
function TestComponent() {
  const chat = useChat();
  return (
    <div>
      <div data-testid="messages">{chat.messages.length}</div>
      <textarea
        data-testid="input"
        value={chat.input}
        onChange={chat.handleInputChange}
      />
      <form data-testid="form" onSubmit={chat.handleSubmit}>
        <button type="submit">Submit</button>
      </form>
      <div data-testid="status">{chat.status}</div>
    </div>
  );
}

describe("ChatContext", () => {
  const mockFileSystem = {
    serialize: vi.fn(() => ({ "/test.js": { type: "file", content: "test" } })),
  };

  const mockHandleToolCall = vi.fn();

  const mockSendMessage = vi.fn();

  const mockUseAIChat = {
    messages: [],
    sendMessage: mockSendMessage,
    status: "ready",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    (useFileSystem as any).mockReturnValue({
      fileSystem: mockFileSystem,
      handleToolCall: mockHandleToolCall,
    });

    (useAIChat as any).mockReturnValue(mockUseAIChat);
  });

  afterEach(() => {
    cleanup();
  });

  test("renders with default values", () => {
    render(
      <ChatProvider>
        <TestComponent />
      </ChatProvider>
    );

    expect(screen.getByTestId("messages").textContent).toBe("0");
    expect(screen.getByTestId("input").getAttribute("value")).toBe(null);
    expect(screen.getByTestId("status").textContent).toBe("ready");
  });

  test("initializes with project ID and messages", () => {
    const initialMessages = [
      { id: "1", role: "user" as const, parts: [{ type: "text" as const, text: "Hello" }] },
      { id: "2", role: "assistant" as const, parts: [{ type: "text" as const, text: "Hi there!" }] },
    ];

    (useAIChat as any).mockReturnValue({
      ...mockUseAIChat,
      messages: initialMessages,
    });

    render(
      <ChatProvider projectId="test-project" initialMessages={initialMessages}>
        <TestComponent />
      </ChatProvider>
    );

    expect(useAIChat).toHaveBeenCalledWith({
      id: "test-project",
      messages: initialMessages,
      transport: expect.any(Object),
      onToolCall: expect.any(Function),
    });

    expect(screen.getByTestId("messages").textContent).toBe("2");
  });

  test("tracks anonymous work when no project ID", async () => {
    const mockMessages = [{ id: "1", role: "user", parts: [{ type: "text", text: "Hello" }] }];

    (useAIChat as any).mockReturnValue({
      ...mockUseAIChat,
      messages: mockMessages,
    });

    render(
      <ChatProvider>
        <TestComponent />
      </ChatProvider>
    );

    await waitFor(() => {
      expect(anonTracker.setHasAnonWork).toHaveBeenCalledWith(
        mockMessages,
        mockFileSystem.serialize()
      );
    });
  });

  test("does not track anonymous work when project ID exists", async () => {
    const mockMessages = [{ id: "1", role: "user", parts: [{ type: "text", text: "Hello" }] }];

    (useAIChat as any).mockReturnValue({
      ...mockUseAIChat,
      messages: mockMessages,
    });

    render(
      <ChatProvider projectId="test-project">
        <TestComponent />
      </ChatProvider>
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(anonTracker.setHasAnonWork).not.toHaveBeenCalled();
  });

  test("does not send while the model is still streaming", () => {
    (useAIChat as any).mockReturnValue({ ...mockUseAIChat, status: "streaming" });
    render(
      <ChatProvider>
        <TestComponent />
      </ChatProvider>
    );
    expect(screen.getByTestId("status").textContent).toBe("streaming");
    fireEvent.change(screen.getByTestId("input"), { target: { value: "Make a button" } });
    fireEvent.submit(screen.getByTestId("form"));
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  test("manages input locally and sends it with sendMessage", () => {
    (useAIChat as any).mockReturnValue({
      ...mockUseAIChat,
      status: "ready",
    });

    render(
      <ChatProvider>
        <TestComponent />
      </ChatProvider>
    );

    expect(screen.getByTestId("status").textContent).toBe("ready");

    const textarea = screen.getByTestId("input") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Make a button" } });
    expect(textarea.value).toBe("Make a button");

    fireEvent.submit(screen.getByTestId("form"));

    expect(mockSendMessage).toHaveBeenCalledWith(
      { text: "Make a button" },
      { body: { files: mockFileSystem.serialize(), projectId: undefined } }
    );
    expect(textarea.value).toBe("");
  });

  test("does not send empty messages", () => {
    render(
      <ChatProvider>
        <TestComponent />
      </ChatProvider>
    );

    fireEvent.submit(screen.getByTestId("form"));

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  test("sends current files and projectId in the request body", () => {
    render(
      <ChatProvider projectId="p1">
        <TestComponent />
      </ChatProvider>
    );

    fireEvent.change(screen.getByTestId("input"), { target: { value: "hi" } });
    fireEvent.submit(screen.getByTestId("form"));

    expect(mockSendMessage).toHaveBeenCalledWith(
      { text: "hi" },
      { body: { files: mockFileSystem.serialize(), projectId: "p1" } }
    );
  });

  test("handles tool calls", () => {
    let onToolCallHandler: any;

    (useAIChat as any).mockImplementation((config: any) => {
      onToolCallHandler = config.onToolCall;
      return mockUseAIChat;
    });

    render(
      <ChatProvider>
        <TestComponent />
      </ChatProvider>
    );

    const toolCall = { toolName: "test", input: {} };
    onToolCallHandler({ toolCall });

    expect(mockHandleToolCall).toHaveBeenCalledWith(toolCall);
  });
});
