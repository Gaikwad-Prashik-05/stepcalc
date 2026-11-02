# Plan: calc-engine

**Spec**: .planning/specs/calc-engine.md
**Epic**: pwa-core (Feature 2)
**Created**: 2026-11-03
**Status**: draft

---

## Stack (detected)

Existing: Vite 8 + TypeScript 7 + Vitest 5 + vite-plugin-pwa 2, `src/core` (pure) / `src/ui` (DOM) split enforced by `src/core/boundary.test.ts`. New runtime dependency: `mathjs@15`.

---

## Architecture

```
src/core/math.ts      mathjs instance (slim: only needed functions, BigNumber, precision 64)
src/core/engine.ts    calculate(expr, ans) -> CalcResult   (normalise input -> evaluate -> map errors -> format)
src/core/format.ts    formatNumber(exact) -> display string
src/core/history.ts   pure history model (add / clear / groupByDay)
        │  (ui imports core, never the reverse)
src/ui/history-store.ts   load/save history JSON in localStorage (storage injectable for tests)
src/ui/app.ts             placeholder screen: input, result, grouped history, Clear
```

### Components

| Component | Type | Purpose |
|---|---|---|
| `math` | core module | Configured mathjs instance; one place to add functions later (Scientific, Units) |
| `calculate` | core function | Normalise `× ÷ −`, phone-style `%`, `Ans`; evaluate; map Infinity/NaN/parse errors to friendly errors |
| `formatNumber` | core function | 12 significant digits, trailing zeros trimmed, `,` separators, exponent outside [1e-9, 1e15) |
| `addEntry` / `clearHistory` / `groupByDay` | core functions | Newest-first, cap 200, "Today" / "YYYY.MM.DD" groups by local day |
| `loadHistory` / `saveHistory` | ui functions | `localStorage` key `stepcalc.history.v1`, try/catch, validates shape |
| `renderApp` | ui function | Placeholder calculator screen (temporary until Feature 3) |

### New files

| File | Location | Purpose |
|---|---|---|
| `math.ts` | `src/core/` | mathjs `create()` with dependency set |
| `engine.ts`, `engine.test.ts` | `src/core/` | calculate + table-driven tests |
| `format.ts`, `format.test.ts` | `src/core/` | formatting + tests |
| `history.ts`, `history.test.ts` | `src/core/` | history model + tests |
| `history-store.ts`, `history-store.test.ts` | `src/ui/` | persistence + tests with a fake `Storage` |

### Files to change

| File | What changes | Why |
|---|---|---|
| `src/core/evaluate.ts`, `evaluate.test.ts` | **delete** | placeholder replaced by `engine.ts` (shortcut comment said so) |
| `src/ui/app.ts` | input + result + history UI | dogfood the engine |
| `src/ui/style.css` | styles for input, result, history list | same tokens (`--bg`, `--surface`, `--accent`…) |
| `package.json` / lock | add `mathjs` | dependency |
| `README.md` | "Early stage" note → "type expressions; keypad coming" | accuracy |
| `.planning/epics/pwa-core.md` | Feature 2 status | tracking |

---

## Tasks

Work in worktree `.worktrees/calc-engine` on `feature/calc-engine` (toolkit rule).

### Phase 1: Core (TDD, depends on nothing)

| # | Task | Files | Test |
|---|---|---|---|
| 1 | Install `mathjs`; `math.ts` slim instance. Spike: confirm the dependency set evaluates `+ − × ÷ ^ ( ) %` and `Ans`; measure gz size | `package.json`, `src/core/math.ts` | quick script; size < 130 KB gz total JS |
| 2 | `formatNumber` tests (red) → implement (green) | `src/core/format.ts`, `format.test.ts` | rounding, separators, exponent thresholds, `-0` → `0`, trailing zeros |
| 3 | `calculate` tests (red) → implement (green): normalise symbols, `%`-then-number → `%*`, Ans substitution, error mapping (never throws) | `src/core/engine.ts`, `engine.test.ts` | all Decisions rows + spec edge cases 1–7, 10 |
| 4 | `history` tests (red) → implement (green) | `src/core/history.ts`, `history.test.ts` | newest first, cap 200, clear, groupByDay with fixed `now` incl. 23:59 local (edge 9) |
| 5 | Delete `evaluate.ts` + test; boundary test still green | `src/core/evaluate*.ts` | `npm test` |

### Phase 2: UI (depends on Phase 1)

