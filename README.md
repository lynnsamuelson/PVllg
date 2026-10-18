# PVllg

A web app with a Django API (Python 3.9), a React UI, and a MySQL HeatWave database, deployed to an Oracle Cloud VM.

**Live:** http://207.211.189.5 (sign up for an account to see anything)

Writing code? Read [AGENTS.md](AGENTS.md) for conventions and project rules.

---

## Quick start

You'll end up with the app running at http://localhost:5173 on your machine, using a local SQLite database.
No passwords or cloud access needed.

### 1. Install the tools

| Tool | Check it | If it's missing (macOS) |
| --- | --- | --- |
| Git | `git --version` | `xcode-select --install` |
| Python **3.9** | `python3 --version` (or `python3.9 --version`) | `brew install pyenv && pyenv install 3.9` |
| Node **20 or newer** | `node --version` | `brew install node` (or the LTS installer from [nodejs.org](https://nodejs.org)) |

No Homebrew? Install it from [brew.sh](https://brew.sh). It has to be Python 3.9, not 3.10+: the server runs 3.9.

### 2. Get the code

```bash
git clone https://github.com/lynnsamuelson/PVllg.git
cd PVllg
```

### 3. Start the backend (terminal 1)

```bash
cd backend
python3 -m venv .venv          # use python3.9 if python3 isn't 3.9
source .venv/bin/activate      # your prompt now starts with (.venv)
pip install -r requirements-dev.txt   # app dependencies plus test tools
cp .env.example .env
python manage.py migrate       # creates the local database and sample data
python manage.py runserver
```

Leave it running.

### 4. Start the frontend (terminal 2)

Open a **second** terminal window in the `PVllg` folder:

```bash
cd frontend
npm install
npm run dev
```

Leave this running too.

### 5. Open the app

1. Go to **http://localhost:5173/status**. You should see `ok — sqlite`. That means React, Django and the database are connected.
2. Go to **http://localhost:5173/welcome**, tap **Get started**, pick a person or an organization, and create an account.
   It only exists on your machine, so any email will do.
3. You're in. A person sees the Home, Search, Claims and Profile tabs; an organization sees Items, Claims, Impact and
   Profile. Tabs whose screens aren't built yet say "coming soon".

### Coming back later

Steps 1, 2 and the installs only happen once. Next time, start the two servers:

```bash
# terminal 1
cd backend && source .venv/bin/activate && python manage.py runserver

# terminal 2
cd frontend && npm run dev
```

After you pull new code, run `pip install -r requirements-dev.txt` and `python manage.py migrate` in the backend, and
`npm install` in the frontend, in case something changed.

### Before you open a PR

```bash
# terminal 1 (in backend/, venv active)
coverage run manage.py test && coverage report   # tests + coverage (fails if coverage drops)

# terminal 2 (in frontend/)
npm run coverage                 # unit tests + coverage (fails if coverage drops)
npm run build
npx playwright install chromium  # first time only
npm run e2e                      # browser tests; starts its own servers, safe to run alongside yours
```

CI runs these same checks on every PR. If your change affects anything this README or [AGENTS.md](AGENTS.md)
describes, update them in the same PR. The PR checklist asks you to confirm it. See [AGENTS.md](AGENTS.md#git-and-pr-workflow) for the branch and PR workflow.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `python3.9: command not found` | Run `python3 --version`. If it says 3.9, use `python3`. Otherwise install 3.9 (step 1). |
| `node: command not found` / `npm: command not found` | Install Node (step 1), then open a new terminal. |
| `ModuleNotFoundError: No module named 'django'` | The venv isn't active. Run `source .venv/bin/activate` in `backend/`. |
| `/status` shows an error, or pages won't load data | The backend isn't running. Check terminal 1. |
| You keep getting sent to the welcome page | Expected: everything needs login. Sign up from http://localhost:5173/welcome. |
| `CSRF Failed: Origin checking failed` on sign up or sign in | Vite is on a port other than 5173. Set `DJANGO_CSRF_TRUSTED_ORIGINS` in `backend/.env` to that origin (see `.env.example`) and restart the backend. |
| `Error: That port is already in use` | Another copy is still running. Stop it with Ctrl+C in its terminal, or run `lsof -i :8000` to find it. |
| Opening http://127.0.0.1:8000 shows a bare page or 404 | That's only the API. Use http://localhost:5173. |
| `npm run e2e` says `Executable doesn't exist` | Run `npx playwright install chromium` in `frontend/`. |
| `npm run e2e` can't start the backend | It uses `backend/.venv/bin/python`. Create the venv (step 3) first. |

Want the Django admin locally? Run `python manage.py createsuperuser` in `backend/`, then open http://localhost:5173/admin/.

---

## How it fits together

```
backend/    Django project
  config/     settings (all from env vars), URLs
  accounts/   signup, login, logout
  resources/  Resource model and API
  api/        /api/health/ and the Notes demo
frontend/   React + Vite (folder guide: frontend/src/README.md)
deploy/     Apache config, gunicorn service, remote-deploy.sh (runs on the VM)
scripts/    add-teammate-key.sh, db-tunnel.sh
.github/workflows/ci-deploy.yml
```

In development, Vite serves the React app on port 5173 and forwards `/api` and `/admin` to Django on port 8000.
Production does the same thing with Apache in front of gunicorn, so the code never needs to know which one it's in.

The database is SQLite unless `DB_HOST` is set in `backend/.env`.

### Using the real HeatWave database locally

Only do this if you need production data. It's the **shared database the live site uses**, so be careful with
migrations. You'll need VM access (below) and the database credentials from a teammate.

HeatWave only has a private IP, so tunnel through the VM:

```bash
DB_PRIVATE_IP=<heatwave-private-ip> ./scripts/db-tunnel.sh
```

Then in `backend/.env` set `DB_HOST=127.0.0.1`, `DB_PORT=3307`, `DB_NAME`, `DB_USER` and `DB_PASSWORD`.

---

## Deployment

1. Open a PR into `main` (direct pushes are blocked). CI runs the backend and frontend tests with coverage, the
   frontend build and the Playwright browser tests.
2. Merge the PR. This starts a deploy that **waits for approval**.
3. An approver opens the run under Actions → **Review deployments** → `production` → **Approve**.
   Approvers are set in Settings → Environments → production.
4. The pipeline copies the code to the VM, runs migrations, restarts the app, and checks `/api/health/`.

Only one deploy runs at a time, so an unapproved deploy holds up the ones behind it.

On the VM:

| What | Where |
| --- | --- |
| Django code + venv | `/opt/hackathon-app/` |
| Env file (generated from GitHub secrets each deploy) | `/opt/hackathon-app/.env` |
| React build | `/var/www/hackathon-app/` |
| API service and app logs | `sudo systemctl status hackathon-api` / `journalctl -u hackathon-api -f` |
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
| `EMAIL_HOST` | secret | SMTP server for organization codes (e.g. OCI Email Delivery). **Leave unset and codes print to `journalctl`** |
| `EMAIL_PORT` / `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` | secret | SMTP port (default 587) and credentials |
| `DEFAULT_FROM_EMAIL` | secret | From address, on a domain approved for sending, e.g. `PVill <no-reply@example.org>` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | secret | Main Django admin login. Each deploy creates it, or resets its password to this. Letters and numbers only (`openssl rand -hex 16`) |

### Test accounts

Product owners test in the browser, without SSH. You need a Django admin login (`/admin/`). The main one comes
from the `ADMIN_EMAIL` and `ADMIN_PASSWORD` GitHub secrets. Every deploy creates it or resets its password to the
secret, so to change or recover it, update the secret and redeploy (changing it in admin lasts only until the next
deploy). Use letters and numbers only (`openssl rand -hex 16`). Sign in with it, then give others access from admin.

- **Make an account:** sign up on the site as a person or an organization, like a real user.
- **Verify an organization without the email code:** enter the organization's details on the site (it shows as
  Pending), then open admin → Organizations, tick it, and choose **Mark verified**. Refresh the site.
- **Try the email check again:** admin → Organizations, tick it, choose **Reset email check**. The account stays;
  it goes back to entering its details.
- **Sign in as an existing account:** admin → Users → the account → **change password** (under Password), then sign
  in with it in a private window.
- **Use the demo accounts (KAN-26):** migrations load made-up accounts and 10 sample items, all on `.example`
  emails: families `taylor@demo.example` and `jordan@demo.example`, people giving `casey@demo.example` and
  `morgan@demo.example`, and Verified organizations `team@samplecommunitycloset.example`,
  `team@examplefamilypantry.example` and `team@demobabybasicshub.example`. They have no password until you set one
  (see "Sign in as an existing account"). Sample pickup dates are a few days out; when they pass, admin → Items →
  select all → **Refresh demo pickup dates**.
- **Give someone admin access:** admin → Users → their account → tick **Staff status** and **Superuser status**.

## VM access for teammates

Everyone gets their own key, so nobody shares the master `.pem`:

1. Teammate runs `ssh-keygen -t ed25519 -C "their-name"` and sends you **only** `~/.ssh/id_ed25519.pub`.
2. Someone with access runs `./scripts/add-teammate-key.sh their-key.pub`.
3. Teammate connects with `ssh opc@207.211.189.5`.

To revoke access, delete that person's line from `~/.ssh/authorized_keys` on the VM.

**Never commit `.pem` files or `.env` files.** Both are in `.gitignore`.
