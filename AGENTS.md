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
  config/            settings.py (all config via env vars), urls.py, wsgi.py, log.py (logging wrapper)
  accounts/          signup/login/logout/me + CSRF; SessionAuthentication401
  resources/         Resource model, read-only API, admin; data/organization-profiles.json is the 12 real, checked
                     programs (KAN-26), loaded by migration 0005;
                     matching.py ranks resources for a profile (GET /api/resources/matches/, KAN-16)
  items/             Item + ItemPhoto models; POST /api/items/ (Post an item, KAN-9), /api/items/mine/ (My items,
                     edit, take down: KAN-10), photos served by
                     GET /api/items/photos/<id>/ (stored in the database, so the VM needs no media folder)
                     privacy.py is the address privacy rule (KAN-11); GET /api/items/<id>/ and
                     GET /api/items/search/ (Search near me, KAN-15) apply it
                     data/sample-data.json: made-up demo accounts and sample items (KAN-26, migration 0003);
                     demo.py refreshes their pickup dates (admin action)
  claims/            Claim model (Waiting, Approved, Declined, Canceled, Ended, Picked up); endpoints in KAN-12/13
  api/               /api/health/ (public) and the Notes demo
  requirements.txt   what the VM installs
  requirements-dev.txt  + test tools (coverage); use this locally and in CI
  .coveragerc        coverage settings and the fail_under floor
