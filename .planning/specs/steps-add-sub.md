# Spec: steps-add-sub

**Created**: 2026-11-04
**Status**: approved (2026-11-04)
**Author**: Prashik Gaikwad
**Epic**: pwa-core (Feature 4)

---

## Goal

After `=`, plain addition and subtraction show school-method column working under the answer, like the user's notebook.

## Decisions

| Topic | Decision |
|---|---|
| Style | Paper-style columns always shown: carries as small digits above the next column; borrows shown by crossing out the top digit and writing its new value above. Under it, one short note per column ("Ones: 0 < 9, borrow → 10 − 9 = 1") |
| Notes toggle | "Notes" switch hides/shows the note lines; remembered on device (`stepcalc.notes.v1`), default on |
| Which sums | Two or more non-negative numbers all joined by `+`, or exactly two joined by `−`. Decimals line up on the point, the shorter fraction is padded with zeros. Mixed `+`/`−`, brackets, `Ans`, `%` → no working (Feature 6) |
| Bigger minus | `a − b` with `b > a`: work `b − a` and mark the answer negative, with a note saying so |
| Borrow across zeros | Zeros in between become 9; only the final value of each top digit is written above it |
| Width | Max 24 digit columns, otherwise no working (unreadable on a phone) |
| Safety | Column answer is compared with the engine's exact answer; on mismatch no working is shown |
| Code | Pure `columnWork(expression)` in `src/core/steps.ts`, rendered by `src/ui/steps-view.ts`. Steps master toggle comes in Feature 6 |

## Done when

- `37270 − 11359` shows marks 6 12 6 10 over 3 7 2 7 0, answer 25911.
- Random property test: thousands of random add/sub sums (with decimals) all produce working whose answer equals the engine's.
- Grid has an accessible label; notes are a real list; works at 375px.
