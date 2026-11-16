"use client";

import {
  createContext,
  useContext,
  ReactNode,
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useChat as useAIChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useFileSystem } from "./file-system-context";
import { setHasAnonWork } from "@/lib/anon-work-tracker";

interface ChatContextProps {
  projectId?: string;
  initialMessages?: UIMessage[];
}

interface ChatContextType {
  messages: UIMessage[];
  input: string;
  handleInputChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: FormEvent<HTMLFormElement>) => void;
  status: string;
  error?: Error;
  // Envia um texto direto (usado pelos prompts de exemplo)
  sendText: (text: string) => void;
  stop: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({
  children,
  projectId,
  initialMessages = [],
}: ChatContextProps & { children: ReactNode }) {
  const { fileSystem, handleToolCall } = useFileSystem();

  // No AI SDK atual, o estado do input é responsabilidade da aplicação
  const [input, setInput] = useState("");

  const [transport] = useState(
    () => new DefaultChatTransport<UIMessage>({ api: "/api/chat" })
  );

  const { messages, sendMessage, status, error, stop } = useAIChat({
    id: projectId,
    messages: initialMessages,
    transport,
    // Chamado a cada tool call recebida no stream
    onToolCall: ({ toolCall }) => {
      handleToolCall(toolCall);
    },
  });

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const sendText = (raw: string) => {
    const text = raw.trim();
    if (!text || status === "submitted" || status === "streaming") return;
    // O body vai junto de cada envio: estado atual dos arquivos + projeto
    sendMessage(
      { text },
      { body: { files: fileSystem.serialize(), projectId } }
    );
    setInput("");
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    sendText(input);
  };

  // Track anonymous work
  useEffect(() => {
    if (!projectId && messages.length > 0) {
      setHasAnonWork(messages, fileSystem.serialize());
    }
  }, [messages, fileSystem, projectId]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        input,
        handleInputChange,
        handleSubmit,
        status,
        error,
        sendText,
        stop,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
