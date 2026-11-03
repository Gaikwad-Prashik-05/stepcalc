# Epic: scientific-draw

**Created**: 2026-11-02
**Status**: in progress
**Owner**: Prashik Gaikwad

---

## Why

Turn the calculator into an engineering tool (fx-style scientific functions, unit conversion) and add offline, lightweight handwriting input: draw an expression like 2x − log(xⁿ) and get the answer.

---

## Success Criteria

- [ ] Scientific functions match a Casio fx-style engineering calculator on a test table of values (DEG and RAD)
- [ ] Letters in an expression prompt value boxes (all required); an expression with "=" is solved for the one remaining unknown
- [ ] Drawing works fully offline; the recogniser adds less than ~200 KB to the app
- [ ] Recognised expression is always shown ("Read as") and any symbol can be corrected by tapping it

---

## Features

| # | Feature | Status | Spec | Plan | Depends On |
|---|---------|--------|------|------|------------|
| 7 | scientific-mode | built, committed locally (6465a5a) | specs/scientific-mode.md | — | pwa-core |
| 8 | variables-solver | built, committed locally (89d66cb) | specs/variables-solver.md | — | #7 |
| 9 | conversion-mode | built, committed locally (89d66cb) | specs/conversion-mode.md | — | pwa-core |
| 10 | draw-recognizer | built, not committed | specs/draw-recognizer.md | — | #7 |
| 11 | draw-layout | built, not committed | specs/draw-layout.md | — | #8, #10 |

---

## Feature Briefs

### Feature 7: scientific-mode
sin/cos/tan + inverses, DEG/RAD, log (base 10) / ln, powers, roots, fractions, nCr/nPr, factorial, ENG notation, constants, brackets, ±.

### Feature 8: variables-solver
Option A (decided 2026-11-02): letters get value boxes, all required, substitution shown as the first step. With "=", numeric solve for the single remaining unknown.

### Feature 9: conversion-mode
Length, mass, temperature, area, volume, data, time, speed via mathjs units. Currency deferred (needs online rates, cached for offline).

### Feature 10: draw-recognizer
Canvas with pointer/stylus input, stroke grouping into symbols, $P point-cloud recogniser behind a swappable interface, "teach my handwriting" screen storing the user's samples on device.

### Feature 11: draw-layout
Geometry-based parsing: superscripts (powers), fraction bars, √ extent, function names (sin/log/ln). "Read as" preview with tap-to-cycle alternatives (x ↔ × ↔ +), then evaluate via #8.

---

## Risks

- Handwriting accuracy, especially layout (#11 is the hardest feature)
- x vs × ambiguity (mitigated by "Read as" + tap-to-fix)
- Solver failing to converge or finding multiple roots

## Notes

- Upgrade path: replace $P with a self-trained small model (epic `native`, #14).
