/**
 * The account `backend/seed.py` creates, and the only credentials this app is
 * ever allowed to put on screen.
 *
 * Whether it may be shown is not decided here: `/auth/config` reports
 * `demo_credentials`, which is true only where the seed actually ran with this
 * password. Copied from `frontend/src/auth/demo.ts` -- if one changes, both do.
 */
export const DEMO_EMAIL = 'demo@softtrack.dev';
export const DEMO_PASSWORD = 'password123';
