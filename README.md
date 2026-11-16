# UIGen

AI-powered React component generator with live preview.

## Prerequisites

- Node.js 22+ (exigido pelo AI SDK 7)
- npm

## Setup

1. **Optional** Copy `.env.example` to `.env` and configure one model provider:

```
AI_PROVIDER=google            # anthropic | google | groq | openrouter | mock
GOOGLE_GENERATIVE_AI_API_KEY=your-key
# AI_MODEL=gemini-flash-latest  # optional override
```

| Provider | Env var | Default model | Cost |
|---|---|---|---|
| `anthropic` | `ANTHROPIC_API_KEY` | `claude-haiku-5-5` | paid |
| `google` | `GOOGLE_GENERATIVE_AI_API_KEY` | `gemini-flash-latest` | free tier |
| `groq` | `GROQ_API_KEY` | `openai/gpt-oss-120b` | free tier |
| `openrouter` | `OPENROUTER_API_KEY` | `nvidia/nemotron-3-ultra-550b-a55b:free` | free models |

Without `AI_PROVIDER`, the first provider with a key is used. With no key at all, a mock model streams static code so the whole app still works offline.

2. Install dependencies and initialize database

```bash
npm run setup
```

This command will:

- Install all dependencies
- Generate Prisma client
- Run database migrations

## Running the Application

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Usage

1. Sign up or continue as anonymous user
2. Describe the React component you want to create in the chat
3. View generated components in real-time preview
4. Switch to Code view to see and edit the generated files
5. Continue iterating with the AI to refine your components

## Features

- AI-powered component generation (Anthropic, Gemini, Groq or OpenRouter)
- Live preview with hot reload
- Virtual file system (no files written to disk)
- Syntax highlighting and code editor
- Component persistence for registered users
- Export generated code

## Tech Stack

- Next.js 16 with App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Prisma with SQLite
- Vercel AI SDK 7 (`streamText`, `useChat`, tool calling)
