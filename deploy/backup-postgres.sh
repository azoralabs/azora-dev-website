#!/usr/bin/env bash
set -euo pipefail

app_dir=/srv/azora-dev/app
backup_dir=/srv/azora-dev/backups
timestamp=$(date -u +%Y%m%dT%H%M%SZ)

install -d -m 0700 "${backup_dir}"
cd "${app_dir}"

docker compose exec -T postgres \
    sh -c 'pg_dump --format=custom --no-owner \
        --username="${POSTGRES_USER}" "${POSTGRES_DB}"' \
    > "${backup_dir}/azora-dev-${timestamp}.dump"

find "${backup_dir}" -type f -name 'azora-dev-*.dump' -mtime +14 -delete
