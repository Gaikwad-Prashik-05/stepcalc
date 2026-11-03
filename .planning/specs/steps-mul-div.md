# Spec: steps-mul-div

**Created**: 2026-11-04
**Status**: approved (2026-11-04)
**Author**: Prashik Gaikwad
**Epic**: pwa-core (Feature 5)

---

## Goal

Long multiplication and long division working, in the same paper style + Notes switch as Feature 4.

## Decisions

| Topic | Decision |
|---|---|
| Which sums | Exactly two plain non-negative numbers joined by `×`/`*` or `÷`/`/` |
| One-digit multiplier | Column by column with carries above, one note per column |
| Longer multiplier | One partial row per digit (placeholder zeros written), last row marked `+`, then the total. Max 6 multiplier digits |
| Decimals (×) | Multiply as whole numbers, then put the point back (`= 3.00` line + note) |
| Division layout | Quotient on top, divisor left of the bracket, subtract rows going down |
| Leading digits | Take more digits until the divisor fits (60 ÷ 4 starts with 6, 15 ÷ 4 with 15); no leading quotient zeros except the ones digit |
| Decimal divisor | Multiply both by 10ⁿ first (7.5 ÷ 0.25 → 750 ÷ 25), with a note |
| Non-terminating | Bring down zeros past the point; stop when a remainder repeats ("digits 3 repeat forever") or after 6 decimal places |
| Rendering | Shared `GridWork` model (`src/core/steps-grid.ts`) for all four operations; `stepsFor(expression)` picks the right one |
| Safety | Answer checked against the engine (truncated when cut off); mismatch → no working |

## Done when

- 480 ÷ 4 and 60 ÷ 4 show the paper layout with answers 120 and 15.
- 2000 random multiplications/divisions produce working that matches the engine.
