# Plan: project-setup

**Spec**: .planning/specs/project-setup.md
**Epic**: pwa-core (Feature 1)
**Created**: 2026-11-02
**Status**: done

---

## Stack (detected: none — new project; chosen in spec)

Vite 8 + TypeScript 7 (strict) + Vitest 5 + vite-plugin-pwa 2 (Workbox). All four checked compatible (peer ranges include Vite 8) on 2026-11-02. Exact versions pinned in `package-lock.json`. Node 22, npm.

---

## Architecture

```
src/core/  pure TS, no DOM  ──►  src/ui/  DOM only  ──►  src/main.ts (entry)
                                                         └─ registers service worker (vite-plugin-pwa)
```
Rule: `ui` may import `core`; `core` never imports `ui` or touches browser globals (enforced by a test).

### Components

| Component | Type | Purpose |
|-----------|------|---------|
| `evaluate` (placeholder) | core function | `1 + 1` wiring proof; replaced by the real engine in Feature 2 |
| `renderApp` | ui function | Draws placeholder screen (title, tagline, core result) |
| `showUpdateBar` | ui function | "Update available — Reload" bar driven by the PWA `onNeedRefresh` hook |
| core boundary test | test | Fails if `src/core/**` uses `document`/`window`/`navigator`/`localStorage` |
| PWA config | build config | Manifest, icons, Workbox precache, `registerType: 'prompt'`, dev SW off |
| CI/CD workflow | GitHub Actions | typecheck → test → build → deploy Pages (deploy only on `main`) |

### New files

| File | Location | Purpose |
|------|----------|---------|
| `package.json` | `/` | scripts: dev, build, preview, test, typecheck |
| `tsconfig.json` | `/` | strict; `lib` includes DOM (ui needs it — boundary is enforced by test instead) |
| `vite.config.ts` | `/` | `base: '/stepcalc/'`, PWA plugin, Vitest config |
| `index.html` | `/` | entry HTML, theme-color meta, `#app` root |
| `.gitignore` | `/` | add `node_modules`, `dist` (file already exists from toolkit — append) |
| `src/core/evaluate.ts` | `src/core/` | placeholder `evaluate('1 + 1') → '2'` (only `a + b` of integers) |
| `src/core/evaluate.test.ts` | `src/core/` | wiring test |
| `src/core/boundary.test.ts` | `src/core/` | scans core files for browser globals |
| `src/ui/app.ts` | `src/ui/` | `renderApp(root)` |
| `src/ui/update-bar.ts` | `src/ui/` | `showUpdateBar(onReload)` |
| `src/ui/style.css` | `src/ui/` | dark tokens, phone-width safe |
| `src/main.ts` | `src/` | render + `registerSW({ onNeedRefresh })` |
| `src/vite-env.d.ts` | `src/` | types for `virtual:pwa-register` |
| `public/icon.svg` | `public/` | source icon |
| `public/icon-192.png`, `icon-512.png`, `icon-maskable-512.png` | `public/` | generated once from SVG with `rsvg-convert` (committed; no icon-generator dependency) |
| `.github/workflows/deploy.yml` | `.github/workflows/` | CI + Pages deploy |
| `README.md` | `/` | name, tagline, live link, commands |
| `LICENSE` | `/` | MIT, © 2026 Gaikwad-Prashik-05 |

### Files to change

| File | What changes | Why |
|------|-------------|-----|
| `.gitignore` | append `node_modules/`, `dist/` | it starts empty |
| `.planning/epics/pwa-core.md` | Feature 1 status → planned / building / done | epic tracking |

---

## Tasks

### Phase 1: Skeleton (sequential)

| # | Task | Files | Test |
|---|------|-------|------|
| 1 | `npm init`, install vite/typescript/vitest/vite-plugin-pwa as devDeps, scripts, strict tsconfig, gitignore | `package.json`, `tsconfig.json`, `.gitignore` | `npx tsc --noEmit` runs |
| 2 | TDD: write `evaluate.test.ts` (red) → `evaluate.ts` (green) | `src/core/evaluate.ts`, `src/core/evaluate.test.ts` | `npm test` green |
| 3 | TDD: boundary test; prove it fails with a temporary `document` line, then remove | `src/core/boundary.test.ts` | red → green |

