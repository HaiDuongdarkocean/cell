# Task List: Manager Host Sheet Bridge

## Wave 1 — No deps (4 parallel)

### T1: Bridge types
**File:** `src/features/subtitle/logic/iframeManagerBridgeTypes.ts` (NEW)
**Deps:** None
**AC:**
- [ ] Export `SerializedManagerState` interface with fields: targetItems, nativeItems, targetActiveIndex, nativeActiveIndex, targetLabel?, nativeLabel?, targetHidden?, nativeHidden?, bothHidden?, targetOffsetMs, nativeOffsetMs, hasSearchKeys, apiKeys, generateNativeDisabled, appearance?
- [ ] Export `SerializedAppearanceState` interface with fields: targetStyle, nativeStyle, blockSettings, clusterSettings, defaultTargetStyle, defaultNativeStyle, previewTargetText, previewNativeText
- [ ] Export `ManagerAction` union type: 'select' | 'import' | 'generateNative' | 'offsetChange' | 'download' | 'hideSection' | 'hideBoth' | 'apiKeysChange' | 'searchResultSelect' | 'styleChange' | 'blockSettingsChange' | 'clusterSettingsChange' | 'resetStyle' | 'previewTextChange'
- [ ] Export `ManagerActionMessage` interface: `{ action: ManagerAction; [key: string]: unknown }`
- [ ] Export message type constants: `MGR_OPEN_MSG`, `MGR_CLOSE_MSG`, `MGR_STATE_MSG`, `MGR_ACTION_MSG`, `MGR_OPENED_MSG`, `MGR_CLOSED_MSG` (all `__CELL_MANAGER_*`)
- [ ] Import types from existing: `SubtitlePanelItem` from `subtitlePanelModel`, `SubtitleApiKey` from `@/entities/settings`, `OverlayStyleConfig`, `SubtitleBlockSettings`, `NavClusterSettings` from their existing locations
- [ ] All fields JSON-serializable (no functions, no undefined — use `?` optional)
- [ ] `npm run build` pass

### T6: Host sheet CSS
**File:** `src/features/subtitle/ui/HostManagerSheet.module.css` (NEW)
**Deps:** None
**AC:**
- [ ] `.sheet` class: `position:fixed;bottom:0;left:0;width:100vw;height:75vh;max-height:75vh`
- [ ] Solid background: `background: var(--color-surface-popover, #1a1a1a)`
- [ ] `border-radius: 16px 16px 0 0` (top corners only)
- [ ] `box-shadow: 0 -4px 24px rgba(0,0,0,0.3)` (shadow above sheet)
- [ ] `z-index: 2147483647` (max)
- [ ] `overflow-y: auto; -webkit-overflow-scrolling: touch`
- [ ] `.handle` class: drag handle bar (36px wide, 4px tall, centered, `border-radius: 2px`, `background: var(--color-border-strong)`, `margin: 8px auto`)
- [ ] `.backdrop` class: `position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:2147483646`
- [ ] `@keyframes slideUp`: `from { transform: translateY(100%) } to { transform: translateY(0) }`
- [ ] `.sheet` has `animation: slideUp 0.25s ease-out`
- [ ] `@media (prefers-reduced-motion: reduce)`: disable animation
- [ ] Use tokens from `tokens.css` — read `src/shared/styles/README.md` first
- [ ] `npm run build` pass

### T13: Revert iframe expand
**File:** `src/features/subtitle/logic/iframePlayerModeBridge.ts` (EXISTING)
**Deps:** None
**AC:**
- [ ] Remove `MGR_EXPAND_MSG`, `MGR_COLLAPSE_MSG`, `MGR_EXPANDED_MSG`, `MGR_COLLAPSED_MSG` constants
- [ ] Remove `expandIframeForManager`, `collapseIframeForManager` functions
- [ ] Remove `requestManagerExpand`, `requestManagerCollapse` functions
- [ ] Remove message handlers for MGR_EXPAND/MGR_COLLAPSE in `installIframePlayerModeBridge`
- [ ] Keep all Player Mode bridge logic unchanged (ENTER/EXIT/ENTERED/EXITED)
- [ ] Keep `isChildFrame`, `requestIframePlayerModeEnter`, `requestIframePlayerModeExit` unchanged
- [ ] `npm run build` pass

