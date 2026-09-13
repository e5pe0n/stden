# stden

A personal English word explainer. Ask for a word's meaning and get definitions,
example sentences, a Japanese translation, and synonyms — with results cached
in Postgres so repeat lookups are instant.

Every ask — a word, a `/diff` between words, or a `/free` question — is saved as
its own history entry. The sidebar lists them newest first and reopens any one
of them.

Two features share that sidebar, switched from the buttons at its top:

- **Learn** — the asks above, with their history.
- **Test** — ten words from the ones you have looked up, mostly those you are
  likeliest to have forgotten, topped up with ones you have never been tested
  on. Write
  a sentence for each; Gemini marks the use right or wrong and comments on it,
  and you see the verdicts, the advice and how many you got right only once you
  finish.

Built with:

- **Backend** — Fastify + Prisma (Postgres), Google Gemini for generation
- **Frontend** — React 19 + Vite + Tailwind, assistant-ui chat interface
- **Monorepo** — pnpm workspaces (`apps/backend`, `apps/frontend`)

![stden](docs/screenshot.png)
