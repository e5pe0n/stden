# Development and deployment

Contributor and operator documentation for stden. See [README](README.md) for
what the project is.

## Local development

Requires Node 24, pnpm (via corepack), and Docker.

```bash
corepack enable
pnpm install
cp apps/backend/.env.example apps/backend/.env    # add your Gemini API key
cp apps/frontend/.env.example apps/frontend/.env
```

Start Postgres, then apply migrations and generate the Prisma client:

```bash
docker compose up -d db
pnpm db:migrate
```

Run both apps (backend on :3000, frontend on :5173):

```bash
pnpm dev:be
pnpm dev:fe
```

`pnpm lint` · `pnpm type` · `pnpm run -r build`

> The generated Prisma client is gitignored, so `pnpm --filter backend db:generate`
> must run before typechecking or building a fresh clone.

Alternatively `docker compose up` runs the whole stack with hot reload.

## Deployment

Deployed to a personal mini PC and reachable only from a private
[Tailscale](https://tailscale.com) network — there is no public URL, and the
tailnet is the security boundary, so the API needs no auth layer of its own.

```
push to main
  └─► GitHub Actions ──build──► ghcr.io/<owner>/stden:sha-<commit>
         └─ joins the tailnet as an ephemeral tag:ci node
            └─ Tailscale SSH ──► mini PC (tag:server)
                                   docker compose pull && up -d
                                     ├─ app  (Fastify: API + SPA, one origin)
                                     ├─ db_migration  (one-shot, must exit 0)
                                     └─ db   (postgres:18)
```

`tailscale serve` terminates HTTPS with a real certificate on the tailnet
hostname and proxies to the app, so no reverse proxy is needed. The app
publishes on `127.0.0.1` only, keeping it off the LAN.

In production Fastify serves the built SPA itself, so the frontend and API
share an origin — `VITE_BACKEND_API_ENDPOINT` defaults to the relative
`/api/v1` and needs no build-time configuration.

### Deploy configuration

| Location | Holds |
|---|---|
| `deploy/compose.prod.yml` | the production stack (copied to the host on each deploy) |
| `deploy/env.example` | template for `/opt/stden/.env` on the host |
| `/opt/stden/.env` (host, mode 600) | `GOOGLE_GEN_AI_API_KEY`, `POSTGRES_PASSWORD`, `DATABASE_URL`, `IMAGE_TAG` |
| GitHub secrets | `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET` — nothing else |

Application secrets live only on the host: never in the repository, never in
an image, never in GitHub. Deployment uses Tailscale SSH, so there is no SSH
private key to store either.

### Rollback

Every deploy tags images `sha-<commit>`. Re-run the Deploy workflow with an
`image_tag` input, or on the host:

```bash
cd /opt/stden \
  && sed -i 's|^IMAGE_TAG=.*|IMAGE_TAG=sha-<previous>|' .env \
  && docker compose -f compose.prod.yml up -d
```

This rolls back code, not schema — `prisma migrate deploy` is forward-only, so
take a `pg_dump` before any destructive migration.
