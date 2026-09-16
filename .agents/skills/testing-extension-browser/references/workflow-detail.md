# Testing Extension Browser — step detail & snippets

Reference for `testing-extension-browser`. Read the step you are on.

## Step 0: Contract

```text
Given: <exact starting state — page loaded, video playing, settings>
When: <exact user or system action — click, seek, dispatch event>
Then: <exact measurable DOM outcome — element count, text, class>
```

Example:

```text
Given: themoviebox.org video playing at t=190s, subtitle overlay visible, tokenize OFF
When: click word on subtitle target line
Then: #cell-universal-panel-host shadow children > 2 (popup opened)
```

Loop back: request is vague → invoke `/interview-me` on yourself; only ask the user if that fails.

## Step 1: Build

- Most tests: `npx vite build` (or `npm run build`).
- Tests needing the bundled dictionary/frequency seed (dictionary popup, word status): `npx vite build --mode development` — copies `data/resource/` into `dist/seed/` for auto-seed.
- Confirm the build-completed line appears.

Guard: exit 0 + `dist/manifest.json` exists (+ `dist/seed/` when dev build needed). Build fails → fix first; never launch with a stale build.

## Step 2: Pack .crx + clone profile

```powershell
python .agents\skills\testing-extension-browser\script\setup-cell-profile.py
```

Flags: `--rebuild` (re-pack .crx after `npm run build`) · `--no-ublock` (skip — almost never wanted) · `--keep-profile`

From a test script, use the shared helper instead of spawning python by hand:

```js
import { prepareCellEnvironment } from '../.agents/skills/testing-extension-browser/script/launch-cell-context.mjs';
const CLONE_PATH = await prepareCellEnvironment({ rebuild: true });
```

Guard: script prints `[OK] Packed cell.crx` → `[OK] Packed ublock.crx` → `[OK] Cloned master → <clone>` → `CLONE_PATH=...`.

Loop back: `Pack failed` → `dist/` missing or `openssl` not in PATH → back to Step 1. `cell-key.pem`/`ublock-key.pem` missing → auto-generated once; copy them from the main repo to keep stable extension IDs across worktrees. `data/extension/uBOLite` is gitignored — copy it into fresh worktrees or uBlock will not pack.

## Step 3: Connect (Playwright)

Always go through the shared launcher — it loads Cell AND uBlock together and primes the clone:

```ts
import { warmUpCellContext, launchCellContext } from '../.agents/skills/testing-extension-browser/script/launch-cell-context.mjs';

await warmUpCellContext(CLONE_PATH);              // primes the clone
const context = await launchCellContext(CLONE_PATH);
const page = await context.newPage();
```

What it does under the hood (do not re-implement per script):

```ts
chromium.launchPersistentContext(CLONE_PATH, {
  headless: true,
  channel: 'chromium',                           // new headless — required for --load-extension
  ignoreDefaultArgs: ['--disable-extensions'],
  args: [
    '--disable-blink-features=AutomationControlled',
    `--disable-extensions-except=${DIST},${UBOLITE}`,
    `--load-extension=${DIST},${UBOLITE}`,        // comma-separated — uBlock only loads this way
  ],
});
```

Default is headless — no window pops during load/test. Pass `{ headless: false }` to `launchCellContext` only when a visible window is genuinely needed (it then uses `executablePath: CHROME_EXE`).

On Windows the External Extensions JSON from Step 2 installs nothing (`external_crx` blocked) — uBlock exists ONLY because it is passed to `--load-extension`.

Guard: `launchPersistentContext` resolves; then navigate `chrome://extensions/` and confirm Cell is listed, or check `fetchPatched: true` via `page.evaluate`.

Loop back: profile locked → `context.close()` on the old context, wait 3s, retry. Cell not listed → re-run Step 2.

## Step 4: Navigate (Playwright)

```ts
await page.goto('https://...');
await page.locator('[data-cell-id="orbital-badge"]').click();
const result = await page.evaluate(() => ({
  fetchPatched: !!document.documentElement.getAttribute('data-cell-fetch-patched'),
  subtitleRoot: !!document.getElementById('cell-subtitle-root'),
}));
await page.screenshot({ path: 'tmp/real-chrome/screenshot.png' });
```

### Video playback

Autoplay policy blocks `video.play()` from script — click play first:

```ts
await page.locator('.art-control-playAndPause').click();
```

Then seek:

```ts
await page.evaluate(() => {
  const v = document.querySelector('video');
  if (v) v.currentTime = 190;
  return { time: v?.currentTime };
});
```

### Shadow DOM inspection

```js
(() => {
  const root = document.querySelector('#cell-subtitle-root');
  const sr = root?.shadowRoot;
  const target = sr?.querySelector('[data-role="target"] span');
  return { hasRoot: !!root, hasShadow: !!sr, targetText: target?.textContent };
})()
```

Guard: `hasShadow: true` before inspecting shadow children.

## Step 5: Trigger — dispatch click on a shadow DOM element

`webTriggerController` listens to `mouseup` on `document`. Shadow events need `composed: true` to bubble out:

```js
(() => {
  const root = document.querySelector('#cell-subtitle-root');
  const target = root?.shadowRoot?.querySelector('[data-role="target"] span');
  const rect = target.getBoundingClientRect();
  const cx = rect.left + rect.width / 3;
  const cy = rect.top + rect.height / 2;
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true, clientX: cx, clientY: cy }));
  return { dispatched: true, cx: Math.round(cx), cy: Math.round(cy) };
})()
```

Loop back: target text empty → cue not active → seek to a different timestamp.

## Step 6: Verify — popup opened

```js
(() => {
  const panel = document.querySelector('#cell-universal-panel-host');
  const allEls = panel?.shadowRoot?.querySelectorAll('*');
  return { totalEls: allEls?.length };
})()
```

Pass: `totalEls > 2`. Fail: `totalEls === 2` (only style + empty div). Repeat trigger + verify 2–3×.

Loop back: verify fails → capture evidence (DOM snapshot, element count) → invoke `/debugging-and-error-recovery`.

## Step 7: Cleanup

```ts
await context.close();
// Remove the clone unless you need to inspect it
fs.rmSync(CLONE_PATH, { recursive: true, force: true });
```

## Evidence capture template

When a test fails, capture before changing anything:

```text
Known facts:
- Build: <timestamp of dist/manifest.json>
- Clone: <cell-<uuid> path>
- Page: <URL + title>
- Target element: <selector + text + bounding rect>
- Trigger: <what was dispatched/clicked>
- Result: <totalEls count, error, null, etc.>

Guesses / theories:
-  ← test this
-  ← test this
```

Do not re-launch until the board has more facts than guesses.

## Example — dictionary popup on subtitle target

1. `npx vite build`
2. `const CLONE_PATH = await prepareCellEnvironment({ rebuild: true })` (packs Cell + uBlock, clones master)
3. `await warmUpCellContext(CLONE_PATH)` → `const context = await launchCellContext(CLONE_PATH)` (loads Cell + uBlock via `--load-extension`)
4. `await page.goto(url)` → `await page.locator('.art-control-playAndPause').click()` → `await page.evaluate(() => { const v = document.querySelector('video'); if (v) v.currentTime = 190; })`
5. `await page.evaluate(() => { /* dispatch mouseup composed:true at target span coords */ })`
6. `await page.evaluate(() => { const panel = document.querySelector('#cell-universal-panel-host'); const allEls = panel?.shadowRoot?.querySelectorAll('*'); return { totalEls: allEls?.length }; })` → `totalEls > 2 = PASS`
7. `await context.close();` → `fs.rmSync(CLONE_PATH, { recursive: true, force: true })`
