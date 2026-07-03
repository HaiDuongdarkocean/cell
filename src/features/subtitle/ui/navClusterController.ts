// NavClusterController — floating 6-button subtitle navigation cluster (ADR-018).
// ponytail: class mimics SubtitleOverlayController pattern (init/update/destroy lifecycle).
// Wires DOM (navClusterDom) + actions (navClusterActions) + buttons (navClusterButton) +
// keyboard (navClusterKeyboard) + drag (Pointer Events, reuse ADR-015) + repeat hold
// state machine + persist debounced + fullscreen re-parent + destroy cleanup.

import { buildClusterDOM, clampPosition, findNearestEdge, type NavClusterDOM } from './navClusterDom';
import { prevSentence, nextSentence, seekBy, findActiveCueIndex, findNearestCueIndex } from './navClusterActions';
import { setButtonPressed } from './navClusterButton';
import {
  createInitialKeyboardState,
  handleClusterKeydown,
  handleClusterKeyup,
  cancelRepeatHold,
  type NavClusterKeyboardState,
  type NavClusterKeyAction,
} from './navClusterKeyboard';
import type { NavClusterSettings, NavClusterPosition } from '@/entities/settings';
import type { SrtCue } from '@/entities/media';

/** Cue source injected by caller (lazy read for fresh cues on every action). */
export interface NavClusterCueSource {
  readonly targetCues: readonly SrtCue[];
  readonly nativeCues: readonly SrtCue[];
}

/** Repeat hold threshold (spec §F7). */
const REPEAT_HOLD_MS = 500;
/** Persist debounce (ADR-013 yOffset pattern). */
const PERSIST_DEBOUNCE_MS = 300;
/** Edge collapse threshold (spec §F4). */
const EDGE_THRESHOLD_PX = 20;

/**
 * Floating 6-button subtitle navigation cluster.
 * Lifecycle: init() → updateCues() → updateSettings() → setVisible() → destroy()
 */
export class NavClusterController {
  private dom: NavClusterDOM | null = null;
  private settings: NavClusterSettings;
  private cueSource: NavClusterCueSource;
  private repeatHolding = false;
  private repeatHoldTimer: ReturnType<typeof setTimeout> | null = null;
  private repeatLoopCue: { start: number; end: number } | null = null;
  private dragStart: { px: number; py: number; pos: NavClusterPosition } | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private kbdState: NavClusterKeyboardState = createInitialKeyboardState();

