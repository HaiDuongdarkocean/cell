# Spec: Subtitle Manager — Mobile Sheet trên Host Page (Bridge Protocol)

## Vấn đề
Khi video nằm trong cross-origin iframe (animekai/megaplay), manager sheet render trong iframe.
`position:fixed;bottom:0` bounded bởi iframe → sheet không thể cover host viewport.
Iframe expand `inset:0` che toàn bộ host page → 35% phía trên đen (iframe content, không có host page).

## Giải pháp
Bridge protocol: child iframe gửi manager state sang host page. Host page render SubtitleManagerPanel trực tiếp trên `document.body`. Actions từ host page gửi ngược lại child iframe qua postMessage.

## Alternatives Considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **(A) Iframe expand `bottom:0;height:75vh`** | Đơn giản, ít code | Video bị clip, 25% top không có host content (iframe content đen) | Rejected |
| **(B) Render sheet trên host page (bridge)** | 25% top = host page visible (header, video iframe ở vị trí gốc), sheet 75vh host viewport | Cần bridge protocol, serialize state, action round-trip | **Chosen** |
| **(C) Fullscreen API** | Cover toàn viewport | Cần user gesture, không reliable trên mobile, che toàn bộ host page | Rejected |

**Chọn (B)** vì là cách duy nhất giữ host page visible phía trên + sheet cover 75vh host viewport.

## Architecture

```
Child iframe (megaplay.buzz)          Host page (animekai.be)
┌──────────────────────┐              ┌──────────────────────┐
│ User clicks manager  │              │                      │
│ button in overlay    │              │                      │
│                      │              │                      │
│ Serialize ManagerState              │                      │
│ (items, indices,     │   MGR_OPEN   │                      │
│  hidden flags,       │ ──────────→  │ Validate event.origin│
│  offset, labels,     │              │ matches iframe src   │
│  hasSearchKeys,      │              │                      │
│  apiKeys,            │              │ createRoot on        │
│  appearance)         │              │ shadow host          │
│                      │              │ <ThemeProvider>      │
│                      │              │   <ManagerSheet>     │
│ Hide in-iframe       │   MGR_OPENED │                      │
│ manager (if shown)   │ ←──────────  │ Render sheet         │
│                      │   {ok:true}  │ 75vh host viewport   │
│                      │              │                      │
│ If ok=false →        │              │                      │
│ fallback in-iframe   │              │                      │
│                      │              │                      │
│ User clicks "Import" │              │                      │
│ in host sheet        │              │                      │
│                      │   MGR_ACTION │                      │
│                      │   {action:   │                      │
│                      │    'import', │                      │
│ Open file picker     │ ←──────────  │  role:'target'}     │
│ on CHILD iframe      │              │                      │
│ (file input phải    │              │                      │
│  nằm trên frame có   │              │                      │
│  user gesture)       │              │                      │
│                      │              │                      │
│ Parse file →         │   MGR_STATE  │                      │
│ update items         │ ──────────→  │ Update sheet props   │
│                      │              │                      │
│ User clicks X /      │              │                      │
│ outside sheet        │              │                      │
│                      │   MGR_CLOSE  │                      │
│                      │ ←──────────  │                      │
│ Cleanup in-iframe    │              │ Remove portal        │
│ state                │   MGR_CLOSED │                      │
│                      │ ──────────→  │                      │
└──────────────────────┘              └──────────────────────┘
```

## Message Protocol

### Child → Host
| Message | Payload | When |
|---------|---------|------|
| `MGR_OPEN` | `{ frameSrc, state: SerializedManagerState }` | User clicks manager button in iframe |
| `MGR_STATE` | `{ frameSrc, state: Partial<SerializedManagerState> }` | State changed (items, hidden, offset, etc.) via useEffect dependency |
| `MGR_CLOSED` | `{ frameSrc }` | Child confirms close (after cleanup) or `beforeunload` |

