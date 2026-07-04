// OffsetController — subtitle time offset orchestrator (ADR-019).
// ponytail: class mimics NavClusterController pattern (init/update/destroy lifecycle).
// Wires panel (subtitleOffsetPanel) + badge (subtitleOffsetBadge) + state machine
// (lazy/committed) + wall-clock auto-commit timer + persist per-URL.
//
// Lazy semantics (revised 2026-07-04, drop C2): lazy = apply all ngay (chưa persist).
// 2 phút wall-clock không action → auto-commit + persist. Reset = value=0 (lazy, timer reset).

import { createOffsetSection, type OffsetSectionApi, type OffsetPanelHandlers } from './subtitleOffsetPanel';
import { createOffsetBadge, type OffsetBadgeApi } from './subtitleOffsetBadge';
import {
  INITIAL_OFFSET_STATE,
  AUTO_COMMIT_MS,
  parseOffsetInput,
  clampOffsetMs,
  shouldAutoCommit,
  type OffsetState,
} from '../logic/subtitleOffset';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { Settings } from '@/entities/media';

/** Cue source injected by caller (lazy read for fresh cues on every action). */
export interface OffsetCueSource {
  readonly targetCues: readonly unknown[];
  readonly nativeCues: readonly unknown[];
}

/** Settings snapshot injected by caller (for initial offset load). */
export interface OffsetSettingsSnapshot {
  readonly subtitleOffset?: Record<string, number>;
}

/**
 * Subtitle time offset controller.
 * Lifecycle: init() → loadCues() → destroy()
 *
 * Wall-clock auto-commit: checks `shouldAutoCommit` on `timeupdate` (video playing)
 * + `visibilitychange` (tab visible lại). No setTimeout (MV3 throttle safe).
 */
export class OffsetController {
  private state: OffsetState = INITIAL_OFFSET_STATE;
  private section: OffsetSectionApi | null = null;
  private badge: OffsetBadgeApi | null = null;
  private hasSubtitle = false;
  private readonly url: string;
  private readonly managerPanel: HTMLElement | null;

