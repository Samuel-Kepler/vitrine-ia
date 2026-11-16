# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start dev server with turbopack (uses node-compat.cjs shim)
npm run dev:daemon   # Start dev server in background, logs to logs.txt

# Build & production
npm run build
npm run start

# Linting
npm run lint         # eslint (flat config)

# Testing
npm run test         # vitest (jsdom environment)
npx vitest run src/path/to/test.test.tsx  # Run a single test file

# Database
npm run setup        # Install deps + prisma generate + prisma migrate dev
npm run db:reset     # prisma migrate reset --force (destructive)
npx prisma studio    # Open Prisma GUI
```

## Architecture

UIGen is an AI-powered React component generator. Users describe components in chat; Claude generates code; a live preview renders results instantly — all without writing files to disk.

### Request flow

1. User submits a prompt in the chat UI
2. `/api/chat` streams responses via Vercel AI SDK 7 (`streamText` → `toUIMessageStream` → `createUIMessageStreamResponse`); the client consumes them with `useChat` + `DefaultChatTransport`
3. The model uses two tools during generation (defined with `tool({ inputSchema })`):
   - `str_replace_editor` — targeted file edits (create/replace/view)
   - `file_manager` — file operations (delete, move, list)
4. Tool calls mutate the **virtual file system** (in-memory, never touches disk)
5. The preview iframe re-renders on file system changes

### Virtual file system

`src/lib/file-system.ts` — the core in-memory FS implementation. Supports create, read, write, delete, move, and serialization to JSON (for database persistence). The `FileSystemContext` (`src/lib/contexts/`) exposes FS state to all components.

### AI provider

`src/lib/provider.ts` — single place that picks the model. `getModelConfig()` reads `AI_PROVIDER` (`anthropic | google | groq | openrouter | mock`) and optional `AI_MODEL`; without `AI_PROVIDER` it auto-detects the first configured key, falling back to `MockLanguageModel` (`src/lib/mock-model.ts`, implements `LanguageModelV4`) so the app runs with no API key. See `.env.example`.

Messages are AI SDK `UIMessage`s (parts-based). `src/lib/legacy-messages.ts` converts projects saved in the old AI SDK 4 format.

### Authentication

Custom JWT auth using `jose` (tokens) and `bcrypt` (password hashing). `src/proxy.ts` (Next 16 replacement for middleware) verifies sessions on protected routes. No third-party auth library.

### Database

Prisma + SQLite. Two models:
- `User` — email/password accounts
- `Project` — stores `messages` (chat history) and `data` (serialized virtual FS) as JSON blobs; `userId` is optional (anonymous projects supported)

### Key tech

- Next.js 16 App Router, React 19, TypeScript, AI SDK 7, Zod 4
- Tailwind CSS v4 + shadcn/ui (new-york style, neutral palette)
- Monaco Editor for the code view
- `react-resizable-panels` for the 3-panel layout (chat | preview | code)
- Vitest + Testing Library (jsdom) for tests

### Path alias

`@/*` maps to `./src/*` — use this for all internal imports.
