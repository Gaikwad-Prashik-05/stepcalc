# Spec: conversion-mode

**Created**: 2026-11-03
**Status**: done (live 2026-11-03)
**Author**: Prashik Gaikwad
**Epic**: scientific-draw (Feature 9)

---

## Goal

A Conversion mode for length, mass, temperature, area, volume, data, time and speed, offline, with the working shown.

## Decisions

| Topic | Decision |
|---|---|
| Units engine | Own table in `src/core/units.ts` with exact decimal factors (BigNumber), not mathjs units: a few KB instead of tens, and exact (1 in = 2.54 cm exactly) |
| Categories | Length, Mass, Temperature, Area, Volume, Data, Time, Speed. Currency deferred (needs online rates) |
| Input | The value is the expression on the display, so `5 + 2.5` km works; Basic keypad |
| Layout | Category menu, then From unit ⇄ To unit with a swap button, between the display and the keypad |
| Result | `= 5,000 m`; recomputed live when units change; Ans = the converted value |
| Steps | Linear: `5 km = 5 × 1,000 m` (1 km = 1,000 m) then the multiplication with its column working when the numbers are short; temperature shows its formula (`°F = °C × 9/5 + 32`) |
| Data | Both decimal (kB, MB, GB, TB) and binary (KiB, MiB, GiB, TiB), plus bits |
| Remembered | Category and the two units per category (`stepcalc.units.v1`) |

## Done when

- Unit tests cover every category, both directions, temperature formulas and exactness (1 mi = 1,609.344 m).
- Fits 375 × 667 with no sideways scroll.