  // Stored listeners (for destroy cleanup)
  private timeupdateHandler: ((e: Event) => void) | null = null;
  private visibilityHandler: ((e: Event) => void) | null = null;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly container: HTMLElement,
    url: string,
    initialSnapshot?: OffsetSettingsSnapshot,
    /** Manager panel element — offset section appended here. null = defer init until set. */
    managerPanel?: HTMLElement | null,
  ) {
    this.url = url;
    this.managerPanel = managerPanel ?? null;
    // Load persisted offset for this URL → mode=committed (no lazy on reload)
    const persisted = initialSnapshot?.subtitleOffset?.[url];
    if (typeof persisted === 'number' && persisted !== 0) {
      this.state = {
        valueMs: clampOffsetMs(persisted),
        mode: 'committed',
        lastActionAt: 0,
      };
    }
  }

  /** Build section + badge + wire listeners. Idempotent (no-op if already init). */
  init(): void {
    if (this.section) return;
    if (!this.managerPanel) return; // defer until manager panel available

    const handlers: OffsetPanelHandlers = {
      onStep: (deltaMs) => this.handleStep(deltaMs),
      onInput: (valueMs) => this.handleInput(valueMs),
      onReset: () => this.handleReset(),
      onApply: () => this.handleApply(),
    };

    this.section = createOffsetSection(this.managerPanel, handlers);
    this.badge = createOffsetBadge(this.container, () => this.handleReset());

    // Initial render
    this.section.update(this.state, this.hasSubtitle);
    if (this.state.mode === 'lazy' && this.state.lastActionAt > 0) {
      this.badge.show(this.state.lastActionAt);
    }

    // Wall-clock auto-commit checks
    this.timeupdateHandler = () => this.checkAutoCommit();
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        this.checkAutoCommit();
      }
    };
    this.video.addEventListener('timeupdate', this.timeupdateHandler);
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  /** Update subtitle loaded state. When subtitles load → hasSubtitle=true. When unloaded → reset offset. */
  loadCues(hasSubtitle: boolean): void {
    const wasLoaded = this.hasSubtitle;
    this.hasSubtitle = hasSubtitle;
    if (hasSubtitle && !wasLoaded) {
      // Subtitles just loaded — keep persisted offset (if any), don't reset
      this.section?.update(this.state, this.hasSubtitle);
    } else if (!hasSubtitle && wasLoaded) {
      // Subtitles unloaded → reset offset + cancel lazy (R5: load sub mới = baseline mới)
      this.resetState();
    }
  }

  /** Get current offset (ms) — for findCurrentLine callers. */
  getOffsetMs(): number {
    return this.state.valueMs;
  }

  /** ADR-019: public step API for keyboard shortcuts `[` `]` `{` `}`. Accumulate delta. */
  stepBy(deltaMs: number): void {
    this.handleStep(deltaMs);
  }

  /** ADR-019: public reset API for keyboard shortcut `\`. */
  reset(): void {
    this.handleReset();
  }

  /** Teardown: remove DOM + detach listeners. Safe to call twice. */
  destroy(): void {
    if (this.timeupdateHandler) {
      this.video.removeEventListener('timeupdate', this.timeupdateHandler);
      this.timeupdateHandler = null;
    }
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    this.section?.destroy();
    this.badge?.destroy();
    this.section = null;
    this.badge = null;
  }

  // === Private: state transitions ===

  /** Enter lazy mode with current value + reset timer. */
  private enterLazy(): void {
    const wasCommitted = this.state.mode === 'committed';
    this.state = {
      ...this.state,
      mode: 'lazy',
      lastActionAt: Date.now(),
    };
    if (wasCommitted || !this.badge) {
      // Just entered lazy → show badge
      this.badge?.show(this.state.lastActionAt);
    } else {
      // Already lazy → just reset timer display
      this.badge?.show(this.state.lastActionAt);
    }
    this.section?.update(this.state, this.hasSubtitle);
    this.broadcastToSidePanel();
  }

  /** Push current time + offset to side panel so its list updates immediately
   * when the offset changes (video may be paused, so timeupdate won't fire). */
  private broadcastToSidePanel(): void {
    void sendMessage({
      type: MESSAGE_TYPES.VIDEO_TIME_UPDATE,
      payload: {
        tabId: undefined,
        currentTimeMs: this.video.currentTime * 1000,
        durationMs: this.video.duration * 1000 || 0,
        offsetMs: this.state.valueMs,
      },
    });
  }

  /** Step button: accumulate delta, enter lazy, reset timer. */
  private handleStep(deltaMs: number): void {
    if (!this.hasSubtitle) return;
    this.state = {
      ...this.state,
      valueMs: clampOffsetMs(this.state.valueMs + deltaMs),
    };
    this.enterLazy();
  }

  /** Input: replace value (not accumulate), enter lazy, reset timer. */
  private handleInput(valueMs: number | null): void {
    if (!this.hasSubtitle) return;
    if (valueMs === null) return; // invalid input — panel shows toast
    this.state = {
      ...this.state,
      valueMs: clampOffsetMs(valueMs),
    };
    this.enterLazy();
  }

  /** Reset: value=0, lazy mode, timer reset. */
  private handleReset(): void {
    if (!this.hasSubtitle) return;
    this.state = {
      ...this.state,
      valueMs: 0,
      mode: 'lazy',
      lastActionAt: Date.now(),
    };
    this.badge?.show(this.state.lastActionAt);
    this.section?.update(this.state, this.hasSubtitle);
    this.broadcastToSidePanel();
  }

  /** Apply: commit + persist + flash. */
  private handleApply(): void {
    if (!this.hasSubtitle) return;
    this.commit();
  }

  /** Commit: mode=committed, persist, hide badge, flash apply button. */
  private commit(): void {
    this.state = {
      ...this.state,
      mode: 'committed',
      lastActionAt: 0,
    };
    this.badge?.hide();
    this.section?.update(this.state, this.hasSubtitle);
    this.section?.flashSaved();
    this.broadcastToSidePanel();
    void this.persist();
  }

  /** Reset to initial state (load new sub / unload). */
  private resetState(): void {
    this.state = INITIAL_OFFSET_STATE;
    this.badge?.hide();
    this.section?.update(this.state, this.hasSubtitle);
    this.broadcastToSidePanel();
  }

  /** Check wall-clock auto-commit: lazy + > 2 phút không action → commit. */
  private checkAutoCommit(): void {
    if (this.state.mode !== 'lazy') return;
    if (this.state.lastActionAt === 0) return; // never acted
    if (shouldAutoCommit(this.state, Date.now())) {
      this.commit();
    } else {
      // Update badge timer (countdown)
      const remaining = Math.max(0, AUTO_COMMIT_MS - (Date.now() - this.state.lastActionAt));
      this.badge?.updateTimer(remaining);
    }
  }

  /** Persist current offset to settingsStore (per-URL). */
  private async persist(): Promise<void> {
    try {
      const settings = await this.loadSettingsOnce();
      const existing = settings.subtitleOffset ?? {};
      const updated = { ...existing };
      if (this.state.valueMs === 0) {
        // value=0 → remove key (don't store zeros)
        delete updated[this.url];
      } else {
        updated[this.url] = this.state.valueMs;
      }
      await saveSettings({ subtitleOffset: updated } as Partial<Settings>);
    } catch {
      // ponytail: storage might not be available in test contexts — silent fail
    }
  }

  /** Load settings (ponytail: simple — no cache, settings small). */
  private async loadSettingsOnce(): Promise<{ subtitleOffset?: Record<string, number> }> {
    // ponytail: static import — dynamic import caused Vite to inject
    // modulepreload-polyfill (uses `document`) into the shared settingsStore chunk,
    // crashing the background SW (no `document` in SW → "Service worker registration
    // failed. Status code: 15"). saveSettings is already statically imported, so the
    // module is in the bundle regardless — no benefit to dynamic import here.
    return loadSettings();
  }
}

/**
 * Parse input string → ms (delegate to pure function).
 * Exposed for panel test convenience.
 */
export function tryParseInput(input: string): number | null {
  return parseOffsetInput(input);
}
