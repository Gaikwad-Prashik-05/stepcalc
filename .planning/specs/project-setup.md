# Spec: project-setup

**Created**: 2026-11-02
**Status**: approved
**Author**: Prashik Gaikwad
**Epic**: pwa-core (Feature 1)

---

## Problem

StepCalc has no codebase yet. Every later feature (engine, keypad, steps, draw) needs a shared skeleton that already builds, tests, works offline, installs on phone and laptop, and deploys a live demo, otherwise each feature would re-solve setup and the native port later would mean a rewrite.

---

## Goal

A blank-but-real StepCalc that:
- runs locally with one command (`npm run dev`)
- passes `npm test` and `npm run build`
- is live at `https://gaikwad-prashik-05.github.io/stepcalc/`, deployed automatically on every push to `main`
- can be installed from the browser on Android and Linux and opens with no internet after the first visit
- has the `src/core` (pure logic) / `src/ui` (DOM) split in place, enforced by a test

---

## User Stories

- As the daily user, I want to install StepCalc from the browser on my phone and laptop so that it opens like an app, even offline.
- As the developer, I want every push to `main` to run tests and deploy so that the live demo on my GitHub is always the latest working version.
- As a future me building the native apps, I want all logic in `src/core` with no browser code so that Capacitor/Tauri wrap the same code.

---

## Requirements

### Must Have
- **Name**: StepCalc. Tagline "Show my work". Manifest `name`: "StepCalc – Show my work", `short_name`: "StepCalc".
- **Stack**: Vite + TypeScript (strict), no UI framework. npm (already installed, Node 22).
- **Folders**: `src/core/` (pure TS, no DOM types), `src/ui/` (DOM), `src/main.ts` entry, `public/` icons.
- **Boundary check**: a test that fails if any file in `src/core/` uses `document`, `window`, `navigator` or `localStorage`.
- **PWA**: `vite-plugin-pwa` (Workbox) — web app manifest, precached app shell, works offline after first load, installable (192 px + 512 px + maskable icons, `display: standalone`, dark `theme_color`).
- **Update flow**: when a new version is deployed, show a small "Update available — Reload" bar instead of silently serving a stale build.
- **Placeholder screen**: dark page with "StepCalc" title and tagline, plus an `1 + 1 = 2` line computed by a `src/core` function (proves core → ui wiring). Real keypad comes in Feature 3.
- **Tests**: Vitest, `npm test`.
- **CI/CD**: GitHub Actions — on push to `main`: install, typecheck (`tsc --noEmit`), test, build, deploy to GitHub Pages. On pull requests: same minus deploy.
- **Base path**: Vite `base: '/stepcalc/'` so assets and service worker work under the Pages sub-path.
- **Repo**: public GitHub repo `Gaikwad-Prashik-05/stepcalc` (public needed for free Pages and the portfolio). README with name, tagline, live link, run/test commands. MIT licence.

### Nice to Have
- App icon designed to match the dark theme (simple, can be refined later).
- `npm run preview` documented for testing the offline build locally.

### Out of Scope
- Any calculator logic beyond the `1 + 1` wiring check (Feature 2).
- Keypad, history, themes, mode dropdown (Feature 3).
- ESLint/Prettier (TS strict + tests are enough for now; add if the codebase grows).
- Capacitor/Tauri (epic `native`).
- Custom domain, analytics, any network calls.

---

## Data Model

None. No storage in this feature.

## API Changes

None. Static site, no backend.

## UI Changes

One placeholder screen (see Must Have). Dark background, readable at phone width (no horizontal scroll at 360 px).

---

## Edge Cases

1. **Stale cache**: user has an old version cached → update bar appears; Reload loads the new build. Never stuck on an old version.
2. **Sub-path breakage**: on GitHub Pages the app lives at `/stepcalc/`, not `/` → icons, manifest, JS and the service worker must all resolve there (a classic blank-page bug).
3. **First visit offline**: nothing cached yet → browser's normal offline page; that is expected (only visits after the first work offline).
4. **Deploy with failing tests**: CI must stop before deploy; live site keeps the last good version.
5. **Core imports browser code**: boundary test fails the build.
6. **Service worker in dev**: disabled during `npm run dev` so development isn't fighting a cache.

---

## Testing Criteria

### Happy Path
- `npm test` passes: core `add(1, 1) === 2` style wiring test + boundary test.
- `npm run build` produces `dist/` with `manifest.webmanifest` and `sw.js`.
- After `npm run preview`, page loads; Lighthouse/Chrome DevTools shows it as installable.
- After first load, turning network off and reloading still shows the app.
- Push to `main` → Actions run green → live URL shows the page.

### Edge Cases
- Add `document` to a file in `src/core` → `npm test` fails (then revert).
- A deliberately failing test on a branch → PR check fails, nothing deploys.
- Open live URL directly at `/stepcalc/` and at `/stepcalc/index.html` → both load with icons.
- Deploy a second build → already-open page shows the update bar.

---

## Dependencies

- Node 22 + npm (installed), `gh` CLI logged in as Gaikwad-Prashik-05 (installed)
- npm packages: `vite`, `typescript`, `vitest`, `vite-plugin-pwa`
- GitHub Pages enabled on the repo with source "GitHub Actions"
- **Needs user OK at build time**: creating the public repo and pushing (outward-facing action)
