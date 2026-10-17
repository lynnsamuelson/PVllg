# Frontend source guide

```
src/
├── main.jsx              Entry point: router + auth provider wrap the app
├── App.jsx               Route table: which URL shows which page
├── routes.js             All URL paths in one place (use ROUTES.x, never hard-code paths)
│
├── pages/                One folder per area; one file per page
│   ├── auth/             LoginPage, SignupPage, ForgotPasswordPage      (public)
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
│   └── Placeholder.jsx   Yellow "placeholder" banner — delete when pages are designed
│
├── context/
│   └── AuthContext.jsx   Who is logged in. PLACEHOLDER: fake login, swap for Django API
├── api/
│   └── client.js         Functions that call the Django API (/api/...)
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

## Adding a page

1. Create `pages/<area>/<Name>Page.jsx`.
2. Add its path to `routes.js`.
3. Add a `<Route>` in `App.jsx`: inside the `ProtectedRoute` block if it requires login.
4. Link to it with `<Link to={ROUTES.yourPage}>`.
