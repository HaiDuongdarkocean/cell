# Testing Extension Browser — step detail & snippets

Reference for `testing-extension-browser`. Read the step you are on.

## Step 0: Contract

```text
Given: <exact starting state — page loaded, video playing, settings>
When: <exact user or system action — click, seek, dispatch event>
Then: <exact measurable DOM outcome — element count, text, class>
```

Example: `Given: video playing at t=190s, subtitle overlay visible / When: click word on target line / Then: #Tihoka-universal-panel-host shadow children > 2`.

Loop back: request vague → invoke `/pipeline-analyze` (interactive) on yourself; only ask the user if that fails.

## Step 1: Build

- Most tests: `npx vite build`. Dictionary-seed tests (popup, word status): `npx vite build --mode development` (copies `data/resource/` → `dist/seed/`).

**Guard:** exit 0 + `dist/manifest.json` exists (+`dist/seed/` when needed). Never launch with a stale build.

## Step 2: Pack .crx + clone profile

```powershell
python .agents\skills\testing-extension-browser\script\setup-Tihoka-profile.py
```

Flags: `--rebuild` (re-pack after build) · `--no-ublock` (almost never wanted) · `--keep-profile`.

From a test script, use the helper — do not spawn python by hand:

```js
import { prepareTihokaEnvironment } from '../.agents/skills/testing-extension-browser/script/launch-Tihoka-context.mjs';
const CLONE_PATH = await prepareTihokaEnvironment({ rebuild: true });
```

**Guard:** output shows `[OK] Packed Tihoka.crx` → `[OK] Packed ublock.crx` → `[OK] Cloned master → <clone>` → `CLONE_PATH=...`.

**Loop back:** `Pack failed` → missing `dist/` or `openssl` → Step 1. Missing `*-key.pem` → auto-generated once; copy from the main repo for stable extension IDs across worktrees. `data/extension/uBOLite` is gitignored — copy into fresh worktrees or uBlock won't pack.

## Step 3: Connect (Playwright persistent)

```ts
import { warmUpTihokaContext, launchTihokaContext } from '../.agents/skills/testing-extension-browser/script/launch-Tihoka-context.mjs';

await warmUpTihokaContext(CLONE_PATH);              // primes the clone
const context = await launchTihokaContext(CLONE_PATH); // headless by default
const page = await context.newPage();
```

The launcher loads Tihoka AND uBlock via `--load-extension=${DIST},${UBOLITE}` (comma-separated, same `--disable-extensions-except` list) with `channel: 'chromium'` (new headless supports extensions). Pass `{ headless: false }` only when a visible window is needed. On Windows the External Extensions JSON installs nothing — uBlock exists ONLY because of this flag.

**Guard:** context resolves; confirm via `chrome://extensions` or `fetchPatched: true` in `page.evaluate`. **Loop back:** profile locked → `context.close()` old, wait 3s, retry; Tihoka not listed → Step 2.

## Step 4: Navigate

```ts
await page.goto('https://...');
const result = await page.evaluate(() => ({
  fetchPatched: !!document.documentElement.getAttribute('data-tihoka-fetch-patched'),
  subtitleRoot: !!document.getElementById('Tihoka-subtitle-root'),
}));
await page.screenshot({ path: 'tmp/real-chrome/screenshot.png' });
```

Video: autoplay blocks `video.play()` from script — click play first, then seek:

```ts
await page.locator('.art-control-playAndPause').click();
await page.evaluate(() => { const v = document.querySelector('video'); if (v) v.currentTime = 190; });
```

Shadow DOM inspection — guard `hasShadow: true` before reading children:

```js
(() => {
  const root = document.querySelector('#Tihoka-subtitle-root');
  const sr = root?.shadowRoot;
  const target = sr?.querySelector('[data-role="target"] span');
  return { hasRoot: !!root, hasShadow: !!sr, targetText: target?.textContent };
})()
```

## Step 5: Trigger — dispatch click on a shadow element

`webTriggerController` listens to `mouseup` on `document`; shadow events need `composed: true` to escape:

```js
(() => {
  const target = document.querySelector('#Tihoka-subtitle-root')?.shadowRoot
    ?.querySelector('[data-role="target"] span');
  const rect = target.getBoundingClientRect();
  document.dispatchEvent(new MouseEvent('mouseup', {
    bubbles: true, composed: true,
    clientX: rect.left + rect.width / 3, clientY: rect.top + rect.height / 2,
  }));
  return { dispatched: true };
})()
```

**Loop back:** target text empty → cue not active → seek elsewhere.

## Step 6: Verify

```js
(() => {
  const panel = document.querySelector('#Tihoka-universal-panel-host');
  return { totalEls: panel?.shadowRoot?.querySelectorAll('*').length };
})()
```

`totalEls > 2` = pass (`=== 2` = only style + empty div). Repeat trigger+verify 2–3×.

**Loop back:** fails → capture evidence → invoke `/debugging-and-error-recovery`.

## Step 7: Cleanup

```ts
await context.close();
fs.rmSync(CLONE_PATH, { recursive: true, force: true }); // unless inspecting
```

## Evidence capture (on failure — before changing anything)

```text
Known facts:
- Build: <dist/manifest.json timestamp>
- Clone: <Tihoka-<uuid> path>
- Page: <URL + title>
- Target: <selector + text + bounding rect>
- Trigger: <what was dispatched/clicked>
- Result: <counts, errors, nulls>

Guesses:
-  ← test this
```

Do not re-launch until the board has more facts than guesses.
