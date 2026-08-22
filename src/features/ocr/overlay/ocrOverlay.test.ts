// ocrOverlay tests — T13-T16. Per-script-run hitbox + wire to trigger.

import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { createHitboxes, quadToCssRect, createHitboxElement, OcrOverlay, wireOcrHitboxesToTrigger } from './ocrOverlay';
import type { OcrResultItem } from '@/features/ocr/engine/types';
import type { ScriptRun } from '../language/scriptRunSegmenter';

describe('createHitboxes (T13)', () => {
  it('creates per-script-run hitboxes from mixed box', () => {
    const items: OcrResultItem[] = [
      { poly: [[0, 0], [100, 0], [100, 30], [0, 30]] as unknown as OcrResultItem['poly'], text: '我喜欢 watching', score: 0.95 },
    ];
    const scriptRuns: ScriptRun[][] = [
      [{ text: '我喜欢', script: 'zh' }, { text: ' watching', script: 'en' }],
    ];
    const hitboxes = createHitboxes(items, scriptRuns);
    expect(hitboxes).toHaveLength(2);
    expect(hitboxes[0]!.text).toBe('我喜欢');
    expect(hitboxes[0]!.langCode).toBe('zh');
    expect(hitboxes[1]!.text).toBe(' watching');
    expect(hitboxes[1]!.langCode).toBe('en');
  });

  it('creates single hitbox for single-script box', () => {
    const items: OcrResultItem[] = [
      { poly: [[0, 0], [100, 0], [100, 30], [0, 30]] as unknown as OcrResultItem['poly'], text: 'Hello World', score: 0.95 },
    ];
    const scriptRuns: ScriptRun[][] = [[{ text: 'Hello World', script: 'en' }]];
    const hitboxes = createHitboxes(items, scriptRuns);
    expect(hitboxes).toHaveLength(1);
    expect(hitboxes[0]!.langCode).toBe('en');
  });

  it('handles empty items', () => {
    expect(createHitboxes([], [])).toEqual([]);
  });

  it('handles box with no script runs', () => {
    const items: OcrResultItem[] = [
      { poly: [[0, 0], [100, 0], [100, 30], [0, 30]] as unknown as OcrResultItem['poly'], text: 'test', score: 0.9 },
    ];
    expect(createHitboxes(items, [[]])).toEqual([]);
  });

  it('widthFraction sums to 1 per box', () => {
    const items: OcrResultItem[] = [
      { poly: [[0, 0], [100, 0], [100, 30], [0, 30]] as unknown as OcrResultItem['poly'], text: '我喜欢 watching movies', score: 0.95 },
    ];
    const scriptRuns: ScriptRun[][] = [
      [{ text: '我喜欢', script: 'zh' }, { text: ' watching', script: 'en' }, { text: ' movies', script: 'en' }],
    ];
    const hitboxes = createHitboxes(items, scriptRuns);
    const totalWidth = hitboxes.reduce((sum, h) => sum + h.widthFraction, 0);
    expect(totalWidth).toBeCloseTo(1, 5);
  });
});

describe('quadToCssRect (T13)', () => {
  it('computes bounding box rect with scaling', () => {
    const poly = [[100, 200], [300, 200], [300, 250], [100, 250]] as unknown as OcrResultItem['poly'];
    const rect = quadToCssRect(poly, 1280, 720, 640, 360);
    expect(rect.left).toBe(50);
    expect(rect.top).toBe(100);
    expect(rect.width).toBe(100);
    expect(rect.height).toBe(25);
  });

  it('splits rect by widthFraction + offsetFraction', () => {
    const poly = [[0, 0], [100, 0], [100, 30], [0, 30]] as unknown as OcrResultItem['poly'];
    const rect = quadToCssRect(poly, 100, 30, 100, 30, 0.4, 0.3);
    expect(rect.left).toBe(30);  // 0 + 100*0.3
    expect(rect.width).toBe(40); // 100*0.4
  });
});

describe('createHitboxElement (T13)', () => {
  it('creates a span with correct attributes', () => {
    const hitbox = {
      id: 'test-1',
      poly: [[0, 0], [100, 0], [100, 30], [0, 30]] as unknown as OcrResultItem['poly'],
      text: 'Hello',
      scriptRun: { text: 'Hello', script: 'en' as const },
      langCode: 'en',
      widthFraction: 1,
      offsetFraction: 0,
    };
    const rect = { left: 10, top: 20, width: 50, height: 15 };
    const el = createHitboxElement(hitbox, rect);
    expect(el.tagName).toBe('SPAN');
    expect(el.id).toBe('test-1');
    expect(el.className).toBe('cell-ocr-hitbox');
    expect(el.dataset.cellTerm).toBe('Hello');
    expect(el.dataset.cellLang).toBe('en');
    expect(el.style.left).toBe('10px');
  });
});

