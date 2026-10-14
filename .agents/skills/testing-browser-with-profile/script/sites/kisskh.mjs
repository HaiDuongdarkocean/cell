// kisskh.do — split view on a flex-row player shell; responsive CSS can
// pin the shell position:fixed (.portrait) at narrow widths.
// Scenario: same portrait → landscape → back rotate as youtube.mjs.
// Usage: node script/sites/kisskh.mjs [--url <episode-url>]
import { connectBrowser, openPage, shot } from '../dbg/browser.mjs';
import { emulate, PORTRAIT, LANDSCAPE } from '../dbg/emulate.mjs';
import { waitForOverlay, toggleSplitView, isSplitViewOpen, dumpLayout } from '../dbg/steps.mjs';

const SLUG = 'kisskh';
const argUrl = process.argv.indexOf('--url');
const URL_EP = argUrl >= 0
  ? process.argv[argUrl + 1]
  : 'https://kisskh.do/Drama/Perfect-Crown/Episode-1?id=11923&ep=207851&page=0&pageSize=100';

const { session, ctx } = await connectBrowser();
const page = await openPage(ctx, 'kisskh.', { url: URL_EP, settleMs: 5000 });
await emulate(ctx, page, PORTRAIT);
await page.waitForSelector('video', { timeout: 30000 }).catch(() => {});

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
