# Spec: draw-layout

**Created**: 2026-11-03
**Status**: done (live 2026-11-03)
**Author**: Prashik Gaikwad
**Epic**: scientific-draw (Feature 11)

---

## Goal

Turn strokes on the canvas into an expression the engine can work out, always shown as "Read as" with tap-to-fix.

## Decisions

| Topic | Decision |
|---|---|
| Grouping | Strokes overlapping horizontally form one symbol (+, =, ÷, i, 4); a stroke spanning several symbols is structure (fraction bar or √), not grouped |
| Fractions | A flat stroke with symbols above and below → `(top)/(bottom)` |
| √ | A stroke covering symbols below its top line → `√(inside)` |
| Powers | A smaller symbol whose bottom sits above the middle of the symbol before it → `^(…)`; several in a row stay in the power |
| Function names | Letters that can spell sin cos tan log ln (using each symbol's alternatives, so 5/s, 1/l/i, 0/o, 9/g, +/t count) become the function; the argument gets brackets if not written |
| x or × | An x-shape between two numbers reads as ×, otherwise as the letter x; tap cycles x → × → + |
| Read as | One button per symbol; tapping cycles its alternatives and re-reads the expression |
| Evaluate | "=" puts the expression on the display and works it out with Feature 8 (value boxes, solver) |

## Done when

- Tests read `2+3`, `x²`, `½` as a fraction, `√9`, `sin30`, `2x−1=5` from synthetic strokes.
- Drawing with a mouse in the browser shows the Read-as row and the right answer.
