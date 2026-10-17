# PVllg: guide for AI coding agents and new developers

PVllg is a hackathon web app: a **Django REST API** (Python 3.9) and a **React** single-page app, backed by
**Oracle MySQL HeatWave** and deployed to an **Oracle Cloud (OCI) VM** by GitHub Actions.

Live site: http://207.211.189.5 · Repo: https://github.com/lynnsamuelson/PVllg

---

## Hard constraints (read first)

- **Python 3.9 only.** The VM runs 3.9. Don't use `match`, `X | Y` type unions at runtime, `zip(strict=)`,
  or other 3.10+ features.
- **Django 4.2 LTS.** This is the last Django that supports Python 3.9, so don't upgrade to 5.x.
  `requirements.txt` pins `Django>=4.2,<4.3`.
- **MySQL driver is PyMySQL** (pure Python, installed as `MySQLdb` in `config/__init__.py`).
  Don't switch to `mysqlclient`, because it needs C headers that aren't on the VM.
- **Never push to `main`.** It's protected. Open a PR. The required checks must pass, and every deploy
  waits for manual approval.
- **Never commit secrets:** `.env`, `*.pem`, passwords, keys. Production config comes from GitHub
  Actions secrets (see Deployment).
- **The API is locked by default.** Every endpoint requires login unless it explicitly opts out. Keep it
  that way (see Backend conventions).

---

## Stack

| Layer | Tech |
| --- | --- |
| API | Django 4.2, Django REST Framework 3.15, session auth, gunicorn |
| DB | MySQL HeatWave (private IP, production). SQLite locally and in CI when `DB_HOST` is unset |
| UI | React 18, Vite 5, react-router-dom 6, plain CSS |
| Hosting | OCI VM (Oracle Linux 9, 1 OCPU / 4 GB), Apache httpd → gunicorn, systemd |
| CI/CD | GitHub Actions: `.github/workflows/ci-deploy.yml` |

---

## Repository map

```
backend/
  config/            settings.py (all config via env vars), urls.py, wsgi.py
  accounts/          signup/login/logout/me + CSRF; SessionAuthentication401
  resources/         Resource model, read-only API, admin, seed migration
  api/               /api/health/ (public) and the Notes demo
  requirements.txt
frontend/
  src/               see frontend/src/README.md for the full folder guide
    App.jsx          route table
    routes.js        every URL path; always use ROUTES.x
    pages/<area>/    one folder per area, one file per page
    components/      shared UI (Layout, NavBar, ProtectedRoute, FieldError, Placeholder)
    context/         AuthContext (current user, login/signup/logout)
    api/client.js    the ONLY place that calls fetch(); handles CSRF + 401
    styles/index.css global styles + brand color tokens
deploy/              Apache vhost, systemd unit, remote-deploy.sh (runs on the VM)
scripts/             add-teammate-key.sh, db-tunnel.sh
```

---

## Commands

**Backend** (from `backend/`):

```bash
python3.9 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env              # SQLite by default
python manage.py migrate
python manage.py runserver        # http://127.0.0.1:8000
python manage.py test             # run before every PR
python manage.py makemigrations   # commit the generated files
```

**Frontend** (from `frontend/`, Node 18+):

```bash
npm install
npm run dev                       # http://localhost:5173, proxies /api and /admin to :8000
npm run build                     # must succeed before every PR
```

**What CI runs.** The required checks `backend` and `frontend` must pass to merge:
- `backend`: `python manage.py check`, `python manage.py makemigrations --check --dry-run`, `python manage.py test`
- `frontend`: `npm ci` then `npm run build`

If you change a model, commit its migration, or `makemigrations --check` fails the build.

---

## Backend conventions

- **One Django app per feature area** (`accounts`, `resources`, …). Each app has `models.py`,
  `serializers.py`, `views.py`, `urls.py`, `admin.py`, `tests.py`. Mount it in `config/urls.py` under `api/<name>/`.
- **Auth is locked by default.** `DEFAULT_PERMISSION_CLASSES = IsAuthenticated`. New endpoints are protected
  automatically. Only add `@permission_classes([AllowAny])` (or `permission_classes = [AllowAny]`) when an
  endpoint truly must be public, and add it to `PUBLIC` in `api/tests.py::LockdownTests`. Add new protected
  endpoints to `PROTECTED` there too.
- Logged-out requests return **401** (`accounts/authentication.py`). The frontend relies on 401 to redirect to
  login, so don't replace this with DRF's default 403.
- **Users** are Django's built-in `User`. The lowercased email is stored as `username` (and `email`), and the
  display name goes in `first_name`. Use `get_user_model()`. Don't introduce a custom user model; existing
  migrations depend on the built-in one.
- **CSRF:** session cookies plus the `X-CSRFToken` header. Anonymous POST endpoints that change auth state
  must call `enforce_csrf(request)` (see `accounts/views.py`), because DRF skips CSRF for anonymous users.
- **Settings come from env vars only** (`config/settings.py`). Add new settings with a safe local default.
- **Write tests** for every endpoint: at minimum, logged out → 401 and logged in → expected data.
- **Migrations run against the shared production database on deploy.** Avoid destructive changes (dropping or
  renaming columns that hold data) without a plan. Seed data goes in a data migration with a reverse function.

## Frontend conventions

