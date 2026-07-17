# Auto-Select & Auto-Download Feature Architecture

Level 2 reference — load when working on auto-select, auto-download, whitelist, or MultiSelect.

## Architecture
- **Auto Download** (Header AD toggle): whitelists the current URL's **first pathname segment** (origin + first path segment) via `src/lib/utils/whitelist.ts`. Query strings, hash fragments, and the rest of the path are stripped. This means enabling AD for one episode of a show (e.g. `https://kisskh.co/Drama/.../Episode-1`) whitelists the whole category (`https://kisskh.co/Drama`), so navigating to `Episode-2` under the same category automatically triggers a download. Different domains (e.g. `https://anime.uniquestream.net/...`) never share a whitelist entry. Two trigger paths:
  1. **Toggle ON in popup** (`handleToggleAutoDownload` in `App.redesigned.tsx`): immediately runs `selectBestMedia` against currently detected media and triggers download of the best video + matching subtitles for the current tab — in addition to whitelisting for future revisits. AD implies auto-select for download, so this runs regardless of `autoSelectEnabled`.
  2. **Revisit whitelisted page**: `tryAutoDownload` in `src/background/autoDownload.ts` is triggered from `NetworkInterceptor.onMediaDetected` (NOT `tabs.onUpdated` complete — that fires before network interception captures m3u8/subtitle requests, so media is always empty there). A per-tab guard map (`autoDownloadedTabs` on `BackgroundService`) prevents duplicate downloads when `onMediaDetected` fires multiple times incrementally for the same exact page (m3u8 → subtitles → enriched variants). The guard stores the exact tab URL, so navigating to a different episode under the same whitelisted category still auto-downloads. The guard is cleared on `tabs.onUpdated` loading and `tabs.onRemoved`.
- `tryAutoDownload` returns `boolean` (true if items enqueued) so the caller knows whether to mark the tab as auto-downloaded.
- **Auto Select** (Settings AS toggle): when `settings.autoSelectEnabled` is ON, popup auto-checks best media via `selectBestMedia` on open. User still clicks Download manually.
- **selectBestMedia** (`src/lib/selectors/selectBestMedia.ts`): pure function. Fallback order: Preferred Format → Default Quality → Subtitle availability. Returns `AutoSelectResult | null`.
- **MultiSelect** (`src/popup/components/settings/MultiSelect.tsx`): reusable component with search + checkbox list. Used for subtitle language selection (replaces single dropdown).

## Settings migration
- `defaultSubtitleLanguage: string` → `selectedSubtitleLanguages: string[]` (multi-select). Migration in `popupStore.loadPersistedSettings`.
- New fields: `preferredVideoFormat: 'mp4' | 'm3u8'` (default 'm3u8'), `autoSelectEnabled: boolean` (default false).
- `STORAGE_KEYS.AUTO_DOWNLOAD_WHITELIST` stores `WhitelistEntry[]` in `chrome.storage.local`.

## Learned insights

### integration.test.ts describe block merge
- The file had duplicate `describe('OffscreenManager')` blocks with a premature `});` closing the first one. Merged into single `describe('Background integration')` block. OffscreenManager tests now use `let manager: OffscreenManager` initialized per-test (no separate beforeEach) since they share the outer describe's mock setup.
- Mock Chrome needed `storage.session` added (BackgroundService uses `chrome.storage.session` for session media/downloads).

### Auto Download tab detection in popup
- `chrome.tabs.query({ active: true, currentWindow: true })` in a real Chrome popup returns the active content tab (the popup itself is not a tab). In Playwright E2E tests that open the popup URL as a regular tab, the active tab is the popup's chrome-extension URL, so the code must fall back through `lastFocusedWindow` and ultimately scan all tabs, ignoring any `chrome-extension://` URLs.
- Implemented `getActiveContentTab()` in `App.redesigned.tsx` that queries `currentWindow` → `lastFocusedWindow` → all active tabs → all tabs, and picks the first non-extension URL.

### MultiSelect footer + E2E click
- The MultiSelect component originally rendered `<li>` rows with a checkmark SVG and no footer. The E2E test expected checkbox inputs and a "Selected: ..." footer, so both were added:
  - Footer: `selectedSummary` derived from selected values + option labels; rendered as `data-testid="{testId}-footer"`.
  - E2E: click the `<li>` option row directly (the component toggles on `li` click); no checkbox input exists.
