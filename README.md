# SoftTrack Mobile

The iOS & Android companion app for [SoftTrack](https://github.com/soft-track/soft-track) — a self-hostable issue tracker.

## What this is

A mobile client that mirrors the full SoftTrack web feature set — boards, issues, cycles, reports, notifications, search, and administration — talking to the existing FastAPI backend of any SoftTrack instance. Sign-in takes three inputs: the **server link** (your instance URL), **email**, and **password**.

> The design mockups and some issue text say "username". The API only ever resolves the OAuth2 `username` field against the email column (`backend/lib_identity/identity.py`), so the app asks for an email. Adding a username lookup would be a backend change.

## Running it

You need a SoftTrack instance to point the app at. The quickest one is the reference stack:

```bash
cd ../soft-track && docker compose up --build
```

That serves the API on `:8000` with a seeded demo account (`demo@softtrack.dev` / `password123`).

Then start the app:

```bash
npm install && npx expo start
```

Open it in [Expo Go](https://expo.dev/go). At the login screen enter your machine's **LAN address** as the server link — `http://192.168.x.x:8000`, not `localhost`, which on a phone means the phone.

## Layout

```
src/app/            expo-router routes — thin wrappers, no logic
  (auth)/login      signed out
  (app)/            signed in: Home, Board, Search, Inbox, You
src/api/            HTTP client, instance URL, generated client
src/auth/           session store and auth context
src/ui/             design tokens, theme, primitives, navigation chrome
openapi/            the vendored API contract codegen reads
```

`src/` mirrors the web app's `frontend/src/` naming wherever the concept is the same, so moving between the two repos is uneventful.

### The API client is generated

`src/api/generated/` is [Orval](https://orval.dev) output — typed React Query hooks — built from `openapi/openapi.json`, a vendored copy of the schema the backend produces. Same config as the web app, so hook names match in both clients. Never edit it by hand:

```bash
npm run sync:openapi     # refresh the vendored schema
npm run generate:api     # regenerate the client
```

CI fails if the committed client does not match the committed schema, and a weekly job flags when the vendored schema falls behind the backend.

### Theming

Tokens in `src/ui/tokens.ts` are transcribed from the web's `frontend/src/index.css`. Note the neutral ramp is *inverted* in dark mode, so the two palettes are built explicitly rather than derived. The stored key (`softtrack.theme`) and its contract — absent means "follow the system" — match the web exactly.

## Checks

```bash
npm run lint && npm run typecheck && npm test
```

The API integration suite is opt-in because it needs a live server:

```bash
SOFTTRACK_LIVE_URL=http://localhost:8000 npm test
```

## Planning

- Work is tracked on the [Mobile App project](https://github.com/orgs/soft-track/projects/3).
- Design mockups live in [`docs/design/mobile/`](docs/design/mobile/) — one SVG per feature issue, each showing the screen at three window size classes:
  - **Phone** — compact, <600dp: single pane, bottom navigation
  - **Foldable (unfolded)** — medium, 600–839dp: two panes split at the hinge
  - **Tablet** — expanded, ≥840dp: nav rail with persistent multi-panel layouts

The mockups reuse the web app's design tokens (brand `#6342db`, tinted neutrals, status/priority colors) from `frontend/src/index.css` in the main repo, so mobile and web share one visual language.

## Status

The foundation is in: navigation shell, theming, the authenticated API client, and a working sign-in against any instance. Every other screen is a placeholder pointing at its issue.

Known gaps, tracked rather than hidden:

- **Only the phone layout has been seen on a device.** The medium and expanded layouts are covered by tests against the mockup geometry, but verifying them for real needs a tablet or an Android emulator.
- **No aurora or glass blur yet.** The web's translucent panels are approximated with opaque surfaces; `backdrop-filter` has no React Native equivalent and per-surface blur is expensive on Android.
- **Team rows show no member counts.** `TeamRead` does not carry them, and fetching them today would mean one request per row.