- **Add a page:** create `pages/<area>/<Name>Page.jsx` → add the path to `routes.js` → add a `<Route>` in
  `App.jsx` (inside the `<ProtectedRoute>` block if it needs login) → link with `<Link to={ROUTES.x}>`.
- **All HTTP goes through `api/client.js`.** Add a named function per endpoint there. It adds the CSRF token,
  sends cookies, throws `ApiError` (with `.status` and `.fields` for per-field validation errors), and logs the
  user out on 401.
- Get the current user from `useAuth()` (`user`, `loading`, `login`, `signup`, `logout`). Don't store auth state
  or tokens anywhere else. The session is an HttpOnly cookie.
- Show API validation errors with `<FieldError messages={err.fields.<field>} />`.
- Every page that fetches data needs loading, empty and error states.
- Pages awaiting design show `<Placeholder>`. Remove it once the real design is in.
- Plain CSS in `styles/index.css`, using the color tokens below. Don't add a CSS framework without asking the team.

---

## Design: brand colors

Design is still being finalized. Use these tokens (defined in `frontend/src/styles/index.css`) rather than raw
hex values.

| Token | Hex | Role |
| --- | --- | --- |
| `--color-plum` | `#593B50` | **Primary.** Nav, headings, primary buttons |
| `--color-peach` | `#E8B394` | **Primary accent.** Highlights, active states, accent backgrounds |
| `--color-sage` | `#8AAA72` | **Secondary.** Tags, borders, decorative accents |
| `--color-green` | `#387C60` | **Secondary.** Success states, secondary buttons, links |

**Accessible pairings** (WCAG AA needs a contrast ratio of at least 4.5 for normal text, 3 for large text and UI):

| Combination | Ratio | Use? |
| --- | --- | --- |
| White text on plum | 9.7 | ✅ any text |
| Plum text on peach | 5.2 | ✅ any text |
| Dark text (`#1F1A1E`) on peach | 9.2 | ✅ any text |
| White text on green | 5.0 | ✅ any text (buttons, badges) |
| Green text on white | 5.0 | ✅ links, success messages |
| Dark text on sage | 6.6 | ✅ any text |
| Sage text on white | 2.6 | ❌ decoration and borders only |
| Peach text on white | 1.9 | ❌ never for text |
| White text on sage or peach | 1.9–2.6 | ❌ never |

---

## Git and PR workflow

1. Branch from `main` as `<type>/<firstname>-<thing>`, all lowercase, where type is `feature`, `fix`, `docs` or
   `chore`. Example: `feature/sydney-resource-filters`. The `pr-hygiene` check fails other names.
2. Keep PRs focused. Run `/pre-pr` (or backend tests and the frontend build) locally first.
3. Open a PR into `main` and fill in `.github/pull_request_template.md`. **Summary** and **QA steps** must not be
   empty: QA steps are numbered steps a teammate can follow, with the expected result of each. The `backend`,
   `frontend` and `pr-hygiene` checks run automatically and must pass.
4. Merging to `main` starts a deploy that **pauses for approval** (Actions → the run → *Review deployments*).
5. After approval, the pipeline deploys and checks `http://<VM>/api/health/`.

---

## Deployment and infrastructure

**Pipeline** (`.github/workflows/ci-deploy.yml`, deploy job): builds React, tars `backend/`, `deploy/` and
`frontend/dist`, writes a `.env` from secrets, copies both to the VM over SSH, and runs `deploy/remote-deploy.sh`.
That script installs Python deps, runs `migrate` and `collectstatic`, publishes the React build, installs the
Apache and systemd config, restarts the app, and checks health.

**GitHub configuration.** Never put these values in code.

| Name | Kind | Purpose |
| --- | --- | --- |
| `VM_HOST` | variable | VM public IP |
| `VM_SSH_KEY`, `VM_KNOWN_HOSTS` | secret | Deploy key + host key for SSH |
| `DJANGO_SECRET_KEY` | secret | Django secret |
| `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | secret | HeatWave app user (not admin) |

**On the VM** (Oracle Linux 9, user `opc`, SELinux enforcing). Paths still use the original placeholder name
`hackathon-app`:

| What | Where |
| --- | --- |
| Django code, venv, `.env` | `/opt/hackathon-app/` |
| React build | `/var/www/hackathon-app/` |
| API service | `sudo systemctl status hackathon-api`, `journalctl -u hackathon-api -f` |
| Apache vhost / logs | `/etc/httpd/conf.d/hackathon-app.conf`, `/var/log/httpd/hackathon-app-*.log` |

- The web server is **Apache httpd** (pre-installed by the OCI starter kit). Don't install nginx; it would conflict on port 80.
- Apache serves the React build and proxies `/api/` and `/admin/` to gunicorn on `127.0.0.1:8000`.
  Unknown paths fall back to `index.html` (client-side routing).
- Django static files (admin, DRF) are served by whitenoise under `/api/static/`.
- **HeatWave has only a private IP.** Only the VM can reach it. For local access, use `scripts/db-tunnel.sh`.
  It's the **shared production database**, so be careful.

---

## Not built yet

- Forgot password / password reset (needs an email service; the page is a placeholder)
- Rate limiting on login
- Profile editing
- Final visual design (pages carry the `Placeholder` banner)
- HTTPS / custom domain (the site is plain HTTP on the VM IP)
