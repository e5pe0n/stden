#!/usr/bin/env bash
#
# Removes the node_modules volumes that docker compose keeps for the app
# services, so the next `docker compose up` reinstalls dependencies from
# scratch. Use it after changing a dependency that the containers have cached.
#
# The database volume is deliberately left alone — this prunes build state,
# not data. Use `pnpm db:reset` to clear the database.
set -euo pipefail

cd "$(dirname "$0")/.."

# Every volume is prefixed with the compose project name. Read it back from
# compose rather than assuming the directory name, which a `name:` key or
# COMPOSE_PROJECT_NAME can override.
project="$(docker compose config --format json |
  node -pe 'JSON.parse(require("fs").readFileSync(0, "utf8")).name')"

volumes="$(docker compose config --volumes | grep 'node_modules$' || true)"
if [ -z "$volumes" ]; then
  echo "No node_modules volumes are declared in compose.yml."
  exit 0
fi

volumes="$(echo "$volumes" | sed "s/^/${project}_/")"

# A volume stays busy while any container still references it, running or not,
# so the containers have to go first. This leaves the volumes untouched.
docker compose down

# Volume names never contain spaces, so splitting on newlines is safe here.
# --force keeps an already-pruned volume from failing the run.
# shellcheck disable=SC2086
docker volume rm --force $volumes
