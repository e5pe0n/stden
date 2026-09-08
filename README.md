# stden

A personal English word explainer. Ask for a word's meaning and get definitions,
example sentences, a Japanese translation, and synonyms — with results cached
in Postgres so repeat lookups are instant.

Every ask — a word, a `/diff` between words, or a `/free` question — is saved as
its own history entry. The sidebar lists them newest first and reopens any one
of them.

- **Backend** — Fastify + Prisma (Postgres), Google Gemini for generation
- **Frontend** — React 19 + Vite + Tailwind, assistant-ui chat interface
- **Monorepo** — pnpm workspaces (`apps/backend`, `apps/frontend`)

![stden](docs/screenshot.png)