design/              PVill-all-screens.pdf (the 25 mockups) + README.md (screen → ticket map)
frontend/
  src/               see frontend/src/README.md for the full folder guide
    App.jsx          route table
    routes.js        every URL path; always use ROUTES.x
    pages/<area>/    one folder per area, one file per page
    components/      shared UI (Layout, BottomNav, Button, TextField, ChoiceCard, Chip, Checkbox, ProgressBar, NoteBox, Logo, BrandHeader, AppHeader, Badge, Tabs, CodeInput, ProtectedRoute, RequireVerifiedOrg, RequireGiver, FieldError, Placeholder)
    context/         AuthContext (current user, login/signup/logout)
    api/client.js    the ONLY place that calls fetch(); handles CSRF + 401
    logger.js        the ONLY place that calls console; use log.info/warn/error
    **/*.test.js(x)  Vitest unit tests, next to the file they test
    styles/index.css global styles + design tokens (colors, spacing, radii, type)
    assets/          brand images (mark, wordmark); use these, don't redraw the logo
  public/            files served as-is at the site root (app icon / favicon)
  e2e/               Playwright browser tests (playwright.config.js starts Django + Vite itself)
deploy/              Apache vhost, systemd unit, remote-deploy.sh (runs on the VM)
scripts/             add-teammate-key.sh, db-tunnel.sh
```

---

## Commands

**Backend** (from `backend/`):

```bash
python3.9 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env              # SQLite by default
python manage.py migrate
python manage.py runserver        # http://127.0.0.1:8000
python manage.py test             # quick test run
coverage run manage.py test && coverage report   # what CI runs; fails below fail_under
python manage.py makemigrations   # commit the generated files
```

**Frontend** (from `frontend/`, Node 20+):

```bash
npm install
npm run dev                       # http://localhost:5173, proxies /api and /admin to :8000
npm run build                     # must succeed before every PR
npm test                          # Vitest unit tests
npm run coverage                  # unit tests + coverage; fails below the thresholds in vite.config.js
npx playwright install chromium   # once, before the first e2e run
npm run e2e                       # Playwright; starts its own Django (:8001) + Vite (:5174) on a throwaway SQLite
```

**What CI runs.** The required checks `backend`, `frontend` and `pr-hygiene` must pass to merge:
- `backend`: `python manage.py check`, `python manage.py makemigrations --check --dry-run`,
  `coverage run manage.py test`, `coverage report` (also written to the job summary)
- `frontend`: `npm ci`, `npm run coverage`, `npm run build`
- `e2e`: `npm run e2e` in Chromium; the HTML report is uploaded when it fails. Not required yet, and it doesn't
  gate deploys. Make it required once it has proven stable.
- `pr-hygiene`: branch name, and a filled-in PR description including the docs checkbox (see Git and PR workflow)

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
  display name goes in `first_name`. Whether the account is a person or an organization lives in `accounts.Profile.account_type`
  (`user.account_type` in the API); accounts made before it existed read as `person`. Use `get_user_model()`. Don't introduce a custom user model; existing
  migrations depend on the built-in one.
- **A person's profile answers** (ZIP, stage, child age groups, roles, needs, Get/Give/Both) are fields on
  `accounts.Profile`, saved by `POST /api/auth/profile/` and read as `user.profile` (null until set up) and `user.gives`.
  The age-group, role and need keys come from `resources` (`matching.AGE_GROUPS`, `ROLE_TO_SERVES`, `models.CATEGORIES`),
  so `user.profile` can be passed straight to `getResourceMatches`.
- **CSRF:** session cookies plus the `X-CSRFToken` header. Anonymous POST endpoints that change auth state
  must call `enforce_csrf(request)` (see `accounts/views.py`), because DRF skips CSRF for anonymous users.
- **Settings come from env vars only** (`config/settings.py`). Add new settings with a safe local default, and list
  them (commented out, with the default) in `backend/.env.example`.
- **Write tests** for every endpoint: at minimum, logged out → 401 and logged in → expected data.
- **Logging:** `from config.log import get_logger; logger = get_logger(__name__)`. Never import `logging` (or
  another logging library) directly, so the library can be swapped in one place. Output goes to stdout, which is
  `journalctl -u hackathon-api` on the VM; the level comes from `DJANGO_LOG_LEVEL` (default `INFO`). Log user ids,
  not passwords, tokens or request bodies. When a test triggers a log line, wrap it in `self.assertLogs(...)` so
  test output stays clean.
- **Coverage** can't drop below `fail_under` in `.coveragerc`. When you raise coverage, raise the floor too.
- **Organizations are Pending until they confirm a work email** on their website's domain (`accounts.Organization`,
  `user.organization.status` in the API: `pending` or `verified`, `null` before they start). For testing, admin →
  Organizations → **Mark verified** skips the code (README → Test accounts). Anything only Verified organizations may
  do must check `organization.verified_at` on the backend; on the frontend, wrap the route in
  `<RequireVerifiedOrg>`. A Verified organization's public profile (about, who it serves, pickup address, public contact)
  is on `accounts.Organization` too, saved by `POST /api/auth/org/profile/`; `zip_code` is taken from the address
  (which must end with it) for search to measure distance from. Email goes through `django.core.mail` (`EMAIL_*` settings; the console without `EMAIL_HOST`).
- **Givers** are a Verified organization or a person with Give support or Both on (`user.gives`). Only they can post
  items (`items.views.IsGiver`; `<RequireGiver>` on the frontend). An item's exact address is private and stored apart
  from its public general area; an organization's items use its profile address, and follow it when it changes.
  Take down sets `Item.taken_down_at` instead of deleting, so list and search items with `Item.objects.live()`.
- **The address privacy rule lives only in `items/privacy.py`** (KAN-11). Anything that shows an item to someone
  other than its giver (search, item details, My claims, calendar files, messages) uses `PublicItemSerializer` or
  `privacy.can_see_exact_address`, never its own check, and loads items with `Item.objects.public()`. A person's
  exact address and Where to go reach only the family with an Approved claim, until it ends or the day after pickup;
  distances are whole miles (`privacy.rounded_miles`); a person giver shows by first name only (`privacy.giver_name`).
- **More than one write per request goes in `transaction.atomic()`** (for example a `User` plus its `Profile`), so a
  failure halfway can't leave a half-made record. Test it: make the second write fail and assert nothing was saved.
- **Demo data is labeled.** Made-up accounts have `Profile.is_demo`; item responses carry `demo: true` for them. Show
  the Demo badge wherever their items or profiles appear (Words: label made-up data). The two KAN-26 JSON files are
  migration inputs: don't edit them to change shipped data, add a migration or edit in admin.
- **Tests run on a database that already has the starter resources and demo accounts** (loaded by migrations), so
  assert on your own rows (`filter(owner=...)`, `filter(username=...)`), not on `.count()` or `.exists()` of a table.
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
- Use `<Button>` (`variant="primary"|"outline"`, `small`, `to` for links) and `<TextField label hint errors>` instead of
  raw `<button>`/`<input>` markup.
- Show API validation errors with `<TextField errors={err.fields.<field>}>`, or `<FieldError messages={...} />` for
  errors not tied to one field.
- Branch on account type with `user.account_type === "organization"` (or `"person"`). Don't infer it from routes
  or other fields.
- **Check URL and query values against an explicit list** with `Object.hasOwn(MAP, value)` or a `Set`, never
  `MAP[value]`: plain objects also answer to `constructor`, `toString` and `__proto__`.
- **Don't mix `navigate()` with a render-time `<Navigate>` on the same page.** On a page that redirects signed-in users
  (`if (user) return <Navigate …>`), a submit handler that calls `navigate()` after login/signup can lose to that
  redirect. Store the destination in state instead (`setNext(path)`, then `if (next) return <Navigate to={next} />`),
  and skip the signed-in redirect while submitting. See `SignupPage.jsx` and its test.
- Every page that fetches data needs loading, empty and error states.
- Pages awaiting design show `<Placeholder>`. Remove it once the real design is in. Screens whose ticket isn't built
  yet use `<ComingSoonPage title>`, which shows the same `<Placeholder>`, so searching for `Placeholder` finds both.
- Plain CSS in `styles/index.css`, using the design tokens (see Design below). Don't add a CSS framework without
  asking the team.
- **Logging:** `import { log } from "../logger.js"` and use `log.debug/info/warn/error`, never `console` directly.
  Error reporting (e.g. Sentry) gets wired into `logger.js` later. `ErrorBoundary` (in `main.jsx`) logs render
  crashes.
- **Unit tests** (Vitest + Testing Library) go next to the file as `<name>.test.js(x)`. Use them for logic:
  `api/client.js`, context, hooks, components with behavior. Coverage can't drop below the thresholds in
  `vite.config.js`.
- **Browser tests** (Playwright) go in `frontend/e2e/`, one spec per user flow. Use them for whole flows across
  pages, and use unique emails per test (the e2e database is reused between tests). Prefer `getByRole` and
  `getByLabel` over CSS selectors.
- **Every PR that adds a screen, flow or user-visible behavior adds or extends an e2e spec for it**, in the same
  PR. Unit tests don't replace it. Shared sign-up and setup steps live in `e2e/helpers.js`.

---

## Design

The designs are in the [PVill Figma file](https://www.figma.com/design/ro8GztAZLeYwu4b7aG086X/Pvill) (KAN-4), with
frames named `NN · Area · Screen` to match the mockup numbers. Build from Figma; `design/PVill-all-screens.pdf` (25
phone screens, numbered "Mock Up 1" to "Mock Up 25") is the fallback for anything not in Figma yet. Jira tickets refer
to these numbers. `design/README.md` maps each screen to its Jira ticket and lists the rules each screen must keep.
**Before building or restyling a page, open its design and match it.** Where Figma and this file disagree, this file
wins until it is updated.

**Figma is drawn 1.3× larger.** Its frames are 390px wide; our tokens were measured on the 300px-wide PDF. Divide any
px value you read in Figma by 1.3 to find the token (Figma 24.7 → `--text-title` 19px, 16.9 → `--text-body` 13px,
15.6 button radius → `--radius-button` 12px, 20.8 side padding → `--space-side` 16px).

**Tokens.** Use the variables in `frontend/src/styles/index.css`, never raw hex (white included: `--color-white`),
px radii or font sizes. Don't make up sizes with `calc()` on a token either; if no token fits, add one to `:root` and
list it here.

| Token | Hex | Role |
| --- | --- | --- |
| `--color-plum` | `#593B50` | Deep Plum. Text, headings, selected chips, outline-button border |
| `--color-plum-muted` | `#745264` | Muted Plum. Secondary text, hints |
| `--color-rose` | `#B46F7C` | Dusty Rose. Text-field outlines |
| `--color-green` | `#387C60` | Forest Green. **Primary buttons**, selected card outline, active tab, progress bar |
| `--color-sage` | `#8AAA72` | Sage Green. Logo, success accents. Never text |
| `--color-peach` | `#E8B394` | Soft Peach. Logo arch, bottom-sheet top edge. Decoration only, never text |
| `--color-ivory` | `#FFF7F2` | Warm Ivory. Screen background |
| `--color-sage-tint` | `#E5EBDD` | Selected card fill, Verified badge, ticket chips |
| `--color-peach-tint` | `#F7E7DC` | Note boxes, Demo badge |
| `--color-person-tint` | `#F1E4EA` | Person badge |
| `--color-line` | `#EBD9D0` | Card borders, dividers |
| `--color-white` | `#FFFFFF` | Cards, text fields, outline buttons, button text, bottom bar |

Spacing and shape: `--space-side` 16px screen padding, `--space-card-gap` 9px between cards, `--radius-button` 12px,
`--radius-card` 14px, `--radius-pill` for chips and badges, `--radius-checkbox` 3px. Type: titles bold `--text-title`, body `--text-body`,
small `--text-small`, labels bold `--text-label`, choice-card titles bold `--text-card-title`, the PVill name on
Welcome `--text-display`. Figma uses Arimo, which has the same letter widths as Arial; `--font-brand` stays Arial
until Arimo is loaded.

**Components** (build each once in `components/`, then reuse; don't restyle per page):

- **Brand header:** leaf mark (84px in Figma) with "PVill" in bold under it, centered near the top of most screens.
  Welcome uses a larger mark (140px in Figma) and `--text-display`.
- **Primary button:** full width, green fill, white bold text. One per screen, for the main action.
- **Outline button:** white fill, plum border and text. For the second choice (Sign in, Send a new code, Back to
  details).
- **Small button:** same two styles, content width (Approve/Decline, Edit, Mark picked up).
- **Text link:** muted plum, small (Report a problem). Back links read `← Back` / `← Results` / `← My claims`.
- **Choice chip:** pill. Unselected: rose outline, plum text. Selected: plum fill, white text.
- **Checkbox row:** green filled box with white check when on.
- **Toggle:** green when on.
- **Card:** white, `--color-line` border, card radius. Selected card: sage-tint fill, green 2px outline.
- **Note box:** peach-tint fill, no border, small plum text. Used for privacy, demo and rule notes.
- **Badges:** pill, small bold, always plum text. Verified and Approved (sage tint, green border), Person (person
  tint), Pending and Waiting (white, line border), Demo / Demo only / Example data (peach tint). The mockups show
  green text on Verified/Approved, and so does Figma; design agreed to plum instead because green on sage tint fails
  contrast. Keep plum.
- **Text field:** white, rose outline, slightly smaller radius than buttons (13px in Figma, the same as note boxes).
  Bold label above, small muted hint below.
- **Progress bar:** green fill on line-color track, with `STEP n OF 4` in small caps above.
- **Tabs:** text tabs with a green underline on the active one (Items/Resources, Active/Past).
- **Bottom navigation:** signed-in screens only. Person: Home, Search, Claims, Give, Profile (Give only with Give
  support on). Organization: Items, Claims, Impact, Profile. Active tab is bold green.
- **Bottom sheet:** white, rounded top with a peach edge, page behind it fades (Reach out, Report a problem).

**Layout.** Mobile-first: one column, max width about 390px, ivory background, side padding 16px. No
desktop-specific layouts in this build.

**Words.** Copy in the mockups and tickets is final unless a ticket says otherwise. Keep it plain and short. Never
say "You qualify" (use "May be a good fit"), never "Request sent" in demo steps, and label made-up data
("Example data", "Demo"). Distances are rounded ("about 3 miles"); a person's exact address never appears before
approval (KAN-11).

**Accessible pairings** (WCAG AA needs at least 4.5 for normal text, 3 for large text and UI outlines):

| Combination | Ratio | Use? |
| --- | --- | --- |
| Plum on ivory / white | 9.2 / 9.7 | ✅ any text |
| White on plum | 9.7 | ✅ any text (selected chips) |
| Plum on peach tint, sage tint, person tint | 7.9–8.0 | ✅ any text (notes, badges) |
| Muted plum on ivory / white | 6.3 / 6.7 | ✅ any text |
| Plum on peach | 5.2 | ✅ any text |
| White on green | 5.0 | ✅ any text (primary buttons) |
| Green on ivory | 4.7 | ✅ any text (links, active tab) |
| Green on sage tint | 4.1 | ⚠️ large or bold 14px+ text only; fine for borders (Verified/Approved badge outline) |
| Rose on ivory | 3.6 | ✅ input outlines only, not text |
| Sage on ivory | 2.5 | ❌ decoration only |
| Peach on ivory | 1.8 | ❌ never for text |
| White on sage or peach | 1.9–2.6 | ❌ never |

---

## Git and PR workflow

1. Branch from `main` as `<type>/<firstname>-<thing>`, all lowercase, where type is `feature`, `fix`, `docs` or
   `chore`. Example: `feature/sydney-resource-filters`. The `pr-hygiene` check fails other names.
2. Keep PRs focused. New functionality comes with its e2e spec (see Frontend conventions). Run `/pre-pr` (or the
   commands in "What CI runs") locally first.
3. **Update the docs in the same PR.** If your change affects anything `README.md`, `AGENTS.md` or
   `frontend/src/README.md` describes (setup steps, commands, env vars, folders, conventions, CI, deploy), update
   them before you push. Then tick the docs box in the PR checklist. `pr-hygiene` fails until it's ticked, and
   ticking it is your confirmation that the docs either changed or didn't need to. Claude Code also gets a
   reminder before every `git commit` (a `PreToolUse` hook in `.claude/settings.json`).
4. Open a PR into `main` and fill in `.github/pull_request_template.md`. **Summary** and **QA steps** must not be
   empty: QA steps are numbered steps a teammate can follow, with the expected result of each. The `backend`,
   `frontend` and `pr-hygiene` checks run automatically and must pass.
5. Merging to `main` starts a deploy that **pauses for approval** (Actions → the run → *Review deployments*).
6. After approval, the pipeline deploys and checks `http://<VM>/api/health/`.

---

## Deployment and infrastructure

**Pipeline** (`.github/workflows/ci-deploy.yml`, deploy job): builds React, tars `backend/`, `deploy/` and
`frontend/dist`, writes a `.env` from secrets, copies both to the VM over SSH, and runs `deploy/remote-deploy.sh`.
That script installs Python deps, runs `migrate`, `ensure_admin` and `collectstatic`, publishes the React build, installs the
Apache and systemd config, restarts the app, and checks health.

**GitHub configuration.** Never put these values in code.

| Name | Kind | Purpose |
| --- | --- | --- |
| `VM_HOST` | variable | VM public IP |
| `VM_SSH_KEY`, `VM_KNOWN_HOSTS` | secret | Deploy key + host key for SSH |
| `DJANGO_SECRET_KEY` | secret | Django secret |
| `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | secret | HeatWave app user (not admin) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | secret | Main Django admin login. Each deploy creates it or resets its password (`manage.py ensure_admin`). Letters and numbers only: the deploy writes it unquoted into `.env`. Unset: skipped |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL` | secret | SMTP for organization codes (e.g. OCI Email Delivery on 587). Unset: emails go to `journalctl` |

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

- Forgot password / password reset (the page is a placeholder; email can reuse the SMTP settings)
- Rate limiting on login
- Error reporting service such as Sentry (hook it into `config/log.py` and `frontend/src/logger.js`)
- Profile editing
- Final visual design (pages carry the `Placeholder` banner)
- HTTPS / custom domain (the site is plain HTTP on the VM IP)
