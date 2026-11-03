# StepCalc — Show my work

A calculator that doesn't just give the answer — it shows the working, the way you'd write it on paper.

**Live:** https://gaikwad-prashik-05.github.io/stepcalc/

## Features

- **Steps** — school working for every answer: column addition with carries, subtraction with borrows, long multiplication, long division, and mixed sums worked one operation at a time in BODMAS order
- **Basic mode** — phone-style keypad, exact decimals, phone-style percent, `Ans`, history saved on your device
- **Scientific mode** — sin/cos/tan and inverses, log, ln, powers, roots, x!, nCr/nPr, π, e, DEG/RAD, ENG notation and fractions (S⇔D); functions show up as steps too
- **Letters and equations** — `2x + y` asks for x and y; `2x + 3 = 11` is solved for the letter left empty (`x = 4`, `x² = 4` → `x = -2 or 2`)
- **Conversion mode** — length, mass, temperature, area, volume, data, time and speed with exact factors, working shown
- **Draw mode** — handwrite an expression (powers, fractions, √, sin/log) and get the answer, fully offline; tap any symbol to fix it, and teach it your handwriting

## Planned

- **Native apps** — Android/iOS (Capacitor) and Linux/Windows/macOS (Tauri) from the same code (see [roadmap](.planning/epics/))

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
src/draw/   handwriting recogniser ($P point clouds) and layout reading — also pure TypeScript
src/ui/     DOM rendering and on-device storage
src/main.ts entry + service worker registration
```

## License

MIT
