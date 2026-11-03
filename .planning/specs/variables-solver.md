# Spec: variables-solver

**Created**: 2026-11-03
**Status**: done (live 2026-11-03)
**Author**: Prashik Gaikwad
**Epic**: scientific-draw (Feature 8)

---

## Goal

Letters in an expression get value boxes (option A, decided 2026-11-02); an equation with "=" is solved numerically for the one letter left empty.

## Decisions

| Topic | Decision |
|---|---|
| Letters | Single a–z except e (the constant). Letters written together multiply: `at` = a×t, `2xy`, `x(2+1)`. A longer unknown word before a bracket stays an error (`sinh(1)`) |
| Value boxes | Appear under the display while the expression has letters, one per letter, in all modes; a box takes a number or an expression (`π/2`), worked out with the current DEG/RAD |
| No "=" | Every box required, else "Enter a value for every letter" and the first empty box is focused; Steps shows the substitution as the first step |
| With "=" | Exactly one box empty → solve for it, else "Leave exactly one letter empty to solve for it" |
| Solver | `solve()` in `src/core/solver.ts`: sign changes on a fixed grid (dense ±100, then out to ±1e15), bisection to 64 digits, poles rejected (\|f\| must be < 1e-20); exact-looking answers snapped (3.999…→4) |
| Several answers | Up to 4 shown: a complete list left to right (`x = -2 or 2`), otherwise nearest 0 first and "…" (more exist) |
| Keys | Scientific function block's last row becomes `( ) , abs x =`; the small `=` writes an equation, the big `=` works it out. Laptop: "=" key writes "=" when the expression has a letter, otherwise it works the answer out (as before) |
| Result / Ans | `x = 4`; Ans becomes the first answer listed |
| History | `2x + 3 = 11` → `x = 4`; with values: `2x + y (x = 3, y = 0.5)` |
| Known limits | Double roots without a sign change are only found when they sit on the grid (`(x−3)² = 0` works); far roots of periodic functions can be skipped; no school algebra steps for equations yet |

## Done when

- `src/core/solver.test.ts` passes (linear, quadratic, powers, logs, trig DEG/RAD, poles, errors).
- Value boxes appear/disappear as letters are typed and keep their values while editing.
