# syntax=docker/dockerfile:1

# Resolve the pnpm version from the root package.json "packageManager" field
# so it has a single source of truth. pnpm is then installed with npm rather
# than corepack, which is being removed from Node distributions.
FROM node:24-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e AS pnpm_version
WORKDIR /src
COPY package.json .
# Strips any "+sha512..." integrity suffix, leaving e.g. "pnpm@11.5.0".
RUN node -p "require('./package.json').packageManager.split('+')[0]" > /pnpm-version.txt

# node:24-slim, pinned by digest so rebuilds are reproducible.
FROM node:24-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e AS base
# Prisma's engine needs libssl, and node:24-slim ships neither it nor the
# system CA bundle.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# pnpm 11 defaults verifyDepsBeforeRun to "install", so `pnpm <script>` would
# try to install first. The deployed package dirs have no workspace root, so
# that install fails on `catalog:` specifiers. This setting is only read from
# pnpm-workspace.yaml, which those dirs lack — hence the env var.
ENV PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false
RUN --mount=from=pnpm_version,source=/pnpm-version.txt,target=/tmp/pnpm-version.txt \
    npm i -g "$(cat /tmp/pnpm-version.txt)"

FROM base AS build
WORKDIR /usr/src/app
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
# Call the workspace script directly. The root `db:generate` routes through
# `dotenv --`, but .dockerignore excludes .env* so there is nothing to load.
RUN pnpm --filter backend db:generate
RUN pnpm run -r build
# Runtime dependencies only — this becomes the app image.
RUN pnpm deploy --legacy --filter=backend --prod /prod/backend
# A second deploy that KEEPS devDependencies. `prisma` is a devDependency, so
# a --prod deploy would leave the migration image with no CLI to run.
RUN pnpm deploy --legacy --filter=backend /prod/backend-migrate

# The application: Fastify serves the API and the built SPA from one origin.
FROM base AS app
# Links the GHCR package to this repository (shows in the repo's Packages
# sidebar and records provenance).
LABEL org.opencontainers.image.source="https://github.com/e5pe0n/stden"
ENV NODE_ENV=production
COPY --from=build /prod/backend /prod/backend
COPY --from=build /usr/src/app/apps/frontend/dist /prod/backend/public
WORKDIR /prod/backend
ENV STATIC_DIR=/prod/backend/public
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Exec node directly so it is PID 1 and receives SIGTERM without a pnpm
# wrapper in between; this is the `start` script's exact command.
CMD ["node", "dist/index.js"]

# One-shot migration job. Must exit 0 before the app starts.
FROM base AS db_migration
LABEL org.opencontainers.image.source="https://github.com/e5pe0n/stden"
ENV NODE_ENV=production
COPY --from=build /prod/backend-migrate /prod/backend
WORKDIR /prod/backend
CMD ["pnpm", "db:deploy"]
