// build-firefox — transform the Chrome dist/ build into a Firefox-installable
// dist-firefox/ per docs/specs/firefox-port.md (REQ-1).
//
// Reads the emitted (post-crxjs) dist/manifest.json so hashed asset names are
// preserved. Fails loud with named errors on unexpected manifest shape.

import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
