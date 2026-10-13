import { sleep } from '../lib/rdp.mjs';

export const name = 'detection-determinism';

export async function run(ctx) {
  const { rdp, extensionId, youtubeVideo, bgConsole } = ctx;

  const watchUrl = `https://www.youtube.com/watch?v=${youtubeVideo}`;
  if (bgConsole) {
    // Fresh profiles hit YouTube's consent interstitial — seed SOCS to accept.
    await rdp.evalAsync(
      bgConsole,
      `chrome.cookies.set({ url: 'https://www.youtube.com/', name: 'SOCS', value: 'CAE', domain: '.youtube.com', path: '/', secure: true }).then((c) => ({ ok: !!c })).catch((e) => ({ err: String(e && e.message || e) }))`,
      15000,
    );
    const ensured = await rdp.evalAsync(
      bgConsole,
      `chrome.tabs.query({ url: '*://*.youtube.com/*' }).then((tabs) => {
        const existing = tabs.find((t) => String(t.url || '').includes('watch'));
        if (existing) return chrome.tabs.update(existing.id, { url: '${watchUrl}' }).then(() => ({ nav: 'updated', id: existing.id }));
        const any = tabs[0];
        if (any) return chrome.tabs.update(any.id, { url: '${watchUrl}' }).then(() => ({ nav: 'updated', id: any.id }));
        return chrome.tabs.create({ url: '${watchUrl}', active: true }).then((t) => ({ nav: 'created', id: t.id }));
      }).catch((e) => ({ err: String(e && e.message || e) }))`,
      30000,
    );
    console.log(`  youtube tab: ${JSON.stringify(ensured)}`);
    if (ensured?.err) return { pass: false, detail: `cannot ensure youtube tab: ${ensured.err}` };
  }

  const found = await rdp.findContentScript('youtube.com/watch', extensionId, 90000);
  if (!found) return { pass: false, detail: 'no top-frame content script on youtube watch' };
  const cs = found.consoleActor;
  await rdp.installSendBg(cs);

  const pollDet = async (label) => {
    const det = await rdp.evalAsync(
      cs,
      `__sendBg({ type: 'GET_DETECTED_MEDIA', payload: {} }).then((v) => ({ subs: v?.data?.subtitles?.length, vids: v?.data?.videos?.length })).catch((e) => ({ err: String(e && e.message || e) }))`,
      20000,
    );
    console.log(`  ${label}: ${JSON.stringify(det)}`);
    return det;
  };

  const pageState = () =>
    rdp.evalAsync(cs, `(() => {
      const ypr = window.ytInitialPlayerResponse;
      return { playable: ypr?.playabilityStatus?.status ?? null, reason: ypr?.playabilityStatus?.reason ?? null, tracks: ypr?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length ?? 0, hasYpr: !!ypr };
    })()`);

  let d1 = null;
  let page = null;
  let unplayableStreak = 0;
  const detDeadline = Date.now() + 120000;
  while (Date.now() < detDeadline) {
    await rdp.evalOn(cs, `window.postMessage({ type: '__YT_CS_READY', time: Date.now() }, '*'); 'x'`);
    await sleep(4000);
    d1 = await pollDet('detection poll');
    if ((d1?.subs ?? 0) > 0) break;
    page = await pageState();
    unplayableStreak = page?.hasYpr === false || page?.playable === null ? unplayableStreak + 1 : 0;
    if (unplayableStreak >= 3) break;
  }
  if (!((d1?.subs ?? 0) > 0)) {
    page = page ?? (await pageState());
    if (!page?.playable) {
      // Fresh web-ext profiles hit YouTube's bot/consent wall — an environment
      // limit, not a product failure. The local determinism spec covers the
      // same onHistoryStateUpdated path offline.
      return { skipped: true, detail: `youtube unplayable in this profile; page=${JSON.stringify(page)}` };
    }
    return { pass: false, detail: `detection never landed within 120s; page=${JSON.stringify(page)}` };
  }

  await rdp.evalOn(cs, `history.replaceState({}, '', location.pathname + location.search + '&t=42s'); 'x'`);
  await sleep(4000);
  const d2 = await pollDet('after &t= replaceState');
  if (!((d2?.subs ?? 0) > 0)) return { pass: false, detail: 'cosmetic &t= replaceState wiped detected media' };

  await rdp.evalOn(cs, `history.pushState({}, '', '/watch?v=Tihoka_E2E_OTHER_VID'); 'x'`);
  await sleep(4000);
  const d3 = await pollDet('after ?v= pushState');
  if ((d3?.subs ?? 0) !== 0) return { pass: false, detail: 'real ?v= switch did not clear stale media' };

  return { pass: true, detail: `subs=${d1.subs} preserved through &t=, cleared on ?v=` };
}
