# Spec: steps-bodmas-toggle

**Created**: 2026-11-04
**Status**: approved (2026-11-04)
**Author**: Prashik Gaikwad
**Epic**: pwa-core (Feature 6)

---

## Goal

Mixed expressions are worked one operation at a time in BODMAS order, each operation opening into its column / long-division working; a master Steps switch turns all working on or off.

## Decisions

| Topic | Decision |
|---|---|
| Order | Deepest brackets first, then `^`, then `×` `÷`, then `+` `−`; left to right within a level (so `2 + 3 + 4 × 5` does `4 × 5` first) |
| Display | Start line, then `= <expression after this step>  (a op b = c)` per step; negative values shown in brackets `1 − (−3)` |
| Expand | Steps with + − × ÷ on plain numbers open (`<details>`) into the Feature 4/5 working; powers and rounded values (e.g. after `1 ÷ 3`) have no expansion |
| Single operation | Goes straight to its column working (as before) |
| Ans | Replaced by its value, so `Ans × 2` gets working too |
| % | No working yet (mathjs rewrites `%` into a different tree) |
| Steps switch | In the header next to the mode menu, default on, remembered (`stepcalc.steps.v1`) |
| Safety | Final value must equal the engine's exact answer, otherwise no working; max 25 steps |
| Code | `workingFor(expression, ans)` in `src/core/breakdown.ts` |

## Done when

- `5 + 3 × 2` → `= 5 + 6` → `= 11`, both steps expandable.
- 1000 random mixed expressions produce a breakdown that matches the engine.
- Steps off hides the card and stays off after reload; page fits 375px with no sideways scroll.