### Host → Child
| Message | Payload | When |
|---------|---------|------|
| `MGR_OPENED` | `{ ok: boolean }` | Host created portal + rendered sheet (ok=false if mount fail) |
| `MGR_ACTION` | `{ action: string, ...args }` | User interacts with sheet (click, import, etc.) |
| `MGR_CLOSE` | `{ frameSrc }` | User clicks X / outside sheet on host |

### Security
- Host-side: validate `event.origin` matches iframe `src` origin trước khi process message.
- Child-side: validate `event.origin === window.parent.location.origin` (best-effort, catch cross-origin error).

## SerializedManagerState

```typescript
interface SerializedManagerState {
  targetItems: SubtitlePanelItem[];
  nativeItems: SubtitlePanelItem[];
  targetActiveIndex: number;
  nativeActiveIndex: number;
  targetLabel?: string;
  nativeLabel?: string;
  targetHidden?: boolean;
  nativeHidden?: boolean;
  bothHidden?: boolean;
  targetOffsetMs: number;
  nativeOffsetMs: number;
  hasSearchKeys: boolean;
  apiKeys: SubtitleApiKey[];
  generateNativeDisabled: boolean;
  appearance?: SerializedAppearanceState;
}

interface SerializedAppearanceState {
  targetStyle: OverlayStyleConfig;
  nativeStyle: OverlayStyleConfig;
  blockSettings: SubtitleBlockSettings;
  clusterSettings: NavClusterSettings;
  defaultTargetStyle: OverlayStyleConfig;
  defaultNativeStyle: OverlayStyleConfig;
  previewTargetText: string;
  previewNativeText: string;
}
```

**Note:** Callbacks are NOT serialized. Host page sends `MGR_ACTION` messages instead.
**Note:** Search results NOT serialized — host page calls `sendMessage` directly (same background SW, same extension context).

## Action Protocol

Host page sends `MGR_ACTION` with action name + args. Child iframe maps to callbacks:

| Action | Args | Child callback | Notes |
|--------|------|----------------|-------|
| `select` | `{ role, index }` | `onSelect(role, index)` | |
| `import` | `{ role }` | `onImport(role)` | Child opens file picker (file input phải nằm trên child frame) |
| `generateNative` | `{}` | `onGenerateNative()` | |
| `offsetChange` | `{ role, ms }` | `onOffsetChange(role, ms)` | |
| `download` | `{ role, index }` | `onDownload(role, index)` | |
| `hideSection` | `{ role }` | `onHideSection(role)` | |
| `hideBoth` | `{}` | `onHideBoth()` | |
| `apiKeysChange` | `{ keys }` | `onApiKeysChange(keys)` | |
| `searchResultSelect` | `{ result, role }` | `onSearchResultSelect(result, role)` | Host page fetches search results independently, sends selected result |
| `styleChange` | `{ role, partial }` | `appearance.onStyleChange(role, partial)` | |
| `blockSettingsChange` | `{ partial }` | `appearance.onBlockSettingsChange(partial)` | |
| `clusterSettingsChange` | `{ partial }` | `appearance.onClusterSettingsChange(partial)` | |
| `resetStyle` | `{ role }` | `appearance.onResetStyle(role)` | |
| `previewTextChange` | `{ role, text }` | `appearance.onPreviewTextChange(role, text)` | |

### File Import Flow (critical)
1. User clicks "Import" button on host sheet → host sends `MGR_ACTION {action:'import', role}`.
2. Child iframe receives → calls `onImport(role)` → `openImportFileInput(role)` → `<input type="file">.click()` on child document.
3. File picker opens (user gesture propagated from child frame).
4. User selects file → child parses → updates items → sends `MGR_STATE {targetItems, nativeItems}`.
5. Host sheet updates with new items.

**Why child handles file picker:** `File` object không serialize được qua postMessage. File input phải nằm trên frame có user gesture. Child iframe đã có `openImportFileInput` logic — reuse.

### Search Flow
1. User types search query on host sheet → host page calls `sendMessage({type: SEARCH_SUBTITLES, payload})` directly (same background SW).
2. Results display on host sheet (host page has `SubtitleSearchPanel`).
3. User selects result → host sends `MGR_ACTION {action:'searchResultSelect', result, role}`.
4. Child receives → `onSearchResultSelect(result, role)` → download + load subtitle.

