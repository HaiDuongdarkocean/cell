// en.wikipedia.org — non-video control page. No player, no overlay: the
// split-view step must not run and the page must be undamaged.
// Usage: node script/sites/wikipedia.mjs [--url <article-url>]
import { connectBrowser, openPage, shot } from '../dbg/browser.mjs';
import { emulate, PORTRAIT } from '../dbg/emulate.mjs';
import { waitForOverlay, isSplitViewOpen, dumpLayout } from '../dbg/steps.mjs';

const SLUG = 'wikipedia';
const argUrl = process.argv.indexOf('--url');
const URL_ARTICLE = argUrl >= 0
  ? process.argv[argUrl + 1]
  : 'https://en.wikipedia.org/wiki/Hello,_world';

const { session, ctx } = await connectBrowser();
const page = await openPage(ctx, 'wikipedia.org', { url: URL_ARTICLE, settleMs: 3000 });
await emulate(ctx, page, PORTRAIT);
await page.waitForTimeout(1000);

const overlayMounted = await waitForOverlay(page, 5000);
const splitOpen = await isSplitViewOpen(page);
console.log(JSON.stringify({ overlayMounted, splitOpen, layout: await dumpLayout(page, 'wiki') }));
await shot(page, session, `${SLUG}-01-portrait.png`);
process.exit(0);
