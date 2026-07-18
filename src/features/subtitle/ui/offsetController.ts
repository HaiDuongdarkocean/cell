// OffsetController — subtitle time offset orchestrator (ADR-019 V2 simplified).
// ponytail: class mimics NavClusterController pattern (init/update/destroy lifecycle).
//
// V2 (2026-07-05): drop lazy mode + auto-commit + badge.
// Every action (step/input/reset) → apply NGAY + persist NGAY.
// No wall-clock timer, no visibility listener, no badge DOM.
//
// State: chỉ còn valueMs (number). Không còn mode/lastActionAt.

import { createOffsetSection, type OffsetSectionApi, type OffsetPanelHandlers } from './subtitleOffsetPanel';
import {
  parseOffsetInput,
  clampOffsetMs,
} from '../logic/subtitleOffset';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { Settings } from '@/entities/media';

/** Settings snapshot injected by caller (for initial offset load). */
export interface OffsetSettingsSnapshot {
  readonly subtitleOffset?: Record<string, number>;
}

/**
 * Subtitle time offset controller (V2 — direct apply + persist).
 * Lifecycle: init() → loadCues() → destroy()
 */
export class OffsetController {
  private valueMs = 0;
  private section: OffsetSectionApi | null = null;
  private hasSubtitle = false;
  private readonly url: string;
  private readonly managerPanel: HTMLElement | null;

  constructor(
    private readonly video: HTMLVideoElement,
    _container: HTMLElement,
    url: string,
    initialSnapshot?: OffsetSettingsSnapshot,
    /** Manager panel element — offset section appended here. null = defer init until set. */
    managerPanel?: HTMLElement | null,
  ) {
    this.url = url;
    this.managerPanel = managerPanel ?? null;
    // Load persisted offset for this URL
    const persisted = initialSnapshot?.subtitleOffset?.[url];
    if (typeof persisted === 'number' && persisted !== 0) {
      this.valueMs = clampOffsetMs(persisted);
    }
  }

  /** Build section + wire listeners. Idempotent (no-op if already init). */
  init(): void {
    if (this.section) return;
    if (!this.managerPanel) return; // defer until manager panel available

    const handlers: OffsetPanelHandlers = {
      onStep: (deltaMs) => this.handleStep(deltaMs),
      onInput: (valueMs) => this.handleInput(valueMs),
      onReset: () => this.handleReset(),
    };

    this.section = createOffsetSection(this.managerPanel, handlers);

    // Initial render
    this.section.update(this.valueMs, this.hasSubtitle);
  }

  /** Update subtitle loaded state. When subtitles load → keep persisted offset. When unloaded → reset offset. */
  loadCues(hasSubtitle: boolean): void {
    const wasLoaded = this.hasSubtitle;
    this.hasSubtitle = hasSubtitle;
    if (hasSubtitle && !wasLoaded) {
      this.section?.update(this.valueMs, this.hasSubtitle);
    } else if (!hasSubtitle && wasLoaded) {
      // Subtitles unloaded → reset offset to 0
      this.valueMs = 0;
      void this.persist();
      this.section?.update(this.valueMs, this.hasSubtitle);
      this.broadcastToSidePanel();
    }
  }

  /** Get current offset (ms) — for findCurrentLine callers. */
  getOffsetMs(): number {
    return this.valueMs;
  }

  /** ADR-019: public step API for keyboard shortcuts `[` `]` `{` `}`. Accumulate delta. */
  stepBy(deltaMs: number): void {
    this.handleStep(deltaMs);
  }

  /** ADR-019: public reset API for keyboard shortcut `\`. */
  reset(): void {
    this.handleReset();
  }

  /** Teardown: remove DOM. Safe to call twice. */
  destroy(): void {
    this.section?.destroy();
    this.section = null;
  }

  // === Private: state transitions (V2 — direct apply + persist) ===

  /** Step button: accumulate delta, apply + persist ngay. */
  private handleStep(deltaMs: number): void {
    if (!this.hasSubtitle) return;
    this.valueMs = clampOffsetMs(this.valueMs + deltaMs);
    this.section?.update(this.valueMs, this.hasSubtitle);
    void this.persist();
    this.broadcastToSidePanel();
  }

  /** Input: replace value (not accumulate), apply + persist ngay. */
  private handleInput(valueMs: number | null): void {
    if (!this.hasSubtitle) return;
    if (valueMs === null) return; // invalid input — panel shows toast
    this.valueMs = clampOffsetMs(valueMs);
    this.section?.update(this.valueMs, this.hasSubtitle);
    void this.persist();
    this.broadcastToSidePanel();
  }

  /** Reset: value=0, apply + persist ngay. */
  private handleReset(): void {
    if (!this.hasSubtitle) return;
    this.valueMs = 0;
    this.section?.update(this.valueMs, this.hasSubtitle);
    void this.persist();
    this.broadcastToSidePanel();
  }

  /** Push current time + offset to side panel so its list updates immediately. */
  private broadcastToSidePanel(): void {
    void sendMessage({
      type: MESSAGE_TYPES.VIDEO_TIME_UPDATE,
      payload: {
        tabId: undefined,
        currentTimeMs: this.video.currentTime * 1000,
        durationMs: this.video.duration * 1000 || 0,
        offsetMs: this.valueMs,
      },
    });
  }

  /** Persist current offset to settingsStore (per-URL). */
  private async persist(): Promise<void> {
    try {
      const settings = await this.loadSettingsOnce();
      const existing = settings.subtitleOffset ?? {};
      const updated = { ...existing };
      if (this.valueMs === 0) {
        // value=0 → remove key (don't store zeros)
        delete updated[this.url];
      } else {
        updated[this.url] = this.valueMs;
      }
      await saveSettings({ subtitleOffset: updated } as Partial<Settings>);
    } catch {
      // ponytail: storage might not be available in test contexts — silent fail
    }
  }

  /** Load settings once (cached on settingsStore module). */
  private async loadSettingsOnce(): Promise<Settings> {
    return loadSettings();
  }
}

/** Re-exported helper for tests (parseOffsetInput wrapper). */
export function tryParseInput(input: string): number | null {
  return parseOffsetInput(input);
}