**Why host handles search:** `SubtitleSearchPanel` đã dùng `sendMessage` (chrome.runtime) — background SW shared giữa host + child. Không cần bridge search results.

## Acceptance Criteria

### AC-1: SerializedManagerState type
- [ ] Define `SerializedManagerState` + `SerializedAppearanceState` in `iframeManagerBridge.ts`
- [ ] All fields are JSON-serializable (no functions, no undefined)
- [ ] Reuse existing types: `SubtitlePanelItem`, `SubtitleApiKey`, `OverlayStyleConfig`, `SubtitleBlockSettings`, `NavClusterSettings`
- [ ] Include `targetOffsetMs`, `nativeOffsetMs`, `targetLabel`, `nativeLabel`, `generateNativeDisabled`

### AC-2: Child-side bridge (iframe)
- [ ] `requestManagerOpenOnHost(state: SerializedManagerState): Promise<boolean>` — sends `MGR_OPEN`, waits for `MGR_OPENED` (timeout 3s)
- [ ] `sendManagerStateUpdate(state: Partial<SerializedManagerState>): void` — sends `MGR_STATE`
- [ ] `onManagerAction(handler: (action: string, args: Record<string, unknown>) => void): () => void` — listens for `MGR_ACTION`
- [ ] `onManagerCloseFromHost(handler: () => void): () => void` — listens for `MGR_CLOSE`
- [ ] `confirmManagerClosed(): void` — sends `MGR_CLOSED`
- [ ] All functions no-op when `!isChildFrame()`
- [ ] `beforeunload` listener → sends `MGR_CLOSED` (cleanup if child navigates away)

### AC-3: Host-side bridge
- [ ] `installManagerSheetBridge(): () => void` — installs message listener on host page
- [ ] Validate `event.origin` against iframe `src` origin before processing
- [ ] On `MGR_OPEN`: create shadow host on `document.body`, `createRoot(shadowHost).render(<ThemeProvider theme={cellTheme}><ManagerSheetBridge /></ThemeProvider>)`
- [ ] On `MGR_STATE`: update sheet props (React state update)
- [ ] On `MGR_ACTION` from sheet: send `MGR_ACTION` to child iframe (match by `frameSrc`)
- [ ] On `MGR_CLOSE` (user clicks X/outside): send `MGR_CLOSE` to child, wait for `MGR_CLOSED` (timeout 2s), remove portal
- [ ] If `MGR_CLOSED` timeout → force remove portal (child may have navigated away)
- [ ] If React mount fail → send `MGR_OPENED {ok:false}`, log error
- [ ] Cleanup function: uninstall on `document.addEventListener('cell:cleanup')` or extension unload
- [ ] No-op when `window.self === window.top` and no iframe (same-origin sites)

