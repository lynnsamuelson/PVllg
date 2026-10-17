# PVllg

Django 4.2 (Python 3.9) API + React (Vite) UI + Oracle MySQL HeatWave, deployed to an OCI VM by GitHub Actions.

**Live:** http://207.211.189.5

```
backend/    Django project (config/) + example "api" app (health check, Notes CRUD)
frontend/   React + Vite; calls same-origin /api/*  (folder guide: frontend/src/README.md)
deploy/     Apache vhost, gunicorn systemd unit, remote-deploy.sh (runs on the VM)
scripts/    add-teammate-key.sh, db-tunnel.sh
.github/workflows/ci-deploy.yml
```

## Local development

Backend (Python 3.9):

```bash
cd backend
python3.9 -m venv .venv && source .venv/bin/activate   # or python3, if it is 3.9
pip install -r requirements.txt
cp .env.example .env          # SQLite by default; see below for HeatWave
python manage.py migrate
python manage.py runserver    # http://127.0.0.1:8000/api/health/
```

Frontend (Node 18+):

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173 (proxies /api to :8000)
```

### Using the real HeatWave database locally

HeatWave only has a private IP, so tunnel through the VM:

```bash
DB_PRIVATE_IP=<heatwave-private-ip> ./scripts/db-tunnel.sh
```

Then in `backend/.env` set `DB_HOST=127.0.0.1`, `DB_PORT=3307`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`.
Note that this is the **shared** database the live site uses, so be careful with migrations.

## Deployment

Every push to `main` runs tests, builds React, and deploys to the VM. PRs only run tests.

On the VM:

| What | Where |
| --- | --- |
| Django code + venv | `/opt/hackathon-app/` |
| Env file (generated from GitHub secrets each deploy) | `/opt/hackathon-app/.env` |
| React build | `/var/www/hackathon-app/` |
| API service | `sudo systemctl status hackathon-api` / `journalctl -u hackathon-api -f` |
| Apache | `/etc/httpd/conf.d/hackathon-app.conf`, logs in `/var/log/httpd/hackathon-app-*.log` |

Apache serves the React build and proxies `/api/` and `/admin/` to gunicorn on `127.0.0.1:8000`.

### GitHub configuration (Settings → Secrets and variables → Actions)

| Name | Kind | Value |
| --- | --- | --- |
| `VM_HOST` | variable | `207.211.189.5` |
| `VM_SSH_KEY` | secret | private deploy key (its `.pub` is in the VM's `authorized_keys`) |
| `VM_KNOWN_HOSTS` | secret | output of `ssh-keyscan 207.211.189.5` |
| `DJANGO_SECRET_KEY` | secret | random string |
| `DB_HOST` | secret | HeatWave private IP. **Leave unset to use SQLite on the VM** |
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` | secret | HeatWave database credentials |

To create a Django admin user on the VM:

```bash
ssh opc@207.211.189.5
cd /opt/hackathon-app/backend && ENV_FILE=../.env ../venv/bin/python manage.py createsuperuser
```

## VM access for teammates

Everyone gets their own key, so nobody shares the master `.pem`:

1. Teammate runs `ssh-keygen -t ed25519 -C "their-name"` and sends you **only** `~/.ssh/id_ed25519.pub`.
2. Someone with access runs `./scripts/add-teammate-key.sh their-key.pub`.
3. Teammate connects with `ssh opc@207.211.189.5`.

To revoke access, delete that person's line from `~/.ssh/authorized_keys` on the VM.

**Never commit `.pem` files or `.env` files.** Both are in `.gitignore`.