  // Stored listeners (for destroy cleanup)
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private keyupHandler: ((e: KeyboardEvent) => void) | null = null;
  private onBlurCancel: (() => void) | null = null;
  private onVisibilityCancel: (() => void) | null = null;
  private onFullscreenChange: (() => void) | null = null;
  private timeupdateHandler: (() => void) | null = null;
  private onPersistSettings: ((settings: Partial<NavClusterSettings>) => void) | null = null;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly container: HTMLElement,
    initialSettings: NavClusterSettings,
    cueSource: NavClusterCueSource,
    /** Optional callback to persist settings changes to storage. */
    onPersistSettings?: (settings: Partial<NavClusterSettings>) => void,
  ) {
    this.settings = initialSettings;
    this.cueSource = cueSource;
    this.onPersistSettings = onPersistSettings ?? null;
  }

  /** Build DOM + wire all listeners. Idempotent (no-op if already init). */
  init(): void {
    if (this.dom) return;
    const dom = buildClusterDOM();
    this.dom = dom;
    this.applyPosition(this.settings.position);
    this.applyVisibility();
    this.applyNoSubState();
    this.container.appendChild(dom.cluster);

    this.wireButtonActions();
    this.wireDrag();
    this.wireKeyboard();
    this.wireFullscreen();
    this.wireTimeupdate();
  }

  /** Update cue source (called on subtitle load/unload). Triggers 4↔6 nút transition. */
  updateCues(targetCues: readonly SrtCue[], nativeCues: readonly SrtCue[]): void {
    this.cueSource = { targetCues, nativeCues };
    this.applyNoSubState();
  }

  /** Update settings (called on chrome.storage.onChanged). Realtime apply. */
  updateSettings(partial: Partial<NavClusterSettings>): void {
    this.settings = { ...this.settings, ...partial };
    if (partial.position) this.applyPosition(this.settings.position);
    if (partial.enabled !== undefined) {
      this.applyVisibility();
    }
    if (partial.collapsed !== undefined) {
      this.applyCollapsedState();
    }
  }

  /** Show/hide cluster (off toggle). */
  setVisible(visible: boolean): void {
    this.updateSettings({ enabled: visible });
  }

  /** Teardown: remove DOM + detach all listeners. Safe to call twice. */
  destroy(): void {
    if (this.repeatHoldTimer) {
      clearTimeout(this.repeatHoldTimer);
      this.repeatHoldTimer = null;
    }
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    this.repeatHolding = false;
    this.repeatLoopCue = null;
    this.dragStart = null;

    if (this.keydownHandler) document.removeEventListener('keydown', this.keydownHandler);
    if (this.keyupHandler) document.removeEventListener('keyup', this.keyupHandler);
    if (this.onBlurCancel) window.removeEventListener('blur', this.onBlurCancel);
    if (this.onVisibilityCancel) document.removeEventListener('visibilitychange', this.onVisibilityCancel);
    if (this.onFullscreenChange) document.removeEventListener('fullscreenchange', this.onFullscreenChange);
    if (this.timeupdateHandler) this.video.removeEventListener('timeupdate', this.timeupdateHandler);

    this.keydownHandler = null;
    this.keyupHandler = null;
    this.onBlurCancel = null;
    this.onVisibilityCancel = null;
    this.onFullscreenChange = null;
    this.timeupdateHandler = null;

    if (this.dom) {
      this.dom.cluster.remove();
      this.dom = null;
    }
  }

  // === Private: apply state to DOM ===

  private applyPosition(pos: NavClusterPosition): void {
    if (!this.dom) return;
    // transform: translate(x%, y%) — but % of element itself, not container.
    // Use left/top % of container for absolute positioning.
    this.dom.cluster.style.left = `${pos.x}%`;
    this.dom.cluster.style.top = `${pos.y}%`;
  }

  private applyVisibility(): void {
    if (!this.dom) return;
    this.dom.cluster.style.display = this.settings.enabled ? 'flex' : 'none';
  }

  private applyNoSubState(): void {
    if (!this.dom) return;
    const hasSub = this.cueSource.targetCues.length > 0 || this.cueSource.nativeCues.length > 0;
    this.dom.cluster.classList.toggle('no-sub', !hasSub);
  }

  private applyCollapsedState(): void {
    if (!this.dom) return;
    if (this.settings.collapsed) {
      const edge = findNearestEdge(this.settings.position, this.video.getBoundingClientRect());
      this.dom.cluster.classList.add('collapsed');
      this.dom.cluster.classList.toggle('mirror-left', edge === 'left');
      this.dom.cluster.classList.toggle('mirror-right', edge === 'right');
    } else {
      this.dom.cluster.classList.remove('collapsed', 'mirror-left', 'mirror-right');
    }
  }

  // === Private: wire listeners ===

  private wireButtonActions(): void {
    if (!this.dom) return;
    this.dom.prevBtn.addEventListener('click', () => {
      prevSentence(this.video, this.cueSource.targetCues, this.cueSource.nativeCues);
    });
    this.dom.nextBtn.addEventListener('click', () => {
      nextSentence(this.video, this.cueSource.targetCues, this.cueSource.nativeCues);
    });
    this.dom.rewindBtn.addEventListener('click', () => seekBy(this.video, -5));
    this.dom.forwardBtn.addEventListener('click', () => seekBy(this.video, 10));

    // Repeat hold (pointerdown/up)
    this.dom.repeatBtn.addEventListener('pointerdown', () => this.startRepeatHold());
    this.dom.repeatBtn.addEventListener('pointerup', () => this.stopRepeatHold());
    this.dom.repeatBtn.addEventListener('pointercancel', () => this.stopRepeatHold());
  }

  private startRepeatHold(): void {
    if (this.repeatHolding) return;
    this.repeatHolding = true;
    setButtonPressed(this.dom!.repeatBtn, true);
    this.repeatHoldTimer = setTimeout(() => {
      // After threshold — start loop
      this.beginRepeatLoop();
    }, REPEAT_HOLD_MS);
  }

  private beginRepeatLoop(): void {
    const currentMs = this.video.currentTime * 1000;
    const { cues, index } = findActiveCueIndex(this.cueSource.targetCues, this.cueSource.nativeCues, currentMs);
    if (index >= 0 && cues[index]) {
      this.repeatLoopCue = { start: cues[index].start, end: cues[index].end };
      return;
    }
    // In gap (no active cue) — loop nearest cue by temporal distance
    const nearestIndex = findNearestCueIndex(cues, currentMs);
    if (nearestIndex >= 0 && cues[nearestIndex]) {
      this.repeatLoopCue = { start: cues[nearestIndex].start, end: cues[nearestIndex].end };
    }
  }

  private stopRepeatHold(): void {
    if (!this.repeatHolding) return;
    // Was the hold loop active (hold ≥500ms)? If not, this was a quick click/tap
    // → one-shot repeat: seek to current cue start (spec F7 defines hold-loop;
    // click behavior: repeat current cue once).
    const wasLooping = this.repeatLoopCue !== null;
    this.repeatHolding = false;
    this.repeatLoopCue = null;
    if (this.repeatHoldTimer) {
      clearTimeout(this.repeatHoldTimer);
      this.repeatHoldTimer = null;
    }
    if (this.dom) setButtonPressed(this.dom.repeatBtn, false);
    if (!wasLooping) {
      this.repeatOnce();
    }
  }

  /** One-shot repeat: seek to the active cue's start (click/tap on repeat).
   *  In gap (no active cue) — seek to nearest cue's start by temporal distance. */
  private repeatOnce(): void {
    const currentMs = this.video.currentTime * 1000;
    const { cues, index } = findActiveCueIndex(this.cueSource.targetCues, this.cueSource.nativeCues, currentMs);
    if (index >= 0 && cues[index]) {
      this.video.currentTime = cues[index].start / 1000;
      return;
    }
    // In gap — seek to nearest cue's start
    const nearestIndex = findNearestCueIndex(cues, currentMs);
    if (nearestIndex >= 0 && cues[nearestIndex]) {
      this.video.currentTime = cues[nearestIndex].start / 1000;
    }
  }

  private wireTimeupdate(): void {
    this.timeupdateHandler = () => {
      if (!this.repeatHolding || !this.repeatLoopCue) return;
      const currentMs = this.video.currentTime * 1000;
      if (currentMs >= this.repeatLoopCue.end) {
        this.video.currentTime = this.repeatLoopCue.start / 1000;
      }
    };
    this.video.addEventListener('timeupdate', this.timeupdateHandler);
  }

  private wireDrag(): void {
    if (!this.dom) return;
    const cluster = this.dom.cluster;

    const onPointerDown = (e: PointerEvent): void => {
      // ADR-015: skip drag if target is inside an action button (prev/repeat/next/
      // rewind/forward). Use closest() because SVG icons are children of buttons —
      // e.target is the SVG/path, not the button itself.
      const target = e.target as Element | null;
      if (target && target.closest('.nav-cluster-btn')) return;

      e.preventDefault();
      try {
        cluster.setPointerCapture(e.pointerId);
      } catch {
        // setPointerCapture can throw if pointerId invalid — ignore
      }
      cluster.setAttribute('aria-grabbed', 'true');
      this.dragStart = {
        px: e.clientX,
        py: e.clientY,
        pos: { ...this.settings.position },
      };
    };

    const onPointerMove = (e: PointerEvent): void => {
      if (!this.dragStart) return;
      const dx = e.clientX - this.dragStart.px;
      const dy = e.clientY - this.dragStart.py;
      const containerRect = this.video.getBoundingClientRect();
      const clusterRect = this.dom!.cluster.getBoundingClientRect();
      const deltaXPercent = (dx / containerRect.width) * 100;
      const deltaYPercent = (dy / containerRect.height) * 100;
      const newPos = clampPosition(
        { x: this.dragStart.pos.x + deltaXPercent, y: this.dragStart.pos.y + deltaYPercent },
        containerRect,
        clusterRect,
      );
      this.applyPosition(newPos);
      this.settings = { ...this.settings, position: newPos };

      // Check edge collapse
      const edgeX = newPos.x <= (EDGE_THRESHOLD_PX / containerRect.width) * 100
        || newPos.x >= 100 - (EDGE_THRESHOLD_PX / containerRect.width) * 100;
      if (edgeX && !this.settings.collapsed) {
        this.updateSettings({ collapsed: true });
      }
    };

    const onPointerUp = (e: PointerEvent): void => {
      if (!this.dragStart) return;
      try {
        cluster.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      cluster.setAttribute('aria-grabbed', 'false');
      this.dragStart = null;
      this.persistSettings({ position: this.settings.position });
    };

    const onDblClick = (e: MouseEvent): void => {
      // Skip reset if double-click landed on an action button (prev/repeat/next/
      // rewind/forward) — user is double-clicking the button, not the background.
      const target = e.target as Element | null;
      if (target && target.closest('.nav-cluster-btn')) return;
      const defaultPos: NavClusterPosition = { x: 0, y: 75 };
      this.updateSettings({ position: defaultPos, collapsed: false });
      this.persistSettings({ position: defaultPos, collapsed: false });
    };

    cluster.addEventListener('pointerdown', onPointerDown);
    cluster.addEventListener('pointermove', onPointerMove);
    cluster.addEventListener('pointerup', onPointerUp);
    cluster.addEventListener('pointercancel', onPointerUp);
    cluster.addEventListener('dblclick', onDblClick);
  }

  private wireKeyboard(): void {
    this.keydownHandler = (e: KeyboardEvent) => {
      const result = handleClusterKeydown(e, this.kbdState);
      this.kbdState = result.state;
      if (result.action) {
        e.preventDefault();
        this.executeKeyAction(result.action);
      }
    };
    this.keyupHandler = (e: KeyboardEvent) => {
      const result = handleClusterKeyup(e, this.kbdState);
      this.kbdState = result.state;
      if (result.action) {
        this.executeKeyAction(result.action);
      }
    };
    this.onBlurCancel = () => {
      const result = cancelRepeatHold(this.kbdState);
      this.kbdState = result.state;
      if (result.action) this.executeKeyAction(result.action);
    };
    this.onVisibilityCancel = () => {
      if (document.hidden) {
        const result = cancelRepeatHold(this.kbdState);
        this.kbdState = result.state;
        if (result.action) this.executeKeyAction(result.action);
      }
    };
    document.addEventListener('keydown', this.keydownHandler);
    document.addEventListener('keyup', this.keyupHandler);
    window.addEventListener('blur', this.onBlurCancel);
    document.addEventListener('visibilitychange', this.onVisibilityCancel);
  }

  private executeKeyAction(action: NavClusterKeyAction): void {
    switch (action) {
      case 'prev-sentence':
        prevSentence(this.video, this.cueSource.targetCues, this.cueSource.nativeCues);
        break;
      case 'next-sentence':
        nextSentence(this.video, this.cueSource.targetCues, this.cueSource.nativeCues);
        break;
      case 'repeat-start':
        this.startRepeatHold();
        break;
      case 'repeat-stop':
        this.stopRepeatHold();
        break;
      case 'seek-rewind-5':
        seekBy(this.video, -5);
        break;
      case 'seek-forward-10':
        seekBy(this.video, 10);
        break;
    }
  }

  private wireFullscreen(): void {
    this.onFullscreenChange = () => {
      if (!this.dom) return;
      const fsElement = document.fullscreenElement;
      const targetParent = (fsElement as HTMLElement) ?? this.container;
      if (this.dom.cluster.parentElement !== targetParent) {
        targetParent.appendChild(this.dom.cluster);
      }
    };
    document.addEventListener('fullscreenchange', this.onFullscreenChange);
  }

  private persistSettings(partial: Partial<NavClusterSettings>): void {
    if (!this.onPersistSettings) return;
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.onPersistSettings?.(partial);
    }, PERSIST_DEBOUNCE_MS);
  }
}
