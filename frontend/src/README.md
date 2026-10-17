# Frontend source guide

```
src/
├── main.jsx              Entry point: router + auth provider wrap the app
├── App.jsx               Route table: which URL shows which page
├── routes.js             All URL paths in one place (use ROUTES.x, never hard-code paths)
│
├── pages/                One folder per area; one file per page
│   ├── auth/             LoginPage, SignupPage (real), ForgotPasswordPage (placeholder)  (public)
│   ├── home/             HomePage: lists resources                       (login required)
│   ├── resources/        ResourceDetailPage: one resource                (login required)
│   ├── profile/          ProfilePage                                     (login required)
│   ├── status/           StatusPage: dev check of API + database         (public, not in nav)
│   └── NotFoundPage.jsx  Shown for unknown URLs
│
├── components/           Pieces shared across pages
│   ├── Layout.jsx        Nav bar + page area wrapper
│   ├── NavBar.jsx        Top navigation (changes when logged in/out)
│   ├── ProtectedRoute.jsx  Redirects logged-out users to /login
│   ├── FieldError.jsx    Shows API validation messages under a form field
│   └── Placeholder.jsx   Yellow "placeholder" banner — delete when pages are designed
│
├── context/
│   └── AuthContext.jsx   Who is logged in (asks Django on load); login/signup/logout
├── api/
│   └── client.js         Functions that call the Django API (/api/...), handles CSRF
├── data/
│   └── mockResources.js  Sample resources until the real API exists
└── styles/
    └── index.css         Global styles (minimal, pending design)
```

## Page map

```
/login ──► / (Home: resource list) ──► /resources/:id ──► back to /
  │  ▲          │
  │  │          └──► /profile ──► back to /
  ▼  │
/signup   /forgot-password ──► back to /login
```

Logging in returns you to the page you originally tried to open. "Log out" in the nav goes to `/login`.

## Accounts

Sign-up and log-in are real: they call the Django `accounts` app (`backend/accounts/`), which uses
Django's built-in users (email stored as username), password hashing and password-strength rules.
The session is an HttpOnly cookie, so the frontend never handles tokens.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/auth/csrf/` | Sets the CSRF cookie |
| `GET /api/auth/me/` | `{user}` or `{user: null}` |
| `POST /api/auth/signup/` | `{name, email, password}`: creates the account and logs in |
| `POST /api/auth/login/` | `{email, password}` |
| `POST /api/auth/logout/` | Ends the session |

Forgot password is still a placeholder (it needs an email service).

## Adding a page

1. Create `pages/<area>/<Name>Page.jsx`.
2. Add its path to `routes.js`.
3. Add a `<Route>` in `App.jsx`: inside the `ProtectedRoute` block if it requires login.
4. Link to it with `<Link to={ROUTES.yourPage}>`.
