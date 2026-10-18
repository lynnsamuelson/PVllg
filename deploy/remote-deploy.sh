#!/usr/bin/env bash
# Runs ON the VM (as opc) after the pipeline uploads /tmp/release.tgz and /tmp/app.env.
# Idempotent: the first run also bootstraps the venv, systemd unit, and Apache vhost.
set -euo pipefail

APP=/opt/hackathon-app
WEB=/var/www/hackathon-app
STAGE="$APP/staging"

sudo mkdir -p "$APP"
sudo chown opc:opc "$APP"

echo "==> Unpacking release"
rm -rf "$STAGE" && mkdir -p "$STAGE"
tar -xzf /tmp/release.tgz -C "$STAGE"
install -m 600 /tmp/app.env "$APP/.env"
rm -f /tmp/release.tgz /tmp/app.env

rm -rf "$APP/backend" "$APP/deploy"
mv "$STAGE/backend" "$APP/backend"
mv "$STAGE/deploy" "$APP/deploy"

echo "==> Python deps"
[ -x "$APP/venv/bin/python" ] || python3 -m venv "$APP/venv"
"$APP/venv/bin/pip" install -q --upgrade pip
"$APP/venv/bin/pip" install -q -r "$APP/backend/requirements.txt"

echo "==> Django migrate + collectstatic"
cd "$APP/backend"
export ENV_FILE="$APP/.env"
"$APP/venv/bin/python" manage.py migrate --noinput
"$APP/venv/bin/python" manage.py ensure_admin
"$APP/venv/bin/python" manage.py collectstatic --noinput -v 0

echo "==> Frontend"
sudo rm -rf "$WEB"
sudo mkdir -p "$WEB"
sudo cp -r "$STAGE/frontend/dist/." "$WEB/"
sudo restorecon -R "$WEB"

echo "==> Services"
sudo install -m 644 "$APP/deploy/hackathon-api.service" /etc/systemd/system/hackathon-api.service
sudo install -m 644 "$APP/deploy/hackathon-app.conf" /etc/httpd/conf.d/hackathon-app.conf
sudo restorecon /etc/systemd/system/hackathon-api.service /etc/httpd/conf.d/hackathon-app.conf
sudo systemctl daemon-reload
sudo systemctl enable --now hackathon-api >/dev/null
sudo systemctl restart hackathon-api
sudo apachectl configtest
sudo systemctl reload httpd
rm -rf "$STAGE"

echo "==> Health check"
for i in $(seq 1 15); do
  if body=$(curl -fsS http://127.0.0.1/api/health/); then
    echo "$body"
    exit 0
  fi
  sleep 2
done
echo "Health check failed. Recent API logs:"
sudo journalctl -u hackathon-api -n 50 --no-pager
exit 1
