# StepCalc — Show my work

A calculator that doesn't just give the answer — it shows the working, the way you'd write it on paper.

**Live:** https://gaikwad-prashik-05.github.io/stepcalc/

> Early stage: the app shell is live and installable; the calculator itself is being built feature by feature (see [roadmap](.planning/epics/)).

## Planned

- **Steps toggle** — column addition with carries, subtraction with borrows, long multiplication, long division
- **Scientific mode** — engineering functions (trig, logs, powers, fractions, nCr/nPr, DEG/RAD, ENG)
- **Conversion mode** — length, mass, temperature, data and more
- **Draw mode** — handwrite an expression like `2x − log(xⁿ)` and get the answer, fully offline
- **Native apps** — Android/iOS (Capacitor) and Linux/Windows/macOS (Tauri) from the same code

## Install

Open the live link in Chrome/Edge/Brave (desktop or Android) and choose **Install app**. Works offline after the first visit.

## Develop

Requires Node 22.

```bash
npm install
npm run dev        # dev server (no service worker)
npm test           # unit tests (Vitest)
npm run build      # typecheck + production build to dist/
npm run preview    # serve dist/ at http://localhost:4173/stepcalc/ (service worker on — test offline here)
```

## Structure

```
src/core/   pure TypeScript logic — no browser APIs (enforced by a test), shared with future native apps
src/ui/     DOM rendering
src/main.ts entry + service worker registration
```

## License

MIT
