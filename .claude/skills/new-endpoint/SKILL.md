---
name: new-endpoint
description: Checklist for adding a backend API endpoint (and optionally its frontend page) the PVllg way. Use when adding a new API endpoint, model, or feature area.
---

Follow AGENTS.md. Do every step; the ones agents most often skip are marked ⚠.

**Backend**
1. New feature area → new Django app with `models.py`, `serializers.py`, `views.py`, `urls.py`, `admin.py`, `tests.py`; add it to `INSTALLED_APPS` and mount it in `config/urls.py` under `api/<name>/`. Small addition → extend the existing app.
2. Leave the default `IsAuthenticated`. Only use `AllowAny` if the user confirms the endpoint must be public.
3. Scope querysets to `request.user` when data belongs to a user, so one user can't read or edit another's.
   ⚠ If a request writes more than one row, wrap the writes in `transaction.atomic()` and test that a failing second
   write leaves nothing saved.
4. Model changed → `python manage.py makemigrations` and include the migration. No destructive changes to columns that hold data.
5. ⚠ Add the URL to `PROTECTED` (or `PUBLIC`) in `backend/api/tests.py::LockdownTests`.
6. ⚠ In the app's `tests.py`: logged out → 401, logged in → expected data, and validation errors → 400 for writes. Add another user's data and assert it isn't returned when data is per-user.
7. `python manage.py test` passes.

**Frontend (if the endpoint is used by the UI)**
8. Add a named function in `frontend/src/api/client.js`. Never call `fetch()` elsewhere.
9. Page: `pages/<area>/<Name>Page.jsx` → path in `routes.js` → `<Route>` in `App.jsx` inside `<ProtectedRoute>` → link with `ROUTES.x`.
10. ⚠ Loading, empty and error states. Build forms from `<TextField label hint errors={err.fields.<field>}>` and
    `<Button>`; use `<FieldError>` only for errors not tied to one field.
11. ⚠ Use the tokens in `styles/index.css`: no raw hex (white is `--color-white`), radii or font sizes, and no
    `calc()`-made sizes. Follow the accessible pairings from AGENTS.md.
12. `npm run build` passes.
