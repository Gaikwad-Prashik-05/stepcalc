# Epic: pwa-core

**Created**: 2026-11-02
**Status**: planning
**Owner**: Prashik Gaikwad

---

## Why

A calculator the user drives daily on phone (Android) and laptop (CachyOS), whose standout feature is a Steps toggle that shows school-method working (carries, borrows, long multiplication, long division) instead of only the answer. Shipped as an offline PWA on GitHub Pages so the repo has a live demo; native wrappers come in epic `native`.

---

## Success Criteria

- [ ] App installs as a PWA on Android and Linux and works with no internet after first load
- [ ] Basic arithmetic is exact (0.1 + 0.2 = 0.3) and usable fully from the keyboard
- [ ] With Steps ON, 60 ÷ 4, 480 ÷ 4 and 37270 − 11359 show correct school-method working matching the user's paper sample
- [ ] Every push to main deploys to GitHub Pages with tests passing

---

## Architecture rule

All math, steps and recognition logic lives in `src/core/` (pure TypeScript, no DOM). UI is a thin layer. This keeps epic `native` (Capacitor/Tauri) a wrapper, not a rewrite.

---

## Features

| # | Feature | Status | Spec | Plan | Depends On |
|---|---------|--------|------|------|------------|
| 1 | project-setup | done | [spec](../specs/project-setup.md) | [plan](../plans/project-setup.md) | — |
| 2 | calc-engine | planned | [spec](../specs/calc-engine.md) | [plan](../plans/calc-engine.md) | #1 |
| 3 | basic-mode-ui | todo | — | — | #2 |
| 4 | steps-add-sub | todo | — | — | #2 |
| 5 | steps-mul-div | todo | — | — | #4 |
| 6 | steps-bodmas-toggle | todo | — | — | #3, #5 |

---

## Feature Briefs

### Feature 1: project-setup
Vite + TypeScript skeleton, PWA manifest + service worker for offline use and install, Vitest, GitHub Actions deploying to GitHub Pages. Establishes the `src/core` vs `src/ui` split.

### Feature 2: calc-engine
mathjs with BigNumber for exact decimals; evaluate expressions, Ans, error results; history persisted on device.

### Feature 3: basic-mode-ui
Corrected keypad (AC ⌫ % ÷ / 7 8 9 × / 4 5 6 − / 1 2 3 + / Ans 0 . =), dark theme like the user's phone calculator, keyboard input, history panel, mode dropdown (Basic only active for now).

### Feature 4: steps-add-sub
Column addition with carries and column subtraction with borrows, including decimals and negative results. Steps generated from the numbers, verified against the engine's answer.

### Feature 5: steps-mul-div
Long multiplication and long division (remainders and decimal expansion, with a limit for repeating decimals).

### Feature 6: steps-bodmas-toggle
Order-of-operations breakdown for mixed expressions, each sub-step expandable into 4/5 working; Steps on/off toggle wired into the UI.

---

## Risks

- Steps for decimals/remainders being subtly wrong (mitigation: property tests against the engine)
- Service-worker caching serving stale builds (mitigation: versioned cache + update prompt)

## Notes

- Correction from user's paper sample: "60 ÷ 4" was worked as 240 ÷ 4; correct answer is 15.
