#!/usr/bin/env bash
# Grant a teammate SSH access to the VM using THEIR public key (run by someone who already has access).
#   ./scripts/add-teammate-key.sh ~/Downloads/alex.pub
# The teammate generates the key on their own machine with:
#   ssh-keygen -t ed25519 -C "their-name"     # then sends you ~/.ssh/id_ed25519.pub
set -euo pipefail

PUBKEY_FILE="${1:?usage: $0 <teammate-public-key.pub>}"
VM_HOST="${VM_HOST:-207.211.189.5}"
ADMIN_KEY="${ADMIN_KEY:-$HOME/.ssh/oracle-hackathon.pem}"

grep -qE '^(ssh-(ed25519|rsa)|ecdsa-sha2-)' "$PUBKEY_FILE" || {
  echo "That doesn't look like a public key (.pub). Never send/accept private keys." >&2
  exit 1
}

ssh -i "$ADMIN_KEY" "opc@$VM_HOST" \
  'k=$(cat); grep -qxF "$k" ~/.ssh/authorized_keys || echo "$k" >> ~/.ssh/authorized_keys' < "$PUBKEY_FILE"
echo "Added. Teammate can now: ssh opc@$VM_HOST"