| # | Task | Files | Test |
|---|---|---|---|
| 6 | `history-store` tests (red) with fake `Storage` → implement | `src/ui/history-store.ts`, `history-store.test.ts` | corrupted JSON, missing key, wrong shape, `getItem`/`setItem` throwing → `[]` / no throw (edge 8) |
| 7 | Placeholder screen: labelled input (Enter = calculate), result line (`role="status"`), error text, Ans carried, grouped history list, Clear history button; dark tokens; 360 px | `src/ui/app.ts`, `src/ui/style.css` | manual + task 8 |
| 8 | Headless Chromium check on `npm run preview` at 360 px: type `550/600` → `0.916666666667`, under "Today"; reload → still listed; `1/0` → "Can't divide by 0"; Clear empties list; no h-scroll; offline reload still works | scratchpad script | pass |

### Phase 3: Review + ship (depends on Phase 2)

| # | Task | Files | Test |
|---|---|---|---|
| 9 | README note; `npm run typecheck && npm test && npm run build`; bundle size recorded | `README.md` | green, size noted |
| 10 | Reviewer agent (Stage 5) → fix findings until ACCEPT | — | ACCEPT |
| 11 | Merge to `main`, push (approved together with this plan — repo already public), watch CI | — | Actions green |
| 12 | Live check: same script as task 8 against the live URL; **update bar test** (open old version, deploy lands, bar appears after update check) — the item left from Feature 1 | — | pass |

Commits: one per phase (3) + review fixes.

### Parallel vs sequential

| Parallel group | Tasks | Why |
|---|---|---|
| A | 2, 4 | independent core files |

| Sequential | Depends on | Why |
|---|---|---|
| 3 | 1, 2 | engine uses math instance and formatter |
| 6, 7 | 4 | store and UI use history types |
| 8 | 7 | needs UI |
| 10–12 | 9 | ship only a green, reviewed build |

---

## Testing Plan

| Spec item | Test | Kind |
|---|---|---|
| Exact decimals (edge 1) | `0.1+0.2`→`0.3`, `1/3*3`→`1` | unit |
| Divide by zero (edge 2) | `1/0`, `0/0`, `5/(2-2)` → error, no throw | unit |
| Percent (edge 3) | `50+10%`→55, `200×15%`→30, `10%`→0.1, `7%3`→0.21, `%`/`5+%`→Invalid format | unit |
| Empty input (edge 4) | `''`, `'   '` → `{ ok:false, error:'empty' }`, UI adds nothing | unit + UI |
| Large/small (edge 5) | `1e30*1e30`→`1e+60`, `0.000000000123`→`1.23e-10`, `99999999999999`→`99,999,999,999,999` | unit |
| Minus forms (edge 6) | `-5 - -3`→-2, `−5`→-5, `6÷3×2`→4 | unit |
| Unknown names (edge 7) | `foo+1`, `sin(1)` → Invalid format | unit |
| Storage failures (edge 8) | fake Storage variants | unit (ui) |
| Day grouping (edge 9) | fixed `now`, entries 23:59 and 00:01 local | unit |
| Ans (edge 10) | `1/3` then `Ans*3`→1; after an error Ans unchanged | unit |
| Display rules | `formatNumber` table | unit |
| Placeholder UI + persistence | headless Chromium script | e2e (tasks 8, 12) |
| Bundle size | built JS gz < 130 KB | build check |
| Core purity | existing boundary test | unit |

Data layer: localStorage adapter tests (task 6). API: N/A (no backend).

---

## Gate 2

**Architecture**
- [x] Follows existing core/ui split; persistence lives in ui, logic in core
- [x] ui → core only
- [x] Files in correct directories

**Task breakdown**
- [x] All new, changed and deleted files listed
- [x] Each task ≤ 3 files (tests counted with their module)
- [x] Dependencies and parallel groups marked

**Testing**
- [x] Data layer (storage adapter) tests
- [x] Business logic (engine, format, history) tests
- [x] API: N/A, stated
- [x] UI e2e (local + live)
- [x] All 10 spec edge cases mapped

---

## Risks

- mathjs slim dependency set may miss a function the parser needs for `%` → found in task 1 spike, before any other code.
- Bundle may exceed 130 KB gz → fall back to lazy-loading the engine after first paint (one dynamic `import()`).
- `toSignificantDigits` rounding mode: use ROUND_HALF_UP to match calculators, tested explicitly (`0.125` → 3 sig = `0.125`, `2.5e-13`-style ties).
