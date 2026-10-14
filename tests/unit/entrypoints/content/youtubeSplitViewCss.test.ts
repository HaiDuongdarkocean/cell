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

  // m.youtube .player-size is a 0-height shell sized by %-padding
  // (padding-bottom:56.25% today, padding-top in older markup). Inside the
  // split-view stage the padding must be fully zeroed or #movie_player/video
  // stretch to height+padding and object-fit:contain letterboxes the video.
  it('zeroes all %-padding on .player-size inside the stage', () => {
    const rule = SOURCE.match(/\.player-size\{[^}]*\}/)?.[0] ?? '';
    const zeroed = /padding:\s*0/.test(rule)
      || (/padding-top:\s*0/.test(rule) && /padding-bottom:\s*0/.test(rule));
    expect(zeroed).toBe(true);
  });
});
