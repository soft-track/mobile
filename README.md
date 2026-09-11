# SoftTrack Mobile

The iOS & Android companion app for [SoftTrack](https://github.com/soft-track/soft-track) — a self-hostable issue tracker.

## What this is

A mobile client that mirrors the full SoftTrack web feature set — boards, issues, cycles, reports, notifications, search, and administration — talking to the existing FastAPI backend of any SoftTrack instance. Sign-in takes three inputs: the **server link** (your instance URL), **username**, and **password**.

## Planning

- Work is tracked on the [Mobile App project](https://github.com/orgs/soft-track/projects/3).
- Design mockups live in [`docs/design/mobile/`](docs/design/mobile/) — one SVG per feature issue, each showing the screen at three window size classes:
  - **Phone** — compact, <600dp: single pane, bottom navigation
  - **Foldable (unfolded)** — medium, 600–839dp: two panes split at the hinge
  - **Tablet** — expanded, ≥840dp: nav rail with persistent multi-panel layouts

The mockups reuse the web app's design tokens (brand `#6342db`, tinted neutrals, status/priority colors) from `frontend/src/index.css` in the main repo, so mobile and web share one visual language.

## Status

Pre-implementation. The app scaffold (framework choice, navigation shell, theming, API client) is the first issue in the tracker.
