import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Guards the regression where width:100%!important was applied to per-chapter
// segments: YouTube sets inline px widths per chapter and tiles them via
// float:left — at 100% each segment wraps onto its own line, stacking into a
// striped block that overflows below the video.
const SOURCE = readFileSync(
  resolve(process.cwd(), 'src/entrypoints/content/youtube-main-world.iife.ts'),
  'utf8',
)
  .replace(/\/\/[^\n]*/g, ' ')
  .replace(/\s+/g, ' ');

describe('YouTube split-view injected CSS', () => {
  it.each(['.ytp-chapter-hover-container', '.ytp-heat-map-chapter'])(
    'does not force width:100% on per-chapter segment %s',
    (selector) => {
      const rule = new RegExp(
        `${selector.replace(/\./g, '\\.')}[^{}]*\\{[^}]*width:\\s*100%`,
      );
      expect(SOURCE).not.toMatch(rule);
    },
  );
});
