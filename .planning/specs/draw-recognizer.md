# Spec: draw-recognizer

**Created**: 2026-11-03
**Status**: done (live 2026-11-03)
**Author**: Prashik Gaikwad
**Epic**: scientific-draw (Feature 10)

---

## Goal

Recognise handwritten symbols offline in a few KB, and get better at the user's own handwriting.

## Decisions

| Topic | Decision |
|---|---|
| Recogniser | $P point-cloud recogniser (Vatavu, Anthony & Wobbrock 2012) in `src/draw/recognizer.ts` behind a `Recognizer` interface (`recognize(strokes) → ranked alternatives`), so a trained model can replace it later (epic `native`) |
| Symbols | 0–9, + − × ÷ = ( ) . √, letters a b c n x y and s i o t l g e (for sin, cos, tan, log, ln, e), π |
| Built-in templates | Generated from hand-written stroke definitions (`src/draw/templates.ts`), several variants for digits written differently (1 with/without flag, open/closed 4, …) |
| Geometry first | Dots (tiny strokes) and flat lines (−, =, fraction bars) are decided by shape and size, not by $P |
| Learns | "Teach my handwriting" screen: pick a symbol, draw it; every correction made with tap-to-fix is also kept as a sample. Stored on device (`stepcalc.handwriting.v1`), max 12 per symbol |
| Input | Canvas with pointer events (finger, pen, mouse), `touch-action: none`; Undo and Clear buttons |

## Done when

- Built-in templates, drawn with random scale, offset and jitter, are recognised top-1 for at least 90 % of digit samples in tests.
- A taught sample is preferred over built-ins for that user.
- The recogniser adds well under 200 KB (target < 20 KB gzipped for all of Draw).
