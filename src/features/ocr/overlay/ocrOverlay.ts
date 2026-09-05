// ocrOverlay — T13-T16. Hitbox overlay for OCR-detected text on video.
// spec §AD5: Clickable hitboxes over detected text → dictionary lookup.
// T13: Per-script-run hitbox (not per-box) — each script-run gets its own span.
// T16: wireOcrHitboxesToTrigger — hitbox click → subtitleTriggerController.attach().

import type { OcrResultItem } from '@/features/ocr/engine/types';
import type { ScriptRun } from '../language/scriptRunSegmenter';
import { routeScript } from '../language/languageRouter';
import type { SubtitleTriggerController } from '@/features/dictionaryPopup/trigger/subtitleTriggerController';
import { findFarthestSameSizeContainer } from '@/features/subtitle/logic/findPlayerContainer';

/** Base styling shared by every OCR hitbox — injected inline to avoid a stylesheet
 *  in foreign documents (content-script injected CSS must use literal values, not var()). */
const HITBOX_BASE_CSS = 'cursor:text;pointer-events:auto;user-select:text;-webkit-user-select:text;';

/** OCR hitbox — one per script-run within a detected text box. */
export interface OcrHitbox {
  readonly id: string;
  readonly poly: OcrResultItem['poly'];
  readonly text: string;
  readonly scriptRun: ScriptRun;
  readonly langCode: string;
  /** Fraction of parent box width [0,1] for this script-run. */
  readonly widthFraction: number;
  /** Offset fraction [0,1] within parent box. */
  readonly offsetFraction: number;
}

/** Convert OCR result items + script runs → per-script-run hitboxes.
 *  Each script-run within a box gets its own hitbox with its own langCode.
 *  Width is proportional to text length within the box. */
export function createHitboxes(
  items: readonly OcrResultItem[],
  scriptRuns: readonly ScriptRun[][],
): OcrHitbox[] {
  const hitboxes: OcrHitbox[] = [];
  items.forEach((item, i) => {
    const runs = scriptRuns[i] ?? [];
    if (runs.length === 0) return;
    const totalLen = runs.reduce((sum, r) => sum + r.text.length, 0) || 1;
    let offset = 0;
    runs.forEach((run, j) => {
      const widthFraction = run.text.length / totalLen;
      hitboxes.push({
        id: `ocr-hitbox-${i}-${j}`,
        poly: item.poly,
        text: run.text,
        scriptRun: run,
        langCode: routeScript(run.script),
        widthFraction,
        offsetFraction: offset,
      });
      offset += widthFraction;
    });
  });
  return hitboxes;
}

/** Compute CSS rect from a quad polygon (bounding box), split by widthFraction. */
export function quadToCssRect(
  poly: OcrHitbox['poly'],
  videoWidth: number,
  videoHeight: number,
  containerWidth: number,
  containerHeight: number,
  widthFraction = 1,
  offsetFraction = 0,
): { left: number; top: number; width: number; height: number } {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scaleX = containerWidth / videoWidth;
  const scaleY = containerHeight / videoHeight;
  const boxLeft = minX * scaleX;
  const boxWidth = (maxX - minX) * scaleX;
  return {
    left: boxLeft + boxWidth * offsetFraction,
    top: minY * scaleY,
    width: boxWidth * widthFraction,
    height: (maxY - minY) * scaleY,
  };
}

/** Create a DOM span element for a hitbox — invisible click target for
 *  dictionary lookup. Text is NOT rendered here (subtitle block shows OCR
 *  text); the span only captures clicks → triggerController → popup.
 *
 *  A real <button> would break the existing HTMLSpanElement contract used by
 *  SubtitleTriggerController (token spans for text-geometry hit-testing), so we
 *  keep a <span> and expose it as a button to assistive tech / keyboard via
 *  role="button", tabindex="0" and an Enter/Space keydown handler. */
export function createHitboxElement(
  hitbox: OcrHitbox,
  rect: { left: number; top: number; width: number; height: number },
): HTMLSpanElement {
  const el = document.createElement('span');
  el.id = hitbox.id;
  el.className = 'cell-ocr-hitbox';
  el.dataset.cellTerm = hitbox.text.trim();
  el.dataset.cellLang = hitbox.langCode;
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', `Look up ${hitbox.text.trim()}`);
  el.style.cssText = `position:absolute;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;${HITBOX_BASE_CSS}`;
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      el.click();
    }
  });
  return el;
}

/** OCR overlay container — manages hitbox span elements over a video. */
export class OcrOverlay {
  private container: HTMLDivElement | null = null;
  private hitboxes: HTMLSpanElement[] = [];

  /** Attach overlay to a video element's player container.
   *  Uses findFarthestSameSizeContainer — same algorithm as the subtitle/drag-drop
   *  layer — so the overlay covers the real player shell, not a thin wrapper. */
  attach(video: HTMLVideoElement): void {
    if (this.container) return;
    const parent = findFarthestSameSizeContainer(video);
    if (!parent) return;
    parent.style.position = 'relative';
    this.container = document.createElement('div');
    this.container.className = 'cell-ocr-overlay';
    this.container.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;user-select:none;-webkit-user-select:none;';
    parent.appendChild(this.container);
  }

  /** Update hitboxes with new OCR results. Creates per-script-run spans. */
  updateHitboxes(
    hitboxes: OcrHitbox[],
    videoWidth: number,
    videoHeight: number,
  ): void {
    if (!this.container) return;
    this.clear();
    const containerWidth = this.container.clientWidth;
    const containerHeight = this.container.clientHeight;
    for (const hb of hitboxes) {
      const rect = quadToCssRect(
        hb.poly, videoWidth, videoHeight, containerWidth, containerHeight,
        hb.widthFraction, hb.offsetFraction,
      );
      const el = createHitboxElement(hb, rect);
      this.container.appendChild(el);
      this.hitboxes.push(el);
    }
  }

  /** Get all current hitbox span elements. */
  getHitboxElements(): HTMLSpanElement[] {
    return this.hitboxes;
  }

  /** Clear all hitboxes. */
  clear(): void {
    for (const el of this.hitboxes) el.remove();
    this.hitboxes = [];
  }

  /** Detach overlay from DOM. */
  detach(): void {
    this.clear();
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}

/** T16: Wire OCR hitbox spans to SubtitleTriggerController for dictionary lookup.
 *  Groups hitboxes by langCode, calls attach() per group. */
export function wireOcrHitboxesToTrigger(
  overlay: OcrOverlay,
  triggerController: SubtitleTriggerController,
): void {
  const spans = overlay.getHitboxElements();
  // Group by langCode — attach() takes a single langCode per call.
  const byLang = new Map<string, HTMLSpanElement[]>();
  for (const span of spans) {
    const lang = span.dataset.cellLang ?? 'en';
    const group = byLang.get(lang);
    if (group) group.push(span);
    else byLang.set(lang, [span]);
  }
  for (const [langCode, groupSpans] of byLang) {
    // sentence = full text of all spans in this lang group (for context lookup).
    const sentence = groupSpans.map(s => s.dataset.cellTerm ?? '').join(' ');
    triggerController.attach(groupSpans, sentence, langCode);
  }
}
