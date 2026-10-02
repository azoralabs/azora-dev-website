#!/usr/bin/env bash
set -euo pipefail

# This is the forced command for this site's deployment key. Never evaluate
# SSH_ORIGINAL_COMMAND: allow only the exact restart command or restricted rsync.
if [[ ${SSH_ORIGINAL_COMMAND:-} == 'sudo /usr/local/sbin/deploy-azora-dev' ]]; then
    exec sudo -n /usr/local/sbin/deploy-azora-dev
fi

exec /usr/bin/rrsync -wo /srv/azora-dev