### T14: Architecture doc update
**File:** `docs/2-architechture-system.md` (EXISTING)
**Deps:** None
**AC:**
- [ ] Add `iframeManagerBridgeTypes.ts` to file tree under `src/features/subtitle/logic/`
- [ ] Add `managerStateSerializer.ts` to file tree
- [ ] Add `iframeManagerBridgeChild.ts` to file tree
- [ ] Add `iframeManagerBridgeHost.ts` to file tree
- [ ] Add `HostManagerSheet.tsx` to file tree under `src/features/subtitle/ui/`
- [ ] Add `HostManagerSheet.module.css` to file tree
- [ ] Add 1-line description for each new file in function index
- [ ] Verify with `ls` not memory

---

## Wave 2 — Depend on T1 (5 parallel)

### T2: State serializer
**File:** `src/features/subtitle/logic/managerStateSerializer.ts` (NEW)
**Deps:** T1
**AC:**
- [ ] Export `serializeManagerState(manager: ManagerState, offset?: OffsetState, generateNativeDisabled?: boolean): SerializedManagerState` — strips callbacks, keeps data fields
- [ ] Export `serializeAppearanceState(appearance: AppearanceState): SerializedAppearanceState` — strips callbacks
- [ ] Import `ManagerState`, `OffsetState` from `SubtitlePanels` (type-only import)
- [ ] Import `AppearanceState` from `SubtitleManagerPanel` (type-only import)
- [ ] Import `SerializedManagerState`, `SerializedAppearanceState` from `iframeManagerBridgeTypes`
- [ ] `serializeManagerState` maps: targetItems, nativeItems, targetActiveIndex, nativeActiveIndex, targetHidden, nativeHidden, bothHidden, hasSearchKeys, apiKeys, generateNativeDisabled, appearance (if present)
- [ ] `serializeManagerState` maps offset: `offset.targetMs → targetOffsetMs`, `offset.nativeMs → nativeOffsetMs` (default 0 if no offset)
- [ ] All output fields JSON-serializable (verify with `JSON.stringify` — no throw)
- [ ] `npm run build` pass

### T3: Child-side bridge
**File:** `src/features/subtitle/logic/iframeManagerBridgeChild.ts` (NEW)
**Deps:** T1
**AC:**
- [ ] Export `requestManagerOpenOnHost(state: SerializedManagerState, timeoutMs?: number): Promise<boolean>` — sends `MGR_OPEN` to `window.parent`, waits for `MGR_OPENED`, returns `ok` boolean. Timeout default 3000ms → resolve `false`.
- [ ] Export `sendManagerStateUpdate(state: Partial<SerializedManagerState>): void` — sends `MGR_STATE` to `window.parent`
- [ ] Export `confirmManagerClosed(): void` — sends `MGR_CLOSED` to `window.parent`
- [ ] Export `onManagerAction(handler: (action: ManagerAction, args: Record<string, unknown>) => void): () => void` — listens for `MGR_ACTION` messages, returns cleanup function
- [ ] Export `onManagerCloseFromHost(handler: () => void): () => void` — listens for `MGR_CLOSE` messages, returns cleanup function
- [ ] All functions no-op (return `false`/`undefined`/noop) when `!isChildFrame()` — import `isChildFrame` from `iframePlayerModeBridge`
- [ ] `beforeunload` listener: sends `MGR_CLOSED` before page unload (only if manager was opened on host)
- [ ] All `postMessage` use `'*'` target origin (cross-origin safe)
- [ ] Import message constants + types from `iframeManagerBridgeTypes`
- [ ] `npm run build` pass

