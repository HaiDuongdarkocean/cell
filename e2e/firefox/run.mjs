import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { RdpClient, sleep } from './lib/rdp.mjs';
import { launchWebExt, killTree } from './lib/launch.mjs';
import { serveHlsFixture } from './lib/serve-hls.mjs';

const EXTENSION_ID = 'tihoka@the0cean.dev';
const DEFAULT_YT_VIDEO = 'RoBabfioVF8';

const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const attachPort = arg('rdp-port') ? Number(arg('rdp-port')) : null;
const youtubeVideo = arg('youtube-video') ?? DEFAULT_YT_VIDEO;
const onlySpec = arg('spec');

const specDir = join(fileURLToPath(new URL('.', import.meta.url)), 'specs');
const specFiles = (await readdir(specDir)).filter((f) => f.endsWith('.spec.mjs') && (!onlySpec || f === `${onlySpec}.spec.mjs`));
if (specFiles.length === 0) {
  console.error(`no specs matched (dir: ${specDir}, filter: ${onlySpec ?? 'none'})`);
  process.exit(1);
}

let proc = null;
let procLogs = [];
let hls = null;
let rdp = null;
let exitCode;

try {
  hls = await serveHlsFixture();
  const hlsUrl = `http://127.0.0.1:${hls.port}/`;
  console.log(`[firefox-e2e] hls fixture on :${hls.port}`);

  if (attachPort) {
    console.log(`[firefox-e2e] attaching to existing Firefox on rdp :${attachPort}`);
    rdp = await RdpClient.connect(attachPort);
  } else {
    const ytUrl = `https://www.youtube.com/watch?v=${youtubeVideo}`;
    console.log(`[firefox-e2e] launching web-ext (start: ${ytUrl})`);
    const launched = await launchWebExt({ startUrl: ytUrl });
    proc = launched.proc;
    procLogs = launched.logs;
    rdp = await RdpClient.connect(launched.rdpPort);
  }

  const addon = await rdp.waitForAddon(EXTENSION_ID, 60000);
  if (!addon) throw new Error(`addon ${EXTENSION_ID} not installed`);
  console.log(`[firefox-e2e] addon installed`);

  const anyCs = await rdp.findAnyContentScript(EXTENSION_ID, 60000);
  if (anyCs) {
    await rdp.installSendBg(anyCs.consoleActor);
    await rdp.evalAsync(anyCs.consoleActor, `__sendBg({ type: 'GET_DETECTED_MEDIA', payload: {} }).then(() => 'awake').catch(() => 'asleep')`, 30000);
  }
  await sleep(5000);

  const bgConsole = await rdp.getBackgroundConsole(addon, 20000);
  console.log(`[firefox-e2e] bg console: ${bgConsole ? 'attached' : 'UNAVAILABLE'}`);

  const ctx = { rdp, extensionId: EXTENSION_ID, bgConsole, hlsUrl, hlsPort: hls.port, youtubeVideo };
  const results = [];
  for (const file of specFiles) {
    const spec = await import(pathToFileURL(join(specDir, file)).href);
    console.log(`\n[firefox-e2e] spec: ${spec.name ?? file}`);
    const startedAt = Date.now();
    try {
      const r = await spec.run(ctx);
      results.push({ name: spec.name ?? file, ...r, ms: Date.now() - startedAt });
    } catch (e) {
      results.push({ name: spec.name ?? file, pass: false, detail: `threw: ${e?.message ?? e}`, ms: Date.now() - startedAt });
    }
    const last = results[results.length - 1];
    const status = last.skipped ? 'SKIP' : last.pass ? 'PASS' : 'FAIL';
    console.log(`[firefox-e2e] ${status} ${last.name} (${(last.ms / 1000).toFixed(0)}s) — ${last.detail}`);
  }

  const failed = results.filter((r) => !r.pass && !r.skipped);
  const skipped = results.filter((r) => r.skipped);
  console.log(`\n[firefox-e2e] ${results.length - failed.length - skipped.length}/${results.length} passed, ${skipped.length} skipped, ${failed.length} failed`);
  exitCode = failed.length ? 1 : 0;
} catch (e) {
  console.error(`[firefox-e2e] fatal: ${e?.message ?? e}`);
  if (procLogs.length) console.error(`[firefox-e2e] web-ext output:\n${procLogs.join('').slice(-1500)}`);
  exitCode = 1;
} finally {
  rdp?.close();
  if (proc) killTree(proc);
  hls?.server.close();
  await sleep(500);
}

process.exit(exitCode);
