#!/usr/bin/env bash
set -euo pipefail

app_dir=/srv/azora-dev/app
cd "${app_dir}"

test -f /srv/azora-dev/.env
ln -sfn /srv/azora-dev/.env "${app_dir}/.env"

docker compose build --pull
docker compose up -d --remove-orphans

for _ in $(seq 1 30); do
    if curl --fail --silent http://127.0.0.1:3028/api/health >/dev/null; then
        docker image prune --force --filter "until=168h" >/dev/null
        exit 0
    fi
    sleep 2
done

docker compose ps
docker compose logs --tail=100 app
exit 1
