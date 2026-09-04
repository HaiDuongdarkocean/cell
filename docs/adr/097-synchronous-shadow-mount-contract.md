# ADR-097: Synchronous Shadow Mount Contract for `mountSubtitle`

## Status

Accepted

## Date

2026-09-04

## Context

`mountSubtitle` (`src/features/subtitle/ui/mountSubtitle.tsx`) mounts `SubtitlePanels` into a shadow root and returns an imperative handle (`setManager`, `setManagerOpen`, `setOffset`, …) backed by a ref to the component. `ReactSubtitleController` calls `mountSubtitle` in its constructor and **immediately** drives panel state (`setManager`, `setOffset`), and later responds to user actions (e.g. `openManager()` from the toolbar) through the same handle.

React 18's `createRoot().render()` is asynchronous under concurrent rendering. If the initial render is not flushed synchronously, the `SubtitlePanels` ref callback has not run when the first imperative calls fire — every handle method is `controllerRef?.method(...)` and the null ref makes the call a **silent no-op**. No error, no warning.

This failure mode shipped: the `flushSync` import was dropped from `mountSubtitle.tsx` while the call remained, so `setManagerOpen(true)` no-op'd and the subtitle manager panel never opened when its toolbar button was clicked (user report on StreamFlix). Restoring the import fixed it (commit `9dc43126`), verified by the e2e spec `e2e/extension-subtitle-manager.spec.ts`.

The trap is structural, not a one-off typo: any refactor that makes the initial render async (removing `flushSync`, switching to lazy mounting, deferring the ref) reintroduces the same silent failure across **every** imperative handle method, not just the manager.

## Decision

`mountSubtitle` must flush its initial `SubtitlePanels` render synchronously (`flushSync`) so the imperative ref is populated before `mountSubtitle` returns. The contract is:

1. `mountSubtitle` returns only after `SubtitlePanels` is committed and its ref is assigned.
2. Callers (`ReactSubtitleController`) may drive the imperative handle immediately after `mountSubtitle` returns, with no readiness handshake.
3. The contract is guarded by the e2e regression spec (toggle button → manager layer visible), not by a unit test, because the failure depends on real React commit timing inside a shadow root.

## Alternatives Considered

### Queue imperative calls until the ref is ready
- Pros: keeps `render` async; no `flushSync` layout cost.
- Cons: extra buffering machinery in the handle; turns "call order" bugs into "eventual consistency" bugs that are harder to reproduce; the silent-drop failure would become a silent-delay failure.
- Rejected because: the mount happens once per video controller and the one-time sync layout cost is negligible; explicit synchronous availability is easier to reason about.

### Convert the imperative handle to declarative props
- Pros: removes the ref-timing class of bugs entirely; idiomatic React.
- Cons: `ReactSubtitleController` drives high-frequency imperative updates (play state, cues, toasts, current time) through the handle; converting to props means re-rendering the mount root on every update — a large refactor of a stable API.
- Rejected because: cost outweighs the benefit; revisit if the handle grows further.

### Rely on the prop-sync `useEffect`s in `SubtitlePanels`
- Pros: no flush needed; props eventually sync.
- Cons: `useState(initialManager)` only seeds the first render, and the prop-sync effects guard against the first render where the prop is still undefined — they cannot replace the imperative path for controller-initiated actions like `openManager`.
- Rejected because: it does not solve the null-ref window.

## Consequences

- `flushSync` forces a synchronous layout during overlay init — a one-time cost per video mount, acceptable.
- The gotcha is documented inline at the `flushSync` call site in `mountSubtitle.tsx` (why-comment, per the documentation guideline).
- Known subtlety: effects flushed by `flushSync` run **before** `host.id = 'cell-subtitle-root'` is assigned (that line executes after `mountReactShadow` returns). The manager portal effect therefore cannot rely on `getElementById` during mount and falls back to `rootRef.current.parentElement` inside the shadow root; the panel renders correctly there (verified e2e). Documented inline in `SubtitlePanels.tsx`.
- If the imperative-handle contract is ever changed (async mount, deferred ref), the e2e spec is the tripwire: it fails with "subtitle-manager-layer not found".
