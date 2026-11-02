# Epic: native

**Created**: 2026-11-02
**Status**: planning (after pwa-core + scientific-draw)
**Owner**: Prashik Gaikwad

---

## Why

Ship the same app as native apps to use device features the web can't (haptics, widgets, native file/share, better stylus input), on Android, iOS, Linux, Windows and macOS.

---

## Success Criteria

- [ ] Android build (Capacitor) installs and passes the same core tests
- [ ] Linux desktop build (Tauri) runs on CachyOS/Hyprland
- [ ] No duplicated math/steps/recognition code between PWA and native builds

---

## Features

| # | Feature | Status | Spec | Plan | Depends On |
|---|---------|--------|------|------|------------|
| 12 | capacitor-mobile | todo | — | — | scientific-draw |
| 13 | tauri-desktop | todo | — | — | scientific-draw |
| 14 | trained-symbol-model | todo | — | — | #10 |

---

## Feature Briefs

### Feature 12: capacitor-mobile
Wrap the PWA with Capacitor for Android (and iOS if a Mac is available): haptics on key press, share result, home-screen widget.

### Feature 13: tauri-desktop
Tauri wrapper for Linux/Windows/macOS: small binary, global shortcut to open the calculator, native window.

### Feature 14: trained-symbol-model
Train a small CNN on CROHME handwritten math symbols, export to run in-browser, swap in behind the recogniser interface from #10.

---

## Risks

- iOS builds need macOS + Apple developer account
- Widget support differs per platform
