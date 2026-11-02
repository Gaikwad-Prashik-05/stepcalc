# Spec: basic-mode-ui

**Created**: 2026-11-04
**Status**: approved (2026-11-04)
**Author**: Prashik Gaikwad
**Epic**: pwa-core (Feature 3)

---

## Goal

Replace the temporary text-box screen with a phone-style calculator: mode dropdown, history, display, on-screen keypad. Works by touch and by keyboard.

## Decisions

| Topic | Decision |
|---|---|
| Keypad | 5×4 grid: `AC ⌫ % ÷` / `7 8 9 ×` / `4 5 6 −` / `1 2 3 +` / `Ans 0 . =`. Brackets and `^` come from the keyboard only for now |
| Input | Keep the existing text input as the display line; `inputmode="none"` so the phone keyboard does not pop up over the keypad. Laptop typing still works |
| Key logic | Pure `applyKey(state, key)` in `src/core/keypad.ts` (tested): inserts at the caret, ⌫ deletes before the caret (or the selection), AC clears |
| After `=` | An operator continues from the answer (`Ans+`), a digit or `.` starts a new expression (phone behaviour) |
| Keyboard | Enter / `=` calculates, Escape = AC, everything else is normal typing |
| Mode dropdown | `Basic` active; `Scientific`, `Conversion`, `Draw` listed but disabled |
| Layout | Header (title + mode) → display → keypad → history below (newest first, scrolls with the page). Max width 480px |
| Errors | Same messages as Feature 2; expression kept for fixing |

## Out of scope

Live result preview while typing, tapping a history entry to reuse it, bracket keys. Name them in a later feature if wanted.

## Done when

- Keypad and keyboard both produce the same results; tests for `applyKey` pass.
- All existing tests pass, build passes, works at 375px width, keys are at least 44px, visible focus ring.
