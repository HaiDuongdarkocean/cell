// m.youtube.com — split view on a position:fixed sticky player.
// Scenario: open split view in portrait → rotate to landscape → rotate back.
// Usage: node script/sites/youtube.mjs [--url <watch-url>]
import { connectBrowser, openPage, shot } from '../dbg/browser.mjs';
import { emulate, PORTRAIT, LANDSCAPE } from '../dbg/emulate.mjs';
import { waitForOverlay, toggleSplitView, isSplitViewOpen, dumpLayout } from '../dbg/steps.mjs';

const SLUG = 'youtube';
const argUrl = process.argv.indexOf('--url');
const URL_WATCH = argUrl >= 0
  ? process.argv[argUrl + 1]
  : 'https://m.youtube.com/watch?v=lY2yjAdbvdQ';

const { session, ctx } = await connectBrowser();
const page = await openPage(ctx, 'youtube.com/watch', { url: URL_WATCH });
await emulate(ctx, page, PORTRAIT);
await page.waitForTimeout(5000); // YouTube SPA + InnerTube detect settle

if (!await waitForOverlay(page)) {
  console.log('FAIL overlay never mounted — check /json for the extension SW');
  process.exit(1);
}
if (!await isSplitViewOpen(page)) await toggleSplitView(page);

for (const [tag, dims] of [['01-portrait', PORTRAIT], ['02-landscape', LANDSCAPE], ['03-back', PORTRAIT]]) {
  await emulate(ctx, page, dims);
  await page.waitForTimeout(1500);
  console.log(tag.toUpperCase(), JSON.stringify(await dumpLayout(page, tag)));
  await shot(page, session, `${SLUG}-${tag}.png`);
}
process.exit(0);
