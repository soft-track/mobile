/**
 * SoftTrack design tokens, transcribed from the web app's `frontend/src/index.css`.
 *
 * The web declares the light ramp in `@theme` and redefines a *subset* of it under
 * `:root[data-theme="dark"]`. Two things follow that matter here:
 *
 *   1. The neutral ramp is INVERTED in dark mode -- `neutral[50]` is the lightest
 *      tone in light and the darkest in dark. A single palette cannot express that,
 *      so `dark` spreads `light` and overrides exactly what the CSS overrides.
 *   2. Anything the dark block leaves alone (brand 200-900, the accents, most
 *      status/priority colours, the radii) deliberately keeps its light value.
 *
 * Keep this file in sync with `index.css` by hand; there is no shared build step
 * between the two repos.
 */

/**
 * `color-mix(in oklab, X n%, transparent)` -- which the web uses for every
 * hairline, well, scrim and ring -- is just X at alpha n. Premultiplied
 * interpolation against a fully transparent colour leaves the channels alone and
 * scales only alpha, so no colour-space maths is needed to reproduce it.
 */
function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export type Ramp = {
  50: string; 100: string; 200: string; 300: string; 400: string;
  500: string; 600: string; 700: string; 800: string; 900: string;
};

export type Tokens = {
  /** App background. The aurora is painted on top of this. */
  canvas: string;
  auroraOpacity: number;
  brand: Ramp;
  accent: { sky: string; pink: string; mint: string; amber: string };
  neutral: Ramp;
  status: {
    backlog: string; todo: string; progress: string;
    review: string; done: string; cancelled: string;
  };
  priority: {
    urgent: string; high: string; medium: string; low: string; none: string;
  };
  danger: { 50: string; 500: string; 600: string; 700: string };
  /** Translucent panel fills -- the "glass" layer. */
  surface: {
    fill: string; strong: string; subtle: string; card: string; menu: string;
    border: string; edge: string; highlight: string;
  };
  /** Derived hairlines, wells and rings (the `color-mix` values). */
  line: {
    hairline: string; well: string; wellBorder: string;
    field: string; fieldFocus: string; focusRing: string;
    ghost: string; navActive: string; ring: string; scrim: string;
  };
  shadow: { ink: string; drop: string; brand: string };
  radius: { control: number; card: number; panel: number; pill: number };
};

const brand: Ramp = {
  50: '#f3f1ff', 100: '#e8e4ff', 200: '#d3ccff', 300: '#b4a6ff', 400: '#937bff',
  500: '#7a5cf5', 600: '#6342db', 700: '#5433bd', 800: '#462c9a', 900: '#3b277b',
};

const accent = {
  sky: '#4f8cff', pink: '#ff6fae', mint: '#2fd4a7', amber: '#ffb648',
};

const lightNeutral: Ramp = {
  50: '#f7f6fb', 100: '#eeedf5', 200: '#dedcea', 300: '#b6b3c8', 400: '#7a7791',
  500: '#66637c', 600: '#514e66', 700: '#3b3850', 800: '#26243a', 900: '#15131f',
};

const darkNeutral: Ramp = {
  50: '#1b1a27', 100: '#262433', 200: '#363448', 300: '#5b586f', 400: '#9491aa',
  500: '#aaa7bd', 600: '#c3c0d2', 700: '#d9d7e5', 800: '#ebeaf3', 900: '#f6f5fb',
};

/** The `color-mix` derivations, resolved against whichever neutral ramp applies. */
function derivedLines(neutral: Ramp, scrim: string): Tokens['line'] {
  return {
    hairline: alpha(neutral[900], 0.09),
    well: alpha(neutral[900], 0.04),
    wellBorder: alpha(neutral[900], 0.06),
    field: alpha(neutral[900], 0.12),
    fieldFocus: alpha(brand[500], 0.6),
    focusRing: alpha(brand[500], 0.18),
    ghost: alpha(neutral[900], 0.06),
    navActive: alpha(brand[500], 0.14),
    ring: alpha(brand[500], 0.45),
    scrim,
  };
}

export const light: Tokens = {
  canvas: '#eef0f8',
  auroraOpacity: 1,
  brand,
  accent,
  neutral: lightNeutral,
  status: {
    backlog: '#9b98b0', todo: '#6f6c86', progress: '#f29d0b',
    review: '#8b5cf6', done: '#12a474', cancelled: '#f2647d',
  },
  priority: {
    urgent: '#e0424a', high: '#f2721c', medium: '#ef9d0b',
    low: '#3f82f6', none: '#a29fb5',
  },
  danger: { 50: '#fef2f3', 500: '#e0424a', 600: '#cf3038', 700: '#a81d24' },
  surface: {
    fill: 'rgba(255, 255, 255, 0.55)',
    strong: 'rgba(255, 255, 255, 0.78)',
    subtle: 'rgba(255, 255, 255, 0.34)',
    card: 'rgba(255, 255, 255, 0.82)',
    menu: '#fbfaff',
    border: 'rgba(255, 255, 255, 0.72)',
    edge: 'rgba(60, 50, 110, 0.10)',
    highlight: 'rgba(255, 255, 255, 0.95)',
  },
  line: derivedLines(lightNeutral, alpha(lightNeutral[900], 0.22)),
  shadow: {
    ink: 'rgba(20, 18, 40, 0.06)',
    drop: 'rgba(40, 30, 90, 0.22)',
    brand: alpha(brand[600], 0.8),
  },
  radius: { control: 10, card: 14, panel: 20, pill: 999 },
};

export const dark: Tokens = {
  ...light,
  canvas: '#0c0b15',
  auroraOpacity: 0.6,
  // Only brand 50/100 shift in dark; 200-900 keep their light values.
  brand: { ...brand, 50: '#221d3d', 100: '#2b2450' },
  neutral: darkNeutral,
  status: { ...light.status, backlog: '#6f6c86', todo: '#9b98b0' },
  priority: { ...light.priority, none: '#6f6c86' },
  danger: { ...light.danger, 50: '#3a1a1f', 700: '#ff8a92' },
  surface: {
    fill: 'rgba(28, 26, 44, 0.55)',
    strong: 'rgba(24, 22, 38, 0.82)',
    subtle: 'rgba(28, 26, 44, 0.36)',
    card: 'rgba(38, 35, 56, 0.86)',
    menu: '#191727',
    border: 'rgba(255, 255, 255, 0.10)',
    edge: 'rgba(0, 0, 0, 0.35)',
    highlight: 'rgba(255, 255, 255, 0.14)',
  },
  // Dark replaces the scrim wholesale rather than re-deriving it (index.css:614).
  line: derivedLines(darkNeutral, 'rgba(0, 0, 0, 0.5)'),
  shadow: {
    ink: 'rgba(0, 0, 0, 0.3)',
    drop: 'rgba(0, 0, 0, 0.55)',
    brand: alpha(brand[600], 0.8),
  },
};
