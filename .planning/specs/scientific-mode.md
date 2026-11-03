# Spec: scientific-mode

**Created**: 2026-11-03
**Status**: done (live 2026-11-03)
**Author**: Prashik Gaikwad
**Epic**: scientific-draw (Feature 7)

---

## Goal

A Scientific mode with fx-style functions that match a Casio on a reference table (DEG and RAD), on the same display, history and Steps as Basic.

## Decisions

| Topic | Decision |
|---|---|
| Engine | `calculate(expression, ans, { angle, vars })` in `src/core/engine.ts`; functions in `src/core/functions.ts`, exact BigNumber maths (64 digits), factorial / nCr / nPr in exact integers |
| Functions | sin cos tan, sin⁻¹ cos⁻¹ tan⁻¹, log (base 10), ln, 10ˣ, eˣ, x², xʸ, √, ∛, ⁿ√(x, n), x!, nCr(n, r), nPr(n, r), abs, π, e, brackets, ± |
| Errors | √−1, log 0, tan 90°, 2.5!, nCr(2, 5) → "Math error"; unknown words still "Invalid format" |
| Keys | Scientific mode adds a 6-column function block (4 rows) above the Basic keypad; function keys insert `sin(` etc. with the caret inside; a `,` key for two-argument functions |
| ± | Flips the sign of the number at the caret: `12` → `(−12)` → `12` |
| DEG/RAD | Toggle in the function block, default DEG (Casio default), remembered (`stepcalc.angle.v1`) |
| ENG | Toggle on the result: engineering notation, exponent a multiple of 3 (`1,500` → `1.5×10³`) |
| S⇔D | Toggle on the result: show as a fraction when the answer is one (`1 ÷ 3 × 2` → `2/3`), denominator up to 10,000 |
| Mode menu | Scientific enabled; chosen mode remembered (`stepcalc.mode.v1`); Conversion / Draw stay "(soon)" until their features |
| History | Trig expressions worked in RAD are saved with a ` [RAD]` tag so the result is not misread later |
| Steps | Function calls become steps (`= 2 × 0.5 + 1   (sin(30) = 0.5)`); π and e are shown substituted; names print the way they were typed (`5!`, `sin⁻¹`, `√`) |

## Done when

- The reference table in `src/core/scientific.test.ts` passes (DEG + RAD, logs, roots, factorial, nCr/nPr).
- Basic mode behaves exactly as before (all earlier tests unchanged).
- Scientific keypad fits a 375 × 667 screen with no sideways scroll.
