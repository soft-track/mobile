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
  (auth)/           signed out: login, register
  (app)/            signed in: Home, Board, Search, Inbox, You
  invite/[token]    an invitation — readable either way, so guarded by neither
  [teamKey]         /ENG — sets the active team, then hands to Board
src/api/            HTTP client, instance URL, generated client
src/auth/           session store, auth context, deep-link capture
src/team/           team context, switcher, creation, invitations
src/board/          board and list views, filters, drag-to-move
src/issues/         priority and status metadata
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

Two integration suites are opt-in because they need a live server. They drive
the real client modules against it, and the onboarding one writes real rows
(fresh accounts and team keys per run):

```bash
SOFTTRACK_LIVE_URL=http://localhost:8000 npm test
```

Registration is throttled per IP and charged even on success, so running the
onboarding suite repeatedly will eventually 429. The counter lives in the API
process, so `docker compose restart backend` clears it without touching the
database.

Note `experiments.typedRoutes` is a dev-time aid: the route union is written by
`expo start`, not by `expo export`, so outside the dev server every path
typechecks permissively. Paths built at runtime go through `href()` in
`src/ui/href.ts` rather than being cast at each call site.

## Planning

- Work is tracked on the [Mobile App project](https://github.com/orgs/soft-track/projects/3).
- Design mockups live in [`docs/design/mobile/`](docs/design/mobile/) — one SVG per feature issue, each showing the screen at three window size classes:
  - **Phone** — compact, <600dp: single pane, bottom navigation
  - **Foldable (unfolded)** — medium, 600–839dp: two panes split at the hinge
  - **Tablet** — expanded, ≥840dp: nav rail with persistent multi-panel layouts

The mockups reuse the web app's design tokens (brand `#6342db`, tinted neutrals, status/priority colors) from `frontend/src/index.css` in the main repo, so mobile and web share one visual language.

## Status

Onboarding works end to end: sign in to any instance, register, accept an
invitation, create and switch teams, and work a team's board -- columns from the
team's own statuses, six server-side filters held in the URL, board and list
views, and drag or tap to move a card. Search and Inbox are placeholders
pointing at their issues.

Known gaps, tracked rather than hidden:

- **Nothing has been seen on a device yet.** The suites cover the logic, the
  mockup geometry and that the trees render, but no one has run this on
  hardware. The drag gesture in particular is unverified by touch, which is why
  every move is also reachable by tapping a card. The medium and expanded
  layouts would need a tablet or an Android emulator to check for real.
- **Invitation links cannot be true universal links.** A `https://your-instance/invite/…`
  link can only open the app if that exact domain is declared in the build, which
  is impossible for arbitrary self-hosted hosts. `softtrack://invite/<token>`
  works, and falls back to asking you to sign in first, since a custom-scheme
  link carries no instance.
- **Member counts cost one request per team.** `TeamRead` carries no count, so
  the teams list asks each team for its members. A `member_count` field upstream
  would remove the fan-out and help the web too.
- **No aurora or glass blur yet.** The web's translucent panels are approximated
  with opaque surfaces; `backdrop-filter` has no React Native equivalent and
  per-surface blur is expensive on Android.