### T4: Host-side bridge
**File:** `src/features/subtitle/logic/iframeManagerBridgeHost.ts` (NEW)
**Deps:** T1
**AC:**
- [ ] Export `installManagerSheetBridge(): () => void` — installs `message` listener on `window`, returns cleanup function
- [ ] On `MGR_OPEN`: validate `event.origin` matches an iframe `src` origin on the page. If valid: call `openHostSheet(event.data.state, event.data.frameSrc)` callback. Send `MGR_OPENED {ok: true}` to child. If invalid: ignore.
- [ ] On `MGR_STATE`: update sheet state (call registered state update callback)
- [ ] On `MGR_CLOSED`: remove portal, cleanup React root (call registered close callback)
- [ ] Export `setHostSheetCallbacks(callbacks: { onOpen, onStateUpdate, onClose }): void` — register callbacks for open/state/close events
- [ ] Export `sendManagerActionToChild(frameSrc: string, action: ManagerAction, args: Record<string, unknown>): void` — sends `MGR_ACTION` to specific iframe by `frameSrc`
- [ ] Export `sendManagerCloseToChild(frameSrc: string): void` — sends `MGR_CLOSE` to child iframe
- [ ] No-op when `window.self === window.top` and no iframes on page (same-origin sites)
- [ ] Validate `event.origin` against `iframe.src` origin (parse with `new URL(iframe.src).origin`)
- [ ] Import message constants + types from `iframeManagerBridgeTypes`
- [ ] `npm run build` pass

### T5: Host sheet React component
**File:** `src/features/subtitle/ui/HostManagerSheet.tsx` (NEW)
**Deps:** T1
**AC:**
- [ ] Export `HostManagerSheet` component (named export, no default)
- [ ] Props: `{ state: SerializedManagerState; onAction: (action: ManagerAction, args: Record<string, unknown>) => void; onClose: () => void }`
- [ ] Render backdrop (click → `onClose`) + sheet container (`.sheet` from CSS module)
- [ ] Render drag handle (`.handle`)
- [ ] Render `<SubtitleManagerPanel>` inside sheet, mapping SerializedManagerState → SubtitleManagerPanelProps:
  - `targetItems`, `nativeItems`, `targetActiveIndex`, `nativeActiveIndex` → direct
  - `targetLabel`, `nativeLabel` → direct
  - `targetHidden`, `nativeHidden`, `bothHidden` → direct
  - `generateNativeDisabled` → direct
  - `hasSearchKeys`, `apiKeys` → direct
  - `onSelect` → `(role, index) => onAction('select', { role, index })`
  - `onClose` → `onClose` prop
  - `onImport` → `(role) => onAction('import', { role })`
  - `onGenerateNative` → `() => onAction('generateNative', {})`
  - `onOffsetChange` → `(role, ms) => onAction('offsetChange', { role, ms })`
  - `onDownload` → `(role, index) => onAction('download', { role, index })`
  - `onHideSection` → `(role) => onAction('hideSection', { role })`
  - `onHideBoth` → `() => onAction('hideBoth', {})`
  - `onApiKeysChange` → `(keys) => onAction('apiKeysChange', { keys })`
  - `onSearchResultSelect` → `(result, role) => onAction('searchResultSelect', { result, role })`
  - `appearance` (if present) → map SerializedAppearanceState → AppearanceState with action callbacks:
    - `onStyleChange` → `(role, partial) => onAction('styleChange', { role, partial })`
    - `onBlockSettingsChange` → `(partial) => onAction('blockSettingsChange', { partial })`
    - `onClusterSettingsChange` → `(partial) => onAction('clusterSettingsChange', { partial })`
    - `onResetStyle` → `(role) => onAction('resetStyle', { role })`
    - `onPreviewTextChange` → `(role, text) => onAction('previewTextChange', { role, text })`
- [ ] Import `SubtitleManagerPanel` + `AppearanceState` from `SubtitleManagerPanel`
- [ ] Import `HostManagerSheet.module.css`
- [ ] Import types from `iframeManagerBridgeTypes`
- [ ] `npm run build` pass

### T15: Wiki update
**File:** `docs/0-wiki.md` (EXISTING)
**Deps:** None (can run wave 1 or 2)
**AC:**
- [ ] Add spec link: `docs/specs/manager-host-sheet-bridge.md` under specs section
- [ ] Add plan link: `tasks/plan.md` under planning section

