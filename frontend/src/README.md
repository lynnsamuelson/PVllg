# Frontend source guide

```
src/
├── main.jsx              Entry point: router + auth provider wrap the app
├── App.jsx               Route table: which URL shows which page
├── routes.js             All URL paths in one place (use ROUTES.x, never hard-code paths)
├── format.js             Dates and pickup windows as the mockups write them ("Thu, Oct 22 · 10 am - 2 pm")
├── logger.js             Logging wrapper: use log.info/warn/error, never console directly
│
├── pages/                One folder per area; one file per page
│   ├── welcome/          WelcomePage (Mock Up 1)                         (public)
│   ├── auth/             AccountTypePage (Mock Up 2), SignupPage, LoginPage, ForgotPasswordPage (placeholder)  (public)
│   ├── home/             HomePage: lists resources                       (login required)
│   ├── resources/        ResourceDetailPage (Mock Up 22): every fact, "Not listed" for blanks  (login required)
│   ├── profile/          ProfilePage, ProfileSetupPage (4 steps, KAN-6)  (login required)
│   ├── org/              OrgSignupPage (Mock Up 7), OrgVerifyPage (Mock Up 8), OrgProfilePage (Mock Up 9, Verified only)  (login required)
│   ├── claims/           MyClaimsPage (Mock Up 15): Active and Past claims, Cancel claim; AddToCalendarPage (Mock Up 16);
│   │                     ReportProblemPage (Mock Ups 17-18)  (login required)
│   ├── search/           SearchPage (Mock Up 12): Items and Resources tabs; search state lives in the URL  (login required)
│   ├── items/            ItemDetailPage (Mock Ups 13-14, anyone signed in); MyItemsPage (Mock Up 21) and
│   │                     PostItemPage (2 steps, Mock Ups 19-20; also Edit)  (givers only)
│   ├── status/           StatusPage: dev check of API + database         (public, not in nav)
│   ├── ComingSoonPage.jsx  Stand-in for tabs whose ticket isn't built yet (login required)
│   └── NotFoundPage.jsx  Shown for unknown URLs
│
├── components/           Pieces shared across pages
│   ├── Layout.jsx        Page area + bottom bar once signed in
│   ├── BottomNav.jsx     Signed-in tabs: person (Home, Search, Claims, Give, Profile) or organization (Items, Claims, Impact, Profile)
│   ├── Button.jsx        Primary / outline / small button; a <Link> when given `to`
│   ├── TextField.jsx     Label + input (text box with `multiline`, dropdown with `options`) + hint + API errors
│   ├── ChoiceCard.jsx    Selectable card, one pick per group
│   ├── Chip.jsx          Pill choice, one pick per group (or several with `multiple`)
│   ├── Checkbox.jsx      Checkbox row (green box with a white check)
│   ├── ProgressBar.jsx   STEP n OF total (· title) and the green bar
│   ├── NoteBox.jsx       Peach-tint note
│   ├── Logo.jsx          PVill mark
│   ├── BrandHeader.jsx   Logo with "PVill" under it, top of most screens
│   ├── AppHeader.jsx     Small logo with the screen title beside it, top left (Mock Ups 9, 10, 21)
│   ├── Badge.jsx         Pill badge (pending, verified, person, demo)
│   ├── BackToResults.jsx "← Results" on details screens: back to the list that opened it (state fromList), else a fallback
│   ├── Tabs.jsx          Text tabs with a green underline on the active one
│   ├── CodeInput.jsx     Six boxes for an emailed code
│   ├── ProtectedRoute.jsx  Redirects logged-out users to /welcome
│   ├── RequireGiver.jsx  Shows its routes only to givers (Verified organizations, people with Give support)
│   ├── RequireVerifiedOrg.jsx  Shows only Verified organizations its routes; tells everyone else why (`title`, `pendingNote`, `othersNote`)
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
   │                                     └──► /signup?type=organization ──► /org/signup ──► /org/verify ──► /org/profile
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
| `POST /api/auth/org/profile/` | `{about, serves[], pickup_address, public_contact}`: a Verified organization's public profile. The address needs a ZIP code (search measures distance from it) |
| `POST /api/items/` | Post an item (givers only), as multipart form data with up to 4 `photos` (JPEG/PNG/WebP, 5 MB each). A person's `exact_address` must end with a ZIP code; an organization's comes from its profile |
| `GET /api/items/search/` | Search near me, Items tab: `q`, `category` (essentials, feeding, parenting, housing), `radius` (5, 10, 25, 50; default 10). Live items with a pickup day not yet passed, within the radius of your ZIP, nearest first, shaped like `GET /api/items/:id/` |
| `POST /api/claims/` | `{item}`: Claim one / Request to claim (people only). A Verified organization's item is Approved at once, a person's is Waiting; holds for 3 days. 409 when someone just took the last one |
| `GET /api/claims/` | My claims: current (Waiting, Approved), or ended ones with `?tab=past` (an Ended claim's `end_reason`: `hold_ended`, `no_answer`, `no_show` or `problem`). Each has the item, shaped like `GET /api/items/:id/` |
| `GET /api/claims/:id/` | One of your Approved claims, with `event` (`where`, `notes`: what the calendar file holds); `pickup_changed` is true when the giver changed when or where since you claimed it or last added it to your calendar |
| `GET /api/claims/:id/calendar.ics` | An Approved claim's pickup as a calendar file (privacy rule applied). `?reminders=day,hour` adds alarms; `?download=1` saves instead of opening |
| `POST /api/claims/:id/report/` | `{reason, note}`: report a pickup problem on your Approved claim, from the start of the pickup window until a day after it ends (`can_report` on the claim). Releases the claim and pauses the item; returns `{reason, chip}` (the Search chip for similar items) |
| `POST /api/items/mine/:id/available/` | The giver puts a paused item back in search |
| `POST /api/claims/:id/cancel/` | Cancel your claim; the item goes back on the list |
| `POST /api/claims/:id/approve/`, `/decline/`, `/picked-up/`, `/didnt-come/` | The item's giver answers a Waiting request, or marks an Approved claim picked up or not (Family didn't come). Returns `{id, status, held_until, family}` (first name only) |
| `GET /api/items/:id/` | One item as others see it: general area, whole-mile `distance_miles`, `giver` (organization name, or "A parent nearby"), `left` (listed minus current claims), `photos` (URLs), `available` (some left, the pickup day hasn't passed, and not paused by a problem report), `mine`, `demo` (made-up sample data: show the Demo badge). `exact_address` and `where_to_go` are null with a `private_note` unless the viewer may see them (KAN-11) |
| `GET /api/items/mine/` | Your own items (any account, so turning Give off doesn't strand them) that aren't taken down, with `exact_address` and counts `left`, `requested`, `claimed`, and `claims` (current ones: `{id, status, held_until, family}`), and `paused` (the reported reason, or null) |
| `GET`/`PUT`/`DELETE /api/items/mine/:id/` | One of the giver's items: fill in Edit, save it (JSON, photos unchanged; givers only), take it down |
| `GET /api/items/photos/:id/` | One photo of a live item, for anyone signed in (its giver can always see it) |
| `GET /api/resources/`, `/api/resources/:id/` | Resource list / detail (login required) |

Forgot password is still a placeholder.

## Adding a page

1. Create `pages/<area>/<Name>Page.jsx`.
2. Add its path to `routes.js`.
3. Add a `<Route>` in `App.jsx`: inside the `ProtectedRoute` block if it requires login.
4. Link to it with `<Link to={ROUTES.yourPage}>`.
