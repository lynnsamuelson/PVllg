#!/usr/bin/env bash
# Forward localhost:3307 -> MySQL HeatWave (private IP) through the VM, for local development.
# Then set DB_HOST=127.0.0.1 and DB_PORT=3307 in backend/.env. Ctrl+C to stop.
set -euo pipefail

: "${DB_PRIVATE_IP:?set DB_PRIVATE_IP to the HeatWave private IP}"
VM_HOST="${VM_HOST:-207.211.189.5}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
LOCAL_PORT="${LOCAL_PORT:-3307}"

echo "Tunnel: 127.0.0.1:$LOCAL_PORT -> $DB_PRIVATE_IP:3306 via opc@$VM_HOST"
exec ssh -i "$SSH_KEY" -N -L "$LOCAL_PORT:$DB_PRIVATE_IP:3306" "opc@$VM_HOST"