---

## Wave 3 — Tests (4 parallel, depend on wave 2)

### T7: Types test
**File:** `src/features/subtitle/logic/iframeManagerBridgeTypes.test.ts` (NEW)
**Deps:** T1
**AC:**
- [ ] Test: `SerializedManagerState` fields are all JSON-serializable (create mock, `JSON.stringify` no throw)
- [ ] Test: `SerializedAppearanceState` fields are all JSON-serializable
- [ ] Test: `ManagerAction` union covers all 14 action types
- [ ] Test: message constants all start with `__CELL_MANAGER_`
- [ ] `npm run test:unit` pass

### T8: Serializer test
**File:** `src/features/subtitle/logic/managerStateSerializer.test.ts` (NEW)
**Deps:** T2
**AC:**
- [ ] Test: `serializeManagerState` strips all function fields (no `onSelect`, `onImport`, etc. in output)
- [ ] Test: `serializeManagerState` maps offset correctly (`offset.targetMs → targetOffsetMs`)
- [ ] Test: `serializeManagerState` handles missing offset (default 0)
- [ ] Test: `serializeManagerState` handles missing appearance (output `appearance` undefined)
- [ ] Test: `serializeAppearanceState` strips all function fields
- [ ] Test: round-trip — `JSON.parse(JSON.stringify(serializeManagerState(mock)))` equals serializeManagerState(mock) for data fields
- [ ] `npm run test:unit` pass

### T9: Child bridge test
**File:** `src/features/subtitle/logic/iframeManagerBridgeChild.test.ts` (NEW)
**Deps:** T3
**AC:**
- [ ] Test: `requestManagerOpenOnHost` returns `false` when `!isChildFrame` (mock `window.self === window.top`)
- [ ] Test: `requestManagerOpenOnHost` sends `MGR_OPEN` message to `window.parent` (mock `window.parent.postMessage`)
- [ ] Test: `requestManagerOpenOnHost` resolves `true` when `MGR_OPENED {ok:true}` received
- [ ] Test: `requestManagerOpenOnHost` resolves `false` on timeout (mock timer)
- [ ] Test: `sendManagerStateUpdate` sends `MGR_STATE` message
- [ ] Test: `confirmManagerClosed` sends `MGR_CLOSED` message
- [ ] Test: `onManagerAction` calls handler with action + args on `MGR_ACTION` message
- [ ] Test: `onManagerAction` cleanup removes listener
- [ ] Test: `onManagerCloseFromHost` calls handler on `MGR_CLOSE` message
- [ ] Test: all functions no-op when `!isChildFrame`
- [ ] `npm run test:unit` pass

### T10: Host sheet component test
**File:** `src/features/subtitle/ui/HostManagerSheet.test.tsx` (NEW)
**Deps:** T5
**AC:**
- [ ] Test: renders backdrop + sheet container
- [ ] Test: renders drag handle
- [ ] Test: click backdrop calls `onClose`
- [ ] Test: passes correct props to `SubtitleManagerPanel` (mock SubtitleManagerPanel, check props)
- [ ] Test: `onSelect` in SubtitleManagerPanel calls `onAction('select', {role, index})`
- [ ] Test: `onImport` calls `onAction('import', {role})`
- [ ] Test: `onClose` (X button) calls `onClose` prop
- [ ] Test: appearance actions mapped correctly (`onStyleChange` → `onAction('styleChange', ...)`)
- [ ] `npm run test:unit` pass

---

## Wave 4 — Integration (2 parallel, depend on wave 2+3)

