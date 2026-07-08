# Content-script Controllers — Cell Extension

> Location: `src/features/subtitle/ui/`

## Inventory

| Controller | File | Status | Since | Lifecycle | Used in |
|---|---|---|---|---|---|
| `ContentScriptController` | `contentScriptController.ts` | stable | 1.0.0 | init → update → destroy | content-script entry |
| `NavClusterController` | `navClusterController.ts` | stable | 1.2.0 | init → updateCues → updateSettings → destroy | ContentScriptController |

## Lifecycle rules

- `init()` — set up listeners, render initial UI, register storage observers
- `update*()` — react to settings/cue changes without full re-init
- `destroy()` — remove all listeners + DOM nodes — prevents leaks across SPA navigations (ADR-012 two-phase render wipe)

See [content-script-factories.md](content-script-factories.md) for code example.