### AC-4: SubtitlePanels integration (child iframe)
- [ ] Add `managerOpenOnHost: boolean` state — set true when `requestManagerOpenOnHost` resolves `true`
- [ ] When `managerOpen` + `isChildFrame()` + `innerWidth < 768`: serialize state, call `requestManagerOpenOnHost(state)`
- [ ] If `requestManagerOpenOnHost` returns `false` or timeout → fallback render in-iframe sheet (behavior cũ)
- [ ] When `managerOpenOnHost === true` → skip `createPortal(panelLayer)` (don't render in-iframe)
- [ ] Register `onManagerAction` handler → map actions to `manager.onSelect`, `manager.onImport`, etc.
- [ ] Guard all action callbacks: `if (!managerOpen) return` (ignore actions after close)
- [ ] Register `onManagerCloseFromHost` handler → `setManagerOpen(false)`
- [ ] On state change: `sendManagerStateUpdate(partialState)` via `useEffect` dependency on `[targetItems, nativeItems, targetActiveIndex, nativeActiveIndex, targetHidden, nativeHidden, bothHidden, targetOffsetMs, nativeOffsetMs, appearance]`. Throttle 100ms.
- [ ] On close: `confirmManagerClosed()`, reset `managerOpenOnHost = false`

### AC-5: Host page sheet rendering
- [ ] Sheet: `position:fixed;bottom:0;left:0;width:100vw;height:75vh`
- [ ] Solid background (`--color-surface-popover`), no translucent
- [ ] Drag handle, rounded top corners, slide-up animation
- [ ] Click outside sheet → `MGR_CLOSE`
- [ ] X button → `MGR_CLOSE`
- [ ] 25% phía trên = host page visible (header, video iframe ở vị trí gốc)
- [ ] Reuse `SubtitleManagerPanel` component (same props, same CSS module)

### AC-6: Desktop + same-origin unchanged
- [ ] Desktop iframe (>= 768px): manager render trong iframe (overlay video area) — no bridge
- [ ] Same-origin (no iframe): manager render bình thường — no bridge
- [ ] `isChildFrame() === false` → bridge functions no-op
- [ ] Rotate mobile→desktop: sheet close (`MGR_CLOSE`), manager re-open in-iframe

### AC-7: Build + verify
- [ ] `npm run build` pass
- [ ] Test animekai.be mobile: sheet trên host page, 25% top = host page visible
- [ ] Test animekai.be desktop: manager overlay video area (unchanged)
- [ ] Test same-origin site: manager render bình thường (unchanged)
- [ ] Test rotate mobile→desktop: sheet close, manager re-open in-iframe
- [ ] Test host page không có bridge (fallback): manager render in-iframe

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| File picker không hoạt động qua postMessage | High | Child iframe handles file picker (file input trên child document). Host chỉ gửi action. |
| Search results không serialize được | Med | Host page calls `sendMessage` directly (same background SW). Không cần serialize. |
| Appearance state quá lớn | Low | Serialize đầy đủ, chỉ gửi khi manager open. Throttle 100ms. |
| Action latency (postMessage round-trip) | Low | ~1ms per message, imperceptible |
| Host page không có React context | Med | `createRoot` + `<ThemeProvider theme={cellTheme}>` trên shadow host (reuse cellTheme) |
| Multiple iframes | Low | Match by `frameSrc` (already in bridge) |
| Child iframe navigate away | High | `beforeunload` → `MGR_CLOSED`. Host timeout 2s → force remove portal. |
| Race condition: action after close | Med | Child guards: `if (!managerOpen) return`. Host ignores `MGR_STATE` after `MGR_CLOSE` sent. |
| React mount fail on host | Med | Send `MGR_OPENED {ok:false}` → child fallback in-iframe. |
| Host page không có bridge installed | Med | `requestManagerOpenOnHost` timeout 3s → fallback in-iframe. |

## Implementation Order

### Phase 1 (MVP — open + close + select + import)
1. **AC-1**: Define serialized types
2. **AC-2**: Child-side bridge functions
3. **AC-3**: Host-side bridge + React mount (basic: open + close + select only)
4. **AC-4**: SubtitlePanels integration (open + close + select + import)
5. **AC-5**: Sheet CSS
6. **AC-6**: Verify desktop + same-origin unchanged
7. **AC-7**: Build + test animekai mobile

### Phase 2 (full features)
8. Offset, download, hide, generate native actions
9. Appearance view (style, block settings, cluster settings)
10. Search panel (host page calls sendMessage directly)
11. API keys management
12. Edge cases: rotate, multiple iframes, no bridge fallback

## Files

| File | Change |
|------|--------|
| `src/features/subtitle/logic/iframeManagerBridge.ts` | NEW — bridge protocol (serialized types + child/host functions) |
| `src/features/subtitle/ui/SubtitlePanels.tsx` | Integrate child-side bridge (managerOpenOnHost flag, serialize state, action handlers) |
| `src/features/subtitle/ui/HostManagerSheet.tsx` | NEW — host page sheet renderer (createRoot + ThemeProvider + SubtitleManagerPanel) |
| `src/entrypoints/content/contentScript.ts` | Install host-side bridge (`installManagerSheetBridge()`) |
| `src/features/subtitle/ui/SubtitlePanels.module.css` | Sheet styles (reuse existing mobile CSS) |