### T11: SubtitlePanels integration
**File:** `src/features/subtitle/ui/SubtitlePanels.tsx` (EXISTING — sole editor)
**Deps:** T2, T3
**AC:**
- [ ] Import `serializeManagerState` from `managerStateSerializer`
- [ ] Import `requestManagerOpenOnHost`, `sendManagerStateUpdate`, `onManagerAction`, `onManagerCloseFromHost`, `confirmManagerClosed` from `iframeManagerBridgeChild`
- [ ] Add `managerOpenOnHost: boolean` state (default `false`)
- [ ] Add `useEffect`: when `managerOpen && isChildFrame() && window.innerWidth < 768`:
  - Serialize state: `const serialized = serializeManagerState(manager, offset, !generateNativeEnabled)`
  - Call `const ok = await requestManagerOpenOnHost(serialized)`
  - If `ok`: `setManagerOpenOnHost(true)` (skip in-iframe portal)
  - If `!ok`: fallback — don't set `managerOpenOnHost`, render in-iframe as normal
- [ ] Modify portal condition: `{managerOpen && manager && managerPortalTarget && !managerOpenOnHost && createPortal(...)}`
- [ ] Add `useEffect` for `onManagerAction`: register handler that maps actions to `manager.onSelect`, `manager.onImport`, `manager.onGenerateNative`, `manager.onOffsetChange`, `manager.onDownload`, `manager.onHideSection`, `manager.onHideBoth`, `manager.onApiKeysChange`, `manager.onSearchResultSelect`, `appearance.onStyleChange`, etc.
- [ ] Guard all action callbacks: `if (!managerOpen) return`
- [ ] Add `useEffect` for `onManagerCloseFromHost`: `setManagerOpen(false)`
- [ ] Add `useEffect` for state sync: `sendManagerStateUpdate(serializeManagerState(...))` on dependency change `[manager.targetItems, manager.nativeItems, manager.targetActiveIndex, manager.nativeActiveIndex, manager.targetHidden, manager.nativeHidden, manager.bothHidden, offset?.targetMs, offset?.nativeMs, manager.appearance]`. Throttle 100ms.
- [ ] On close (`managerOpen` goes false): if `managerOpenOnHost` was true → `confirmManagerClosed()`, `setManagerOpenOnHost(false)`
- [ ] Remove old expand/collapse useEffect (from previous approach)
- [ ] Remove `requestManagerExpand`, `requestManagerCollapse` imports
- [ ] `npm run build` pass

### T12: contentScript install host bridge
**File:** `src/entrypoints/content/content-script.ts` (EXISTING — sole editor)
**Deps:** T4, T5
**AC:**
- [ ] Import `installManagerSheetBridge`, `setHostSheetCallbacks`, `sendManagerActionToChild`, `sendManagerCloseToChild` from `iframeManagerBridgeHost`
- [ ] Import `HostManagerSheet` from `HostManagerSheet`
- [ ] Import `createRoot` from `react-dom`
- [ ] Import `ShadowThemeProvider` from `@/shared/lib/shadowRoot/ShadowThemeProvider`
- [ ] Import `injectShadowCss` from `@/shared/lib/shadowRoot/injectShadowCss`
- [ ] After `installIframePlayerModeBridge()` call, add `installManagerSheetBridge()`
- [ ] Register host sheet callbacks:
  - `onOpen(state, frameSrc)`: create shadow host on `document.body`, `createRoot`, render `<ShadowThemeProvider><HostManagerSheet state={state} onAction={(action, args) => sendManagerActionToChild(frameSrc, action, args)} onClose={() => sendManagerCloseToChild(frameSrc)} /></ShadowThemeProvider>`. Store root + host for cleanup.
  - `onStateUpdate(partialState)`: update React state (re-render with new state)
  - `onClose()`: unmount root, remove shadow host
- [ ] Cleanup on extension unload: unmount root, remove shadow host, uninstall bridge
- [ ] `npm run build` pass

---

## Wave 5 — Final verify (1)

### T16: Build + verify all
**Deps:** T11, T12
**AC:**
- [ ] `npm run build` pass
- [ ] `npm run test:unit` pass
- [ ] Test animekai.be mobile (CDP): sheet trên host page, 25% top = host page visible
- [ ] Test animekai.be desktop: manager overlay video area (unchanged)
- [ ] Test same-origin site: manager render bình thường (unchanged)
- [ ] Test rotate mobile→desktop: sheet close, manager re-open in-iframe
- [ ] Commit all changes
