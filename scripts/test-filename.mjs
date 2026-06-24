// CLI stress test for filename resolution logic
// Run: node scripts/test-filename.mjs
// Tests: extractBaseNameFromUrl, beautifyUrlFilename, isTitleMeaningful, resolveFilenameBase

const GENERIC_TITLES = new Set([
  'video', 'untitled', 'unknown', 'media', 'movie', 'clip', 'stream', 'player',
  'video player', 'html5 video',
]);

function extractBaseNameFromUrl(url) {
  try {
    const path = new URL(url).pathname;
    const segments = path.split('/').filter((s) => s.length > 0);
    if (segments.length === 0) return 'media';
    const last = segments[segments.length - 1];
    const dot = last.lastIndexOf('.');
    if (dot > 0) segments[segments.length - 1] = last.slice(0, dot);
    return segments.join('/');
  } catch {
    return 'media';
  }
}

function beautifyUrlFilename(raw) {
  let decoded;
  try { decoded = decodeURIComponent(raw); } catch { decoded = raw; }
  decoded = decoded.split(/[?#]/)[0];
  decoded = decoded.replace(/(\w)-s-/g, "$1's-");
  decoded = decoded.replace(/(\w)-s$/g, "$1's");
  decoded = decoded.replace(/-{3,}/g, ' / ').replace(/-{2}/g, ' / ');
  let spaced = decoded.replace(/[-_.+]+/g, ' ');
  spaced = spaced.replace(/\//g, ' - ');
  spaced = spaced.replace(/\s+/g, ' ').trim();
  if (spaced.length === 0) return 'media';
  return spaced;
}

function isTitleMeaningful(title) {
  if (!title) return false;
  const trimmed = title.trim();
  if (trimmed.length < 3) return false;
  return !GENERIC_TITLES.has(trimmed.toLowerCase());
}

function sanitizeFileName(name) {
  return name.replace(/[<>:"/\\|?*]/g, '').replace(/ /g, '_');
}

function generateFileName(title, ext) {
  return `${sanitizeFileName(title)}.${ext}`;
}

function resolveFilenameBase(mode, title, url) {
  switch (mode) {
    case 'url-only':
      return beautifyUrlFilename(extractBaseNameFromUrl(url));
    case 'title-only':
      return isTitleMeaningful(title) ? title : 'untitled';
    case 'title-fallback':
    default:
      if (isTitleMeaningful(title)) return title;
      return beautifyUrlFilename(extractBaseNameFromUrl(url));
  }
}

// ============================================================
// STRESS TEST SUITE
// ============================================================

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(message);
    console.log(`  FAIL: ${message}`);
  }
}

function assertEqual(actual, expected, label) {
  const ok = actual === expected;
  if (ok) {
    passed++;
  } else {
    failed++;
    failures.push(`${label}: expected "${expected}", got "${actual}"`);
    console.log(`  FAIL: ${label}`);
    console.log(`    expected: "${expected}"`);
    console.log(`    actual:   "${actual}"`);
  }
}

// === extractBaseNameFromUrl ===
console.log('\n=== extractBaseNameFromUrl ===');

assertEqual(extractBaseNameFromUrl('https://kisskh.co/Drama/A-Good-Girl-s-Guide-to-Murder---Season-2/Episode-1?id=13070'), 'Drama/A-Good-Girl-s-Guide-to-Murder---Season-2/Episode-1', 'kisskh multi-segment');
assertEqual(extractBaseNameFromUrl('https://yanhh3d.ee/xuyen-khong/thon-phe-tinh-khong/tap-33.html'), 'xuyen-khong/thon-phe-tinh-khong/tap-33', 'yanhh3d multi-segment');
assertEqual(extractBaseNameFromUrl('https://example.com/video.m3u8'), 'video', 'single segment with ext');
assertEqual(extractBaseNameFromUrl('https://example.com/subtitle.ass'), 'subtitle', 'subtitle with ext');
assertEqual(extractBaseNameFromUrl('https://example.com/'), 'media', 'root path');
assertEqual(extractBaseNameFromUrl('https://example.com'), 'media', 'no path');
assertEqual(extractBaseNameFromUrl('not-a-url'), 'media', 'invalid url');
assertEqual(extractBaseNameFromUrl(''), 'media', 'empty string');
assertEqual(extractBaseNameFromUrl('https://cdn.example.com/a/b/c/'), 'a/b/c', 'trailing slash');
assertEqual(extractBaseNameFromUrl('https://example.com/playlist_1080p.m3u8'), 'playlist_1080p', 'underscore in name');
assertEqual(extractBaseNameFromUrl('https://example.com/file.with.dots.mp4'), 'file.with.dots', 'multiple dots');
assertEqual(extractBaseNameFromUrl('https://example.com/'), 'media', 'root only');

// === beautifyUrlFilename ===
console.log('\n=== beautifyUrlFilename ===');

assertEqual(beautifyUrlFilename('my_video_title_1080p'), 'my video title 1080p', 'underscores to spaces');
assertEqual(beautifyUrlFilename('A-Good-Girl-s-Guide-to-Murder---Season-2'), "A Good Girl's Guide to Murder - Season 2", 'smart apostrophe + triple dash');
assertEqual(beautifyUrlFilename('A-Good-Girl-s-Guide'), "A Good Girl's Guide", 'smart apostrophe mid-string');
assertEqual(beautifyUrlFilename('Girls-s-Guide'), "Girls's Guide", 'smart apostrophe plural possessive');
assertEqual(beautifyUrlFilename('tap-33'), 'tap 33', 'simple dash');
assertEqual(beautifyUrlFilename('thon-phe-tinh-khong'), 'thon phe tinh khong', 'multiple dashes');
assertEqual(beautifyUrlFilename('Drama/A-Good-Girl-s-Guide-to-Murder---Season-2/Episode-1'), "Drama - A Good Girl's Guide to Murder - Season 2 - Episode 1", 'full path with slash');
assertEqual(beautifyUrlFilename('xuyen-khong/thon-phe-tinh-khong/tap-33'), 'xuyen khong - thon phe tinh khong - tap 33', 'full path segments');
assertEqual(beautifyUrlFilename('video'), 'video', 'single word');
assertEqual(beautifyUrlFilename(''), 'media', 'empty string');
assertEqual(beautifyUrlFilename('Hero%20Movie%20Final'), 'Hero Movie Final', 'percent encoded spaces');
assertEqual(beautifyUrlFilename('file%2Ename'), 'file name', 'percent encoded dot');
assertEqual(beautifyUrlFilename('100%25-done'), '100% done', 'percent encoded percent');
assertEqual(beautifyUrlFilename('cafe-mocha--latte'), 'cafe mocha - latte', 'double dash');
assertEqual(beautifyUrlFilename('a---b---c'), 'a - b - c', 'triple dashes multiple');
assertEqual(beautifyUrlFilename('UPPER_CASE'), 'UPPER CASE', 'preserves case');
assertEqual(beautifyUrlFilename('mixedCaseString'), 'mixedCaseString', 'camelCase preserved');
assertEqual(beautifyUrlFilename('123_456_789'), '123 456 789', 'numbers with underscores');
assertEqual(beautifyUrlFilename('special.chars.here'), 'special chars here', 'dots to spaces');
assertEqual(beautifyUrlFilename('plus+signs+here'), 'plus signs here', 'plus to spaces');

// Invalid percent encoding (should not throw)
try {
  const result = beautifyUrlFilename('invalid%zz%encoding');
  assert(result.length > 0, 'invalid percent encoding does not throw');
  passed++;
} catch (e) {
  failed++;
  failures.push('invalid percent encoding threw: ' + e.message);
  console.log('  FAIL: invalid percent encoding threw');
}

// === isTitleMeaningful ===
console.log('\n=== isTitleMeaningful ===');

assert(isTitleMeaningful('Hero Movie') === true, 'normal title is meaningful');
assert(isTitleMeaningful('A Good Girl\'s Guide to Murder S2 EP1') === true, 'long title is meaningful');
assert(isTitleMeaningful('Thôn Phệ Tinh Không Tập 33') === true, 'unicode title is meaningful');
assert(isTitleMeaningful('video') === false, 'generic "video" is not meaningful');
assert(isTitleMeaningful('untitled') === false, 'generic "untitled" is not meaningful');
assert(isTitleMeaningful('unknown') === false, 'generic "unknown" is not meaningful');
assert(isTitleMeaningful('media') === false, 'generic "media" is not meaningful');
assert(isTitleMeaningful('movie') === false, 'generic "movie" is not meaningful');
assert(isTitleMeaningful('') === false, 'empty string is not meaningful');
assert(isTitleMeaningful(undefined) === false, 'undefined is not meaningful');
assert(isTitleMeaningful(null) === false, 'null is not meaningful');
assert(isTitleMeaningful('ab') === false, 'too short (< 3 chars) is not meaningful');
assert(isTitleMeaningful('abc') === true, 'exactly 3 chars is meaningful');
assert(isTitleMeaningful('  ') === false, 'whitespace only is not meaningful');
assert(isTitleMeaningful('  Hero  ') === true, 'padded title is meaningful');
assert(isTitleMeaningful('VIDEO') === false, 'uppercase generic is not meaningful');
assert(isTitleMeaningful('Video') === false, 'capitalized generic is not meaningful');

// === resolveFilenameBase ===
console.log('\n=== resolveFilenameBase ===');

const kisskhUrl = 'https://kisskh.co/Drama/A-Good-Girl-s-Guide-to-Murder---Season-2/Episode-1?id=13070&ep=214612';
const yanhhUrl = 'https://yanhh3d.ee/xuyen-khong/thon-phe-tinh-khong/tap-33.html';
const cdnUrl = 'https://cdn.example.com/playlist_1080p.m3u8';

// title-fallback mode
assertEqual(resolveFilenameBase('title-fallback', "A Good Girl's Guide to Murder S2 EP1", kisskhUrl), "A Good Girl's Guide to Murder S2 EP1", 'fallback: meaningful title used');
assertEqual(resolveFilenameBase('title-fallback', undefined, kisskhUrl), "Drama - A Good Girl's Guide to Murder - Season 2 - Episode 1", 'fallback: no title → URL beautified');
assertEqual(resolveFilenameBase('title-fallback', '', kisskhUrl), "Drama - A Good Girl's Guide to Murder - Season 2 - Episode 1", 'fallback: empty title → URL beautified');
assertEqual(resolveFilenameBase('title-fallback', 'video', kisskhUrl), "Drama - A Good Girl's Guide to Murder - Season 2 - Episode 1", 'fallback: generic title → URL beautified');
assertEqual(resolveFilenameBase('title-fallback', 'Thôn Phệ Tinh Không Tập 33', yanhhUrl), 'Thôn Phệ Tinh Không Tập 33', 'fallback: unicode title used');
assertEqual(resolveFilenameBase('title-fallback', undefined, yanhhUrl), 'xuyen khong - thon phe tinh khong - tap 33', 'fallback: yanhh URL beautified');
assertEqual(resolveFilenameBase('title-fallback', undefined, cdnUrl), 'playlist 1080p', 'fallback: CDN URL beautified');

// title-only mode
assertEqual(resolveFilenameBase('title-only', "A Good Girl's Guide to Murder S2 EP1", kisskhUrl), "A Good Girl's Guide to Murder S2 EP1", 'title-only: meaningful title used');
assertEqual(resolveFilenameBase('title-only', undefined, kisskhUrl), 'untitled', 'title-only: no title → untitled');
assertEqual(resolveFilenameBase('title-only', '', kisskhUrl), 'untitled', 'title-only: empty title → untitled');
assertEqual(resolveFilenameBase('title-only', 'video', kisskhUrl), 'untitled', 'title-only: generic title → untitled');
assertEqual(resolveFilenameBase('title-only', 'Thôn Phệ Tinh Không Tập 33', yanhhUrl), 'Thôn Phệ Tinh Không Tập 33', 'title-only: unicode title used');

// url-only mode
assertEqual(resolveFilenameBase('url-only', "A Good Girl's Guide to Murder S2 EP1", kisskhUrl), "Drama - A Good Girl's Guide to Murder - Season 2 - Episode 1", 'url-only: ignores title');
assertEqual(resolveFilenameBase('url-only', undefined, kisskhUrl), "Drama - A Good Girl's Guide to Murder - Season 2 - Episode 1", 'url-only: no title');
assertEqual(resolveFilenameBase('url-only', 'video', kisskhUrl), "Drama - A Good Girl's Guide to Murder - Season 2 - Episode 1", 'url-only: generic title ignored');
assertEqual(resolveFilenameBase('url-only', undefined, yanhhUrl), 'xuyen khong - thon phe tinh khong - tap 33', 'url-only: yanhh URL');
assertEqual(resolveFilenameBase('url-only', undefined, cdnUrl), 'playlist 1080p', 'url-only: CDN URL');

// === Full pipeline: resolveFilenameBase → generateFileName ===
console.log('\n=== Full pipeline (resolve + generate) ===');

assertEqual(generateFileName(resolveFilenameBase('title-fallback', "A Good Girl's Guide to Murder S2 EP1", kisskhUrl), 'mp4'), "A_Good_Girl's_Guide_to_Murder_S2_EP1.mp4", 'pipeline: title → mp4');
assertEqual(generateFileName(resolveFilenameBase('title-fallback', undefined, kisskhUrl), 'mp4'), "Drama_-_A_Good_Girl's_Guide_to_Murder_-_Season_2_-_Episode_1.mp4", 'pipeline: URL fallback → mp4');
assertEqual(generateFileName(resolveFilenameBase('title-fallback', undefined, kisskhUrl), 'srt'), "Drama_-_A_Good_Girl's_Guide_to_Murder_-_Season_2_-_Episode_1.srt", 'pipeline: URL fallback → srt');
assertEqual(generateFileName(resolveFilenameBase('url-only', undefined, yanhhUrl), 'mp4'), "xuyen_khong_-_thon_phe_tinh_khong_-_tap_33.mp4", 'pipeline: yanhh URL → mp4');
assertEqual(generateFileName(resolveFilenameBase('title-only', undefined, yanhhUrl), 'srt'), "untitled.srt", 'pipeline: no title → untitled.srt');
assertEqual(generateFileName(resolveFilenameBase('title-only', 'Thôn Phệ Tinh Không Tập 33', yanhhUrl), 'ts'), "Thôn_Phệ_Tinh_Không_Tập_33.ts", 'pipeline: unicode title → ts');

// === Edge cases ===
console.log('\n=== Edge cases ===');

// Very long URL
const longUrl = 'https://example.com/' + 'a'.repeat(200) + '/video.mp4';
assertEqual(extractBaseNameFromUrl(longUrl), 'a'.repeat(200) + '/video', 'long URL path');

// URL with port
assertEqual(extractBaseNameFromUrl('https://localhost:8080/stream/video.m3u8'), 'stream/video', 'URL with port');

// URL with auth
assertEqual(extractBaseNameFromUrl('https://user:pass@example.com/secret/video.mp4'), 'secret/video', 'URL with auth');

// URL with fragment
assertEqual(extractBaseNameFromUrl('https://example.com/video.mp4#fragment'), 'video', 'URL with fragment');

// URL with query only
assertEqual(extractBaseNameFromUrl('https://example.com/video.mp4?token=abc123'), 'video', 'URL with query');

// Unicode in URL path
assertEqual(extractBaseNameFromUrl('https://example.com/Phim/T%E1%BA%ADp-33.html'), 'Phim/T%E1%BA%ADp-33', 'unicode percent in path');

// Beautify unicode percent
assertEqual(beautifyUrlFilename('Phim/T%E1%BA%ADp-33'), 'Phim - Tập 33', 'unicode percent decoded');

// Empty segments
assertEqual(extractBaseNameFromUrl('https://example.com///video.mp4'), 'video', 'multiple slashes');

// Only extension
assertEqual(extractBaseNameFromUrl('https://example.com/.mp4'), '.mp4', 'hidden file (dot prefix)');

// === Summary ===
console.log('\n' + '='.repeat(60));
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) {
  console.log('\nFAILURES:');
  failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  process.exit(1);
} else {
  console.log('\nAll stress tests passed!');
}
