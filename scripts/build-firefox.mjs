// build-firefox — transform the Chrome dist/ build into a Firefox-installable
// dist-firefox/ per docs/specs/firefox-port.md (REQ-1).
//
// Reads the emitted (post-crxjs) dist/manifest.json so hashed asset names are
// preserved. Fails loud with named errors on unexpected manifest shape.

import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const DIST = join(root, 'dist');
const OUT = join(root, 'dist-firefox');

const GECKO_ID = 'tihoka@the0cean.dev';
const MIN_FIREFOX = '128.0';
const CHROME_ONLY_PERMISSIONS = new Set(['offscreen', 'sidePanel', 'tts']);
const FIREFOX_BACKGROUND_PAGE = 'firefox-background.html';

function fail(message) {
  console.error(`build-firefox: ${message}`);
  process.exit(1);
}

if (!existsSync(join(DIST, 'manifest.json'))) {
  fail('dist/manifest.json missing — run `npm run build` first');
}

const manifest = JSON.parse(readFileSync(join(DIST, 'manifest.json'), 'utf8'));

const serviceWorker = manifest.background?.service_worker;
if (typeof serviceWorker !== 'string' || serviceWorker.length === 0) {
  fail('dist/manifest.json missing background.service_worker — unexpected crxjs output');
}
if (!existsSync(join(DIST, serviceWorker))) {
  fail(`emitted service worker file not found in dist/: ${serviceWorker}`);
}

manifest.background = { page: FIREFOX_BACKGROUND_PAGE, persistent: false };

delete manifest.side_panel;
delete manifest.key;

if (!Array.isArray(manifest.permissions)) {
  fail('dist/manifest.json missing permissions array');
}
manifest.permissions = manifest.permissions.filter((p) => !CHROME_ONLY_PERMISSIONS.has(p));

if (!manifest.permissions.includes('webRequestBlocking')) {
  manifest.permissions.push('webRequestBlocking');
}

manifest.browser_specific_settings = {
  gecko: {
    id: GECKO_ID,
    strict_min_version: MIN_FIREFOX,
    // Required by AMO for all new extensions (web-ext lint
    // MISSING_DATA_COLLECTION_PERMISSIONS). "none" = no required data
    // collection — Tihoka writes to local disk/localhost only; confirm this
    // declaration still holds when submitting for listing.
    data_collection_permissions: { required: ['none'] },
  },
};

for (const cs of manifest.content_scripts ?? []) {
  delete cs.match_origin_as_fallback;
}
for (const war of manifest.web_accessible_resources ?? []) {
  delete war.use_dynamic_url;
}

// Firefox MV3 rejects the whole extension_pages CSP if script-src contains
// sources outside 'self'/'none'/'wasm-unsafe-eval'/localhost, or if connect-src
// carries the bare insecure `http:` scheme — either way the default policy
// applies. Host-scoped localhost sources (AnkiConnect on 127.0.0.1:8765, local
// dev servers) stay allowed; `data:` covers OpenCV's WASM fetch.
const csp = manifest.content_security_policy?.extension_pages;
if (typeof csp === 'string' && csp.includes('connect-src')) {
  manifest.content_security_policy.extension_pages = csp.replace(
    /connect-src\s+[^;]*/,
    "connect-src 'self' https: data: http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*",
  );
}

rmSync(OUT, { recursive: true, force: true });
cpSync(DIST, OUT, { recursive: true });

// AMO refuses to parse JS files over ~5MB (FILE_TOO_LARGE).
// worker-entry-*.js + worker-entry.js: PaddleOCR worker-mode bundle — dead
// weight here because the engine never enables worker mode (no `worker`
// option → PaddleOCR resolveWorkerOptions() returns enabled:false), and the
// unhashed copy is not referenced at all. Chrome dist/ keeps them.
const outAssets = join(OUT, 'assets');
for (const entry of readdirSync(outAssets)) {
  if (/^worker-entry(-.*)?\.js$/.test(entry)) rmSync(join(outAssets, entry));
}

// opencv.js: ~10MB because Emscripten embeds the wasm as a base64 data URI.
// Extract it to assets/opencv.wasm (binary — exempt from the JS parse limit)
// and repoint the minified wasmBinaryFile literal at a sibling URL.
const opencvPath = join(outAssets, 'opencv.js');
const opencvSrc = readFileSync(opencvPath, 'utf8');
const dataUriPrefix = '`data:application/octet-stream;base64,';
const wasmLiteralStart = opencvSrc.indexOf(dataUriPrefix, opencvSrc.indexOf(dataUriPrefix) + 1);
if (wasmLiteralStart === -1) {
  fail('dist/assets/opencv.js embedded wasm payload not found — opencv-js output changed');
}
const wasmLiteralEnd = opencvSrc.indexOf('`', wasmLiteralStart + dataUriPrefix.length);
if (wasmLiteralEnd === -1 || wasmLiteralEnd - wasmLiteralStart < 100_000) {
  fail('dist/assets/opencv.js wasm payload literal malformed');
}
writeFileSync(
  join(outAssets, 'opencv.wasm'),
  Buffer.from(opencvSrc.slice(wasmLiteralStart + dataUriPrefix.length, wasmLiteralEnd), 'base64'),
);
writeFileSync(
  opencvPath,
  `${opencvSrc.slice(0, wasmLiteralStart)}new URL(\`opencv.wasm\`,import.meta.url).href${opencvSrc.slice(wasmLiteralEnd + 1)}`,
  'utf8',
);

const bootstrapScript = 'firefox-background-bootstrap.js';
writeFileSync(
  join(OUT, bootstrapScript),
  [
    `window.addEventListener('error', (e) => console.error('[BG-BOOT]', e.message, e.filename, e.lineno));`,
    `window.addEventListener('unhandledrejection', (e) => {`,
    `  const r = e.reason;`,
    `  console.error('[BG-BOOT-REJECT]', r && r.message ? r.message : String(r), r && r.stack ? r.stack : '');`,
    `});`,
    `import('./${serviceWorker}')`,
    `  .then(() => console.log('[BG-BOOT] service-worker-loader imported'))`,
    `  .catch((e) => console.error('[BG-BOOT-IMPORT]', e && e.message ? e.message : String(e)));`,
    '',
  ].join('\n'),
);

writeFileSync(
  join(OUT, FIREFOX_BACKGROUND_PAGE),
  `<!doctype html>\n<html>\n<head>\n<meta charset="utf-8">\n<script src="${bootstrapScript}"></script>\n</head>\n<body></body>\n</html>\n`,
);
writeFileSync(join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`build-firefox: ${OUT} written (gecko.id=${GECKO_ID}, min=${MIN_FIREFOX})`);
