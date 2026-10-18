# Frontend source guide

```
src/
├── main.jsx              Entry point: router + auth provider wrap the app
├── App.jsx               Route table: which URL shows which page
├── routes.js             All URL paths in one place (use ROUTES.x, never hard-code paths)
├── logger.js             Logging wrapper: use log.info/warn/error, never console directly
│
├── pages/                One folder per area; one file per page
│   ├── welcome/          WelcomePage (Mock Up 1)                         (public)
│   ├── auth/             AccountTypePage (Mock Up 2), SignupPage, LoginPage, ForgotPasswordPage (placeholder)  (public)
│   ├── home/             HomePage: lists resources                       (login required)
│   ├── resources/        ResourceDetailPage: one resource                (login required)
│   ├── profile/          ProfilePage                                     (login required)
│   ├── org/              OrgSignupPage (Mock Up 7), OrgVerifyPage (Mock Up 8)  (login required)
│   ├── status/           StatusPage: dev check of API + database         (public, not in nav)
│   ├── ComingSoonPage.jsx  Stand-in for tabs whose ticket isn't built yet (login required)
│   └── NotFoundPage.jsx  Shown for unknown URLs
│
├── components/           Pieces shared across pages
│   ├── Layout.jsx        Page area + bottom bar once signed in
│   ├── BottomNav.jsx     Signed-in tabs: person (Home, Search, Claims, Give, Profile) or organization (Items, Claims, Impact, Profile)
│   ├── Button.jsx        Primary / outline / small button; a <Link> when given `to`
│   ├── TextField.jsx     Label + input + hint + API errors
│   ├── ChoiceCard.jsx    Selectable card, one pick per group
│   ├── NoteBox.jsx       Peach-tint note
│   ├── Logo.jsx          PVill mark
│   ├── BrandHeader.jsx   Logo with "PVill" under it, top of most screens
│   ├── Badge.jsx         Pill badge (pending, verified)
│   ├── CodeInput.jsx     Six boxes for an emailed code
│   ├── ProtectedRoute.jsx  Redirects logged-out users to /welcome
│   ├── RequireVerifiedOrg.jsx  Shows only Verified organizations its routes; tells everyone else why
│   ├── FieldError.jsx    Shows API validation messages under a form field
│   ├── Placeholder.jsx   Yellow "placeholder" banner — delete when pages are designed
│   └── ErrorBoundary.jsx Logs render crashes and shows a fallback instead of a blank page
│
├── context/
│   └── AuthContext.jsx   Who is logged in (asks Django on load); login/signup/logout
├── api/
│   └── client.js         Functions that call the Django API (/api/...), handles CSRF
├── styles/
│   └── index.css         Global styles + design tokens (see AGENTS.md "Design")
└── test/
    └── setup.js          Vitest setup (jest-dom matchers, cleanup between tests)
```

Unit tests sit next to the file they test as `<name>.test.js(x)`. Browser tests are in `frontend/e2e/`.

## Page map

```
/welcome ──► Get started ──► /signup/type ──► /signup?type=person ──► /profile/setup (KAN-6)
   │                                     └──► /signup?type=organization ──► /org/signup ──► /org/verify ──► /org/items
   └──► Sign in ──► /login ──► / (person) or /org/items (organization)
```

Signed-in pages show the bottom bar; tabs without their own ticket yet show `ComingSoonPage`. Signing in
returns you to the page you originally tried to open. "Sign out" on the Profile tab goes to `/welcome`.
Give appears in the person bar only when `user.gives` is true (set by KAN-6/KAN-24).

## Accounts and access

**The API is locked by default.** Every Django endpoint requires login unless it explicitly
opts out (`/api/health/` and the `/api/auth/` endpoints do). A logged-out request gets **401**, and
`api/client.js` responds by logging the user out locally, which sends them to `/welcome`.
New endpoints are therefore protected automatically. Add `@permission_classes([AllowAny])` only
for things that must be public.


Sign-up and log-in are real: they call the Django `accounts` app (`backend/accounts/`), which uses
Django's built-in users (email stored as username), password hashing and password-strength rules.
The session is an HttpOnly cookie, so the frontend never handles tokens.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/auth/csrf/` | Sets the CSRF cookie |
| `GET /api/auth/me/` | `{user}` (includes `account_type` and `organization`) or `{user: null}` |
| `POST /api/auth/signup/` | `{name, email, password, account_type}`: `person` or `organization`; creates the account and logs in |
| `POST /api/auth/login/` | `{email, password}` |
| `POST /api/auth/logout/` | Ends the session |
| `POST /api/auth/org/` | `{name, website, work_email}`: checks the email is on the website's domain and not free email, then emails a 6-digit code (organizations only) |
| `POST /api/auth/org/resend/` | New code; the old one stops working. At most one every 30 seconds and 5 a day |
| `POST /api/auth/org/verify/` | `{code}`: right and under 15 minutes old marks the organization Verified; 5 tries per code |
| `GET /api/resources/`, `/api/resources/:id/` | Resource list / detail (login required) |

Forgot password is still a placeholder.

## Adding a page

1. Create `pages/<area>/<Name>Page.jsx`.
2. Add its path to `routes.js`.
3. Add a `<Route>` in `App.jsx`: inside the `ProtectedRoute` block if it requires login.
4. Link to it with `<Link to={ROUTES.yourPage}>`.
