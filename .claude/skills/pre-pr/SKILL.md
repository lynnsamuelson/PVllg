---
name: pre-pr
description: Run the same checks CI runs, plus a security review of the branch diff, before opening a PR. Use when the user is about to open or update a PR.
---

0. The current branch must match `<type>/<firstname>-<thing>` (type: `feature`, `fix`, `docs`, `chore`), e.g. `feature/sydney-resource-filters`. If it doesn't, stop and suggest a name.

Run these and stop at the first failure, then report it with the output. Don't fix things unless asked.

1. In `backend/` (activate `.venv` if it exists):
   - `python manage.py check`
   - `python manage.py makemigrations --check --dry-run` (if it fails, a model changed without a committed migration)
   - `coverage run manage.py test && coverage report` (needs `pip install -r requirements-dev.txt`; fails below the `fail_under` floor)
2. In `frontend/`: `npm run coverage` (fails below the thresholds in `vite.config.js`), then `npm run build`, then `npm run e2e` (Playwright; first time: `npx playwright install chromium`)
3. Review `git diff origin/main...HEAD` against the AGENTS.md rules:
   - Any new endpoint is in `PROTECTED` or `PUBLIC` in `backend/api/tests.py::LockdownTests`, and has a logged-out → 401 test and a logged-in test.
   - `AllowAny` appears only where an endpoint truly must be public; anonymous POSTs that change auth state call `enforce_csrf(request)`.
   - No `fetch()` outside `frontend/src/api/client.js`; no raw hex colors where a token exists.
   - No secrets, `.env`, keys or hardcoded IPs/passwords.
   - Migrations don't drop or rename columns that hold data.
   - Nothing Python 3.10+ (`match`, `X | Y` unions at runtime, `zip(strict=)`).
   - Docs: if the diff changes anything `README.md`, `AGENTS.md` or `frontend/src/README.md` describes (setup, commands, env vars, folders, conventions, CI, deploy), those files are updated in the diff too. If not, it's a blocker: list exactly what's stale.
4. Run `/security-review`.

5. If everything passes, draft the PR description from `.github/pull_request_template.md`. **QA steps** are numbered steps a teammate can follow, each with an expected result, written from the diff. Don't claim checklist items you didn't verify. Tick the docs box only after the docs check in step 3 passed.

Finish with one line: ready, or the list of blockers.