describe('OcrOverlay (T13-T16)', () => {
  let video: HTMLVideoElement;
  let parent: HTMLDivElement;

  beforeEach(() => {
    parent = document.createElement('div');
    document.body.appendChild(parent);
    video = document.createElement('video');
    Object.defineProperty(video, 'videoWidth', { value: 1280, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 720, configurable: true });
    parent.appendChild(video);
    Object.defineProperty(parent, 'clientWidth', { value: 640, configurable: true });
    Object.defineProperty(parent, 'clientHeight', { value: 360, configurable: true });
    // attach() resolves the host via findFarthestSameSizeContainer (getBoundingClientRect
    // walk-up). jsdom rects are all 0x0 and the walk skips zero-size nodes, returning the
    // video itself — mock real boxes so the walk settles on parent like in a browser.
    const box = (): DOMRect =>
      ({ x: 0, y: 0, left: 0, top: 0, right: 640, bottom: 360, width: 640, height: 360, toJSON: () => ({}) }) as DOMRect;
    video.getBoundingClientRect = box;
    parent.getBoundingClientRect = box;
  });

  afterEach(() => {
    parent.remove();
  });

  it('attach creates overlay container', () => {
    const overlay = new OcrOverlay();
    overlay.attach(video);
    const container = parent.querySelector('.cell-ocr-overlay');
    expect(container).toBeTruthy();
    expect(parent.style.position).toBe('relative');
  });

  it('updateHitboxes adds per-script-run span elements', () => {
    const overlay = new OcrOverlay();
    overlay.attach(video);
    const hitboxes = createHitboxes(
      [{ poly: [[0, 0], [100, 0], [100, 30], [0, 30]] as unknown as OcrResultItem['poly'], text: '我喜欢 watching', score: 0.9 }],
      [[{ text: '我喜欢', script: 'zh' }, { text: ' watching', script: 'en' }]],
    );
    overlay.updateHitboxes(hitboxes, 1280, 720);
    expect(overlay.getHitboxElements()).toHaveLength(2);
    expect(parent.querySelectorAll('span.cell-ocr-hitbox')).toHaveLength(2);
  });

  it('clear removes all hitboxes', () => {
    const overlay = new OcrOverlay();
    overlay.attach(video);
    const hitboxes = [{
      id: 'hb-1',
      poly: [[0, 0], [100, 0], [100, 30], [0, 30]] as unknown as OcrResultItem['poly'],
      text: 'Hello',
      scriptRun: { text: 'Hello', script: 'en' as const },
      langCode: 'en',
      widthFraction: 1,
      offsetFraction: 0,
    }];
    overlay.updateHitboxes(hitboxes, 1280, 720);
    overlay.clear();
    expect(overlay.getHitboxElements()).toHaveLength(0);
  });

  it('detach removes overlay container', () => {
    const overlay = new OcrOverlay();
    overlay.attach(video);
    overlay.detach();
    expect(parent.querySelector('.cell-ocr-overlay')).toBeNull();
  });

  it('attach is idempotent', () => {
    const overlay = new OcrOverlay();
    overlay.attach(video);
    overlay.attach(video);
    expect(parent.querySelectorAll('.cell-ocr-overlay')).toHaveLength(1);
  });
});

describe('wireOcrHitboxesToTrigger (T16)', () => {
  it('groups hitboxes by langCode and calls attach per group', () => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const video = document.createElement('video');
    Object.defineProperty(video, 'videoWidth', { value: 1280, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 720, configurable: true });
    Object.defineProperty(parent, 'clientWidth', { value: 640, configurable: true });
    Object.defineProperty(parent, 'clientHeight', { value: 360, configurable: true });
    parent.appendChild(video);

    const overlay = new OcrOverlay();
    overlay.attach(video);
    const hitboxes = createHitboxes(
      [
        { poly: [[0, 0], [100, 0], [100, 30], [0, 30]] as unknown as OcrResultItem['poly'], text: '我喜欢 watching', score: 0.9 },
        { poly: [[0, 50], [200, 50], [200, 80], [0, 80]] as unknown as OcrResultItem['poly'], text: 'Hello', score: 0.9 },
      ],
      [
        [{ text: '我喜欢', script: 'zh' }, { text: ' watching', script: 'en' }],
        [{ text: 'Hello', script: 'en' }],
      ],
    );
    overlay.updateHitboxes(hitboxes, 1280, 720);

    const attachCalls: { spans: number; sentence: string; langCode: string }[] = [];
    const mockTrigger = {
      attach: (spans: readonly HTMLSpanElement[], sentence: string, langCode: string) => {
        attachCalls.push({ spans: spans.length, sentence, langCode });
      },
    } as unknown as import('@/features/dictionaryPopup/trigger/subtitleTriggerController').SubtitleTriggerController;

    wireOcrHitboxesToTrigger(overlay, mockTrigger);

    // 2 groups: zh (1 span) + en (2 spans)
    expect(attachCalls).toHaveLength(2);
    const zhCall = attachCalls.find(c => c.langCode === 'zh');
    const enCall = attachCalls.find(c => c.langCode === 'en');
    expect(zhCall).toBeDefined();
    expect(zhCall!.spans).toBe(1);
    expect(enCall).toBeDefined();
    expect(enCall!.spans).toBe(2);

    parent.remove();
  });
});