### Phase 2: UI + PWA (depends on Phase 1)

| # | Task | Files | Test |
|---|------|-------|------|
| 4 | Entry HTML, placeholder screen, dark CSS | `index.html`, `src/ui/app.ts`, `src/ui/style.css` | `npm run dev` shows title, tagline, `1 + 1 = 2`; no h-scroll at 360 px |
| 5 | Icons: draw `icon.svg`, generate 3 PNGs with `rsvg-convert` | `public/icon*.{svg,png}` | files exist, correct sizes (`magick identify`) |
| 6 | PWA config + SW registration + update bar | `vite.config.ts`, `src/main.ts`, `src/ui/update-bar.ts` (+ `vite-env.d.ts`) | `npm run build` emits `manifest.webmanifest` + `sw.js`; `npm run preview` → installable, works offline |

### Phase 3: Ship (depends on Phase 2)

| # | Task | Files | Test |
|---|------|-------|------|
| 7 | README + MIT licence | `README.md`, `LICENSE` | — |
| 8 | GitHub Actions: PR = typecheck+test+build; main = + deploy Pages | `.github/workflows/deploy.yml` | workflow passes on first push |
| 9 | **Ask user first** → `gh repo create Gaikwad-Prashik-05/stepcalc --public`, enable Pages (source: Actions), push `main` | — | Actions green; live URL loads at `/stepcalc/` |
| 10 | Verify live: install, offline reload, deploy a 2nd build → update bar | — | spec edge cases 1, 2, 3 |

### Parallel vs sequential

| Parallel group | Tasks | Why |
|---|---|---|
| A | 2, 3 | independent core files |
| B | 4, 5 | UI and icons don't touch each other |
| C | 7, 8 | docs and CI independent |

| Sequential | Depends on | Why |
|---|---|---|
| 2, 3 | 1 | need tooling |
| 6 | 4, 5 | registers SW for the UI, manifest references icons |
| 9 | 1–8 | push only a green build |
| 10 | 9 | needs live site |

Single developer: tasks run in order 1→10; groups just show what's safe to reorder.

---

## Testing Plan

| Spec item | Test | Kind |
|---|---|---|
| core → ui wiring | `evaluate('1 + 1') === '2'` | unit (task 2) |
| Core has no browser code (edge 5) | boundary test; temporarily break it to see red | unit (task 3) |
| Build emits PWA files | check `dist/manifest.webmanifest`, `dist/sw.js` exist after build | build check (task 6) |
| Sub-path works (edge 2) | `npm run preview` serves under `/stepcalc/`; live URL with and without `index.html` | manual + live (tasks 6, 10) |
| Offline after first load / first visit offline (edge 3) | Obscura or DevTools offline toggle on preview build | manual (tasks 6, 10) |
| Stale cache → update bar (edge 1) | deploy 2nd build while page open | live (task 10) |
| Failing tests block deploy (edge 4) | workflow `deploy` job `needs: build` which runs tests; verify by reading job graph on first run | CI (task 8) |
| No SW in dev (edge 6) | `devOptions.enabled: false`; dev page has no SW registered | manual (task 6) |
| Phone width | 360 px viewport, no horizontal scroll | manual (task 4) |

Data layer / API tests: not applicable (static site, no storage, no backend).

---

## Gate 2

**Architecture**
- [x] Follows the agreed `core` / `ui` split (no existing codebase to match)
- [x] ui → core only; core calls nothing below it
- [x] Every file has a directory and purpose

**Task breakdown**
- [x] All new and changed files listed
- [x] Each task ≤ 3 source files, one commit (task 5's PNGs are generated outputs of one SVG)
- [x] Dependencies explicit; parallel/sequential marked

**Testing**
- [x] Data layer / API: N/A, stated why
- [x] Business logic: wiring + boundary tests
- [x] UI: placeholder render + phone width + update bar
- [x] All 6 spec edge cases mapped to a test

---

## Risks

- TypeScript 7 is the new native compiler; if `tsc --noEmit` misbehaves with Vite types, pin TypeScript 5.x (one-line change).
- GitHub Pages needs the repo public (accepted in spec) and "Source: GitHub Actions" set — done via `gh api` in task 9.
