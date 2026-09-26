import { sleep } from '../lib/rdp.mjs';

export const name = 'detection-determinism-local';

export async function run(ctx) {
  const { rdp, bgConsole, hlsUrl } = ctx;
  if (!bgConsole) return { pass: false, detail: 'no background console — event page unreachable' };

  const newTab = await rdp.evalAsync(
    bgConsole,
    `chrome.tabs.create({ url: '${hlsUrl}?v=1', active: false }).then((t) => ({ id: t.id })).catch((e) => ({ err: String(e) }))`,
    30000,
  );
  if (!newTab?.id) return { pass: false, detail: `tabs.create failed: ${JSON.stringify(newTab)}` };
  console.log(`  spa tab: ${newTab.id} (${hlsUrl}?v=1)`);

  const videoCount = () =>
    rdp.evalAsync(
      bgConsole,
      `chrome.storage.session.get('session_media').then((o) => {
        const e = (o.session_media ?? {})['${newTab.id}'] ?? {};
        return (e.videos ?? []).length;
      }).catch(() => -1)`,
      30000,
    );

  const waitCount = async (want, ms) => {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      const n = await videoCount();
      if (want === 'gt0' ? n > 0 : n === 0) return n;
      await sleep(2000);
    }
    return await videoCount();
  };

  const initial = await waitCount('gt0', 60000);
  console.log(`  detected videos: ${initial}`);
  if (!(initial > 0)) {
    return { pass: false, detail: 'hls media never detected on spa fixture tab' };
  }

  // history.replaceState/pushState from the content-script world still drive
  // the shared document History — webNavigation sees them either way.
  const cs = await rdp.findContentScript('127.0.0.1', ctx.extensionId, 20000);
  if (!cs) return { pass: false, detail: 'no content script on fixture tab' };

  await rdp.evalOn(cs.consoleActor, `history.replaceState(null, '', '?v=1&t=99s'); 'ok'`, 15000);
  const afterAppend = await waitCount('gt0', 15000);
  console.log(`  after replaceState(&t=): videos=${afterAppend}`);
  if (!(afterAppend > 0)) {
    return { pass: false, detail: 'cosmetic &t= rewrite wiped detected media' };
  }

  await rdp.evalOn(cs.consoleActor, `history.pushState(null, '', '?v=2'); 'ok'`, 15000);
  const afterSwitch = await waitCount('eq0', 15000);
  console.log(`  after pushState(?v=2): videos=${afterSwitch}`);
  if (afterSwitch !== 0) {
    return { pass: false, detail: `real ?v= media switch did not clear stale media (got ${afterSwitch})` };
  }

  return { pass: true, detail: 'append-only rewrite preserved, param-value switch cleared' };
}
