# `useChat` + `DefaultChatTransport` no cliente

**Onde:** `src/lib/contexts/chat-context.tsx:44-74`

```tsx
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

```

## O que está acontecendo

No navegador, o hook `useChat` cuida da conversa: guarda as mensagens, mostra o `status` (`submitted` → `streaming` → `ready`) e vai montando a mensagem do assistente conforme os eventos chegam.

O *transport* (`DefaultChatTransport`) diz **para onde** mandar: `/api/chat`. E o `sendMessage(..., { body })` manda junto o que a rota precisa além do texto: o estado atual dos arquivos e o id do projeto.

## Por que importa

O input é estado da aplicação (`useState`), não do SDK. Isso deixa a gente controlar o envio, como no `sendText`, que os prompts de exemplo clicáveis usam e que bloqueia envio duplo enquanto o modelo ainda responde.

> **Perceba:** O FS virtual vai no body a cada mensagem: o servidor não guarda estado entre chamadas. O modelo também não (*stateless*, ou seja, sem memória): tudo que ele "lembra" é o que a gente manda.
