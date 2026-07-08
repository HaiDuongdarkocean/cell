# Interaction Patterns — Cell Extension

| Pattern | ADR | Status | Use when | Don't use when | Used in |
|---|---|---|---|---|---|
| Pointer Events drag + `setPointerCapture` | ADR-015 | stable | Mouse + touch drag on overlay/cluster | Keyboard-only navigation | Subtitle overlay drag, Nav cluster drag |
| `chrome.storage.local` + `onStorageChanged` realtime persist | ADR-013 | stable | Settings persist + realtime sync across contexts | One-time read, no sync needed | Settings, overlay autoload, theme toggle |
| Keyboard shortcuts (single keydown → action) | ADR-009 | stable | Fixed mapping, no hold state | Hold-to-repeat semantics | subtitleShortcuts.ts |
| Hold state machine (keydown → timer → loop) | ADR-018 | stable | Hold-to-repeat (repeat sentence) | Single-press action | Nav cluster repeat button |
| Auto-load subtitle on URL change (id-level dedup) | ADR-007 | stable | Auto-load when entering video page | Manual trigger only | Bilingual subtitle auto-load |
| Two-phase render wipe (SPA navigation) | ADR-012 | stable | SPA page change without full reload | Multi-page navigation | Content-script on SPA sites |
| FSD screaming architecture (feature/domain) | ADR-016 | stable | New feature organization | Flat src/ structure | All new features |
| Background ↔ content-script messaging (tabId filter) | ADR-003 | stable | Background broadcast to specific tab | Popup-only messaging | messageBus.ts |
| Side-panel per-tab state | ADR-011 | stable | Per-tab sidepanel state | Global shared state | Sidepanel |
| Sidebar navigation (left, anchor jump) | — | stable | 3+ settings categories, multi-section UI | Single-section settings | SettingsDialog (planned) |
| Card grouping (visual containment) | — | stable | Group related settings, max 4-5 per card | Single setting or unrelated items | SettingsDialog (planned) |
| Progressive disclosure (expand/collapse) | — | should | Advanced/rarely-used settings | Core/frequently-used settings | SettingsDialog (planned) |
| Immediate feedback (no save button) | — | should | Toggle/select changes persist immediately | Form requiring explicit save | SettingsDialog (current) |
| Dependency explanation (child below parent) | — | should | Setting depends on another's value | Independent settings | SettingsDialog (Workers below Parallel) |
