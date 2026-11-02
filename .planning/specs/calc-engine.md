# Spec: calc-engine

**Created**: 2026-11-03
**Status**: approved
**Author**: Prashik Gaikwad
**Epic**: pwa-core (Feature 2)

---

## Problem

StepCalc can only add two integers (the Feature 1 placeholder). Every later feature — keypad, Steps, Scientific, Draw — needs one trustworthy engine that evaluates expressions exactly (no 0.1 + 0.2 = 0.30000000000000004), treats % the way a phone calculator does, gives friendly errors, remembers Ans, and keeps a history that survives closing the app.

---

## Goal

`src/core` exposes a pure engine: `calculate(expression, ans) → { ok, value, display } | { ok: false, error }` plus a pure history model. The UI layer persists history on the device. The placeholder screen gets a text box so the engine can be used and dogfooded before the keypad (Feature 3).

---

## User Stories

- As the daily user, I want 0.1 + 0.2 to show 0.3 and 550 ÷ 600 to show 0.916666666667 so that I can trust every answer.
- As the daily user, I want 50 + 10% to give 55 like my phone, so % works the way I expect.
- As the daily user, I want my past calculations listed by day (Today, 2026.11.02 …) and kept after I close the app, so I can look back and reuse them.
- As the developer, I want the engine in `src/core` with no browser code so the Steps, Draw and native features reuse it unchanged.

---

## Decisions

| Topic | Decision | Why |
|---|---|---|
| Engine | mathjs 15, **custom slim bundle** (`create()` with only needed functions), `number: 'BigNumber'`, `precision: 64` | Exact decimals; ~90 KB gz now, grows only as Scientific/Units need it |
| % key | Always **percent**, phone-style: `50+10%` = 55, `200×15%` = 30, `10%` = 0.1. A number right after `%` multiplies: `7%3` = 0.21 | Matches user's phone; mathjs alone treats `7%3` as remainder |
| Remainder | Not in Basic. Comes as `mod` in Scientific (Feature 7) | Keeps % unambiguous |
| Display | Round to **12 significant digits** (but never round away digits before the decimal point, so whole numbers stay exact below 1e15), trim trailing zeros; scientific notation (`1.5e+15`) when ≥ 1e15 or < 1e-9 (non-zero); thousands separators `11,720` | Between Casio (10) and the user's phone (13); readable on a phone screen |
| Exact value | Kept at full precision internally; Ans and chained calculations use the exact value, not the rounded display | Avoids rounding drift |
| Errors | `÷0` → "Can't divide by 0"; bad syntax → "Invalid format"; too large → "Number too large". Expression is kept so the user can fix it | Friendly, matches phone behaviour |
| Ans | Last successful result; `Ans` usable in expressions; starts at 0 | fx-style |
| Input forms | Accept `×` `÷` `−` as well as `*` `/` `-`; implicit multiplication `2(3)` = 6 | Keypad and keyboard both work |
| History | Newest first, max **200** entries (oldest dropped), grouped by date label "Today" / "YYYY.MM.DD" (like user's phone). Clear-all supported | Bounded storage |
| Persistence | `localStorage` key `stepcalc.history.v1`, JSON, read/write wrapped in try/catch; corrupted or missing data → empty history, never a crash | Works offline, survives restarts; versioned key allows later migration |

---

## Requirements

### Must Have
- `src/core/engine.ts`: `calculate(expression: string, ans: string): CalcResult` using the decisions above. Replaces `evaluate.ts` (placeholder deleted, its test replaced).
- `src/core/format.ts`: `formatNumber(exact: string): string` (12 sig digits, separators, exponent rules).
- `src/core/history.ts`: pure functions `addEntry`, `clearHistory`, `groupByDay(entries, now)`; entries `{ expression, result, exact, at }` with `at` as an ISO 8601 UTC string, grouped by the viewer's local day.
- `src/ui/history-store.ts`: `loadHistory()` / `saveHistory()` on `localStorage` with try/catch.
- Placeholder screen: one text input (Enter = calculate) showing result or error, Ans carried over, and the history list below it grouped by day, with a "Clear history" button.
- Core boundary test still passes (engine/format/history contain no browser code).

### Nice to Have
- Copy result on tap.

### Out of Scope
- Keypad, themes, mode dropdown (Feature 3).
- Steps toggle and step generation (Features 4–6).
- Scientific functions, units, variables, fractions (Epic 2).
- History search, export, sync between devices.

---

## Data Model

Browser `localStorage` only (no server).

| Key | Value |
|---|---|
| `stepcalc.history.v1` | JSON array of `{ "expression": string, "result": string, "exact": string, "at": "2026-11-03T10:30:00.000Z" }`, newest first, ≤ 200 items |

## API Changes

None (no backend).

## UI Changes

Placeholder screen gains: expression input, result/error line, grouped history list, Clear history button. Temporary until Feature 3's keypad; keeps dark theme, works at 360 px, input is keyboard-accessible with a visible label.

---

## Edge Cases

1. `0.1 + 0.2` → 0.3; `1/3*3` → 1 (BigNumber, not float).
2. `1/0`, `0/0`, `5/(2-2)` → "Can't divide by 0" (mathjs returns Infinity/NaN — must be mapped, not shown).
3. `7%3` → 0.21, `50+10%` → 55, `%` alone / `5+%` → "Invalid format".
4. Empty input or only spaces → no result, no history entry.
5. Very large/small: `1e30*1e30` → `1e+60`; `0.000000000123` → `1.23e-10`; `99999999999999` → `99,999,999,999,999`.
6. Negative and unary minus: `-5 - -3` → -2; `−5` (Unicode minus) accepted.
7. Unknown names (`foo+1`, `sin(1)` before Scientific) → "Invalid format", never a JS exception.
8. History over 200 → oldest dropped; corrupted JSON in storage → empty history, app still loads; storage blocked (private mode) → app works, history just isn't saved.
9. Day grouping across midnight and time zones: an entry at 23:59 local stays under that day.
10. Ans after an error stays the last *successful* result.

---

## Testing Criteria

### Happy Path
- Table-driven engine tests for every row of the Decisions table and edge cases 1, 3, 5, 6.
- `formatNumber` tests: rounding to 12 sig digits (`0.916666666666666…` → `0.916666666667`), separators, exponent thresholds, trailing zeros trimmed (`2.50` → `2.5`).
- History tests: add newest-first, cap at 200, clear, group into Today / dated sections with a fixed `now`.

### Edge Cases
- Division by zero variants (edge 2), invalid input (edge 3, 4, 7) return `{ ok: false }` and never throw.
- Ans chaining uses exact value: `1/3` then `Ans*3` → 1.
- Storage adapter: corrupted JSON, missing key, `localStorage` throwing → returns `[]`, save failures swallowed.
- Placeholder UI at 360 px: type `550/600`, Enter → `0.916666666667`, appears under "Today"; reload → still there.
- Bundle-size check in plan: built JS stays under 130 KB gzipped.

---

## Dependencies

- `mathjs` 15.x (runtime dependency, first one in the project)
- Feature 1 (done): Vite/Vitest/PWA setup, core boundary test
