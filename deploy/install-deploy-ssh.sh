#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
    echo 'Run this script as root or with sudo.' >&2
    exit 1
fi

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
test -x /usr/bin/rrsync
test -x /usr/local/sbin/deploy-azora-dev
install -o root -g root -m 0755 "${script_dir}/azora-dev-deploy-ssh.sh" \
    /usr/local/sbin/azora-dev-deploy-ssh
