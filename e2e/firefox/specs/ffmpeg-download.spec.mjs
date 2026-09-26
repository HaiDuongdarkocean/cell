import { sleep } from '../lib/rdp.mjs';

export const name = 'ffmpeg-transmux-download';

export async function run(ctx) {
  const { rdp, extensionId, bgConsole, hlsUrl } = ctx;
  if (!bgConsole) return { pass: false, detail: 'no background console — event page unreachable' };

  const newTab = await rdp.evalAsync(
    bgConsole,
    `chrome.tabs.create({ url: '${hlsUrl}', active: false }).then((t) => ({ id: t.id })).catch((e) => ({ err: String(e) }))`,
    30000,
  );
  if (!newTab?.id) return { pass: false, detail: `tabs.create failed: ${JSON.stringify(newTab)}` };
  console.log(`  hls tab: ${newTab.id} (${hlsUrl})`);

  const found = await rdp.findContentScript('127.0.0.1', extensionId, 30000);
  if (!found) return { pass: false, detail: 'no content script on the hls tab' };
  const cs = found.consoleActor;
  await rdp.installSendBg(cs);
  await sleep(8000);

  // GET_DETECTED_MEDIA from a CS cannot name a tab (messageBus rewrites
  // payload.tabId to sender.tab.id and empty payloads fall back to the
  // active tab) — read the session mirror via the bg console instead.
  const det = await rdp.evalAsync(
    bgConsole,
    `chrome.storage.session.get('session_media').then((o) => {
      const e = (o.session_media ?? {})['${newTab.id}'] ?? {};
      return { vids: (e.videos ?? []).map((x) => ({ id: x.id, url: x.url, fmt: x.format })) };
    }).catch((e) => ({ err: String(e) }))`,
    30000,
  );
  console.log(`  detected: ${JSON.stringify(det)}`);
  const hls = (det?.vids ?? []).find((v) => String(v.url).includes(`:${ctx.hlsPort}`));
  if (!hls) return { pass: false, detail: 'hls playlist was not detected by webRequest interceptor' };

  await rdp.evalOn(
    bgConsole,
    `(() => {
      globalThis.__dlLog = [];
      const orig = chrome.downloads.download.bind(chrome.downloads);
      chrome.downloads.download = (o) => { globalThis.__dlLog.push({ t: Date.now(), filename: o.filename }); return orig(o); };
      return 'armed';
    })()`,
    15000,
  );

  const dl1 = await rdp.evalAsync(
    cs,
    `__sendBg({ type: 'DOWNLOAD_VIDEO', payload: { videoId: '${hls.id}' } }).then((v) => ({ ok: v?.success, id: v?.data?.id, err: v?.error })).catch((e) => ({ err: String(e && e.message || e) }))`,
    30000,
  );
  const dl2 = await rdp.evalAsync(
    cs,
    `__sendBg({ type: 'DOWNLOAD_VIDEO', payload: { videoId: '${hls.id}' } }).then((v) => ({ ok: v?.success, id: v?.data?.id, err: v?.error })).catch((e) => ({ err: String(e && e.message || e) }))`,
    30000,
  );
  console.log(`  enqueued: ${JSON.stringify(dl1)} ${JSON.stringify(dl2)}`);
  if (!dl1?.ok || !dl2?.ok) return { pass: false, detail: 'DOWNLOAD_VIDEO enqueue failed' };

  const ids = [dl1.id, dl2.id];
  let finalItems = null;
  const deadline = Date.now() + 300000;
  while (Date.now() < deadline) {
    const prog = await rdp.evalAsync(
      cs,
      `__sendBg({ type: 'GET_DOWNLOAD_PROGRESS' }).then((v) => (v?.data?.downloads ?? []).map((d) => ({ id: d.id, status: d.status, progress: d.progress, phase: d.conversionPhase, err: d.error }))).catch((e) => ({ err: String(e && e.message || e) }))`,
      30000,
    );
    const ours = Array.isArray(prog) ? prog.filter((d) => ids.includes(d.id)) : [];
    console.log(`  progress: ${JSON.stringify(ours)}`);
    const finished = ours.filter((d) => ['done', 'error'].includes(d.status));
    if (ours.length >= 2 && finished.length >= 2) {
      finalItems = ours;
      break;
    }
    await sleep(3000);
  }
  if (!finalItems) return { pass: false, detail: 'timed out waiting for downloads (5 min)' };
  if (!finalItems.every((d) => d.status === 'done')) {
    return { pass: false, detail: `items not done: ${JSON.stringify(finalItems)}` };
  }

  const files = await rdp.evalAsync(
    bgConsole,
    `chrome.downloads.search({}).then((items) => items.map((i) => ({ id: i.id, state: i.state, filename: i.filename, bytes: i.fileSize, mime: i.mime, error: i.error }))).catch((e) => ({ err: String(e) }))`,
    30000,
  );
  console.log(`  downloads.search: ${JSON.stringify(files)}`);
  const dlLog = await rdp.evalAsync(bgConsole, `globalThis.__dlLog ?? []`, 15000);
  console.log(`  download() calls: ${JSON.stringify(dlLog)}`);
  const completeMp4 = Array.isArray(files) ? files.filter((i) => i.state === 'complete' && /\.mp4$/.test(i.filename)) : [];
  if (completeMp4.length < 2) return { pass: false, detail: `expected >=2 complete mp4 downloads, got ${completeMp4.length}` };

  return { pass: true, detail: `2 concurrent downloads complete (${completeMp4.map((i) => i.bytes).join(' + ')} bytes)` };
}
