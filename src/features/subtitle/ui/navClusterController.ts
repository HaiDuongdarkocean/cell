// NavClusterController — floating 6-button subtitle navigation cluster (ADR-018).
// ponytail: class mimics SubtitleOverlayController pattern (init/update/destroy lifecycle).
// Wires DOM (navClusterDom) + actions (navClusterActions) + buttons (navClusterButton) +
// keyboard (navClusterKeyboard) + drag (Pointer Events, reuse ADR-015) + repeat hold
// state machine + persist debounced + fullscreen re-parent + destroy cleanup.

import { buildClusterDOM, clampPosition, findNearestEdge, type NavClusterDOM } from './navClusterDom';
import { prevSentence, nextSentence, seekBy } from './navClusterActions';

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

/** Persist debounce (ADR-013 yOffset pattern). */
const PERSIST_DEBOUNCE_MS = 300;

/**
 * Floating 6-button subtitle navigation cluster.
 * Lifecycle: init() → updateCues() → updateSettings() → setVisible() → destroy()
 */
export class NavClusterController {
  private dom: NavClusterDOM | null = null;
  private settings: NavClusterSettings;
  private cueSource: NavClusterCueSource;
  private recordLoopState: 'idle' | 'recording-end' | 'looping' = 'idle';
  private recordedLoop: { start: number; end: number } | null = null;
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
    this.applyAppearance();
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
    if (partial.enabled !== undefined) this.applyVisibility();
    if (partial.collapsed !== undefined) this.applyCollapsedState();
    if (partial.buttonSize !== undefined || partial.bgOpacity !== undefined || partial.buttonOpacity !== undefined) {
      this.applyAppearance();
    }
  }

  /** Show/hide cluster (off toggle). */
  setVisible(visible: boolean): void {
    this.updateSettings({ enabled: visible });
  }

  /** Teardown: remove DOM + detach all listeners. Safe to call twice. */
  destroy(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
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

  private applyAppearance(): void {
    if (!this.dom) return;
    const { buttonSize, bgOpacity, buttonOpacity } = this.settings;
    this.dom.cluster.style.setProperty('--nav-cluster-btn-size', `${buttonSize}px`);
    this.dom.cluster.style.setProperty('--nav-cluster-bg-opacity', String(bgOpacity));
    this.dom.cluster.style.setProperty('--nav-cluster-btn-opacity', String(buttonOpacity));
  }

  private applyVisibility(): void {
    if (!this.dom) return;
    this.dom.cluster.style.display = this.settings.enabled ? 'flex' : 'none';
  }

  private applyNoSubState(): void {
    if (!this.dom) return;
    const hasSub = this.cueSource.targetCues.length > 0 || this.cueSource.nativeCues.length > 0;
    const { cluster, mainColumn, secondaryColumn, noSubColumn, prevBtn, repeatBtn, nextBtn, rewindBtn, forwardBtn } = this.dom;
    cluster.classList.toggle('no-sub', !hasSub);
    if (hasSub) {
      // Restore has-sub 2-column layout: prev/repeat/next | rewind/forward
      mainColumn.style.display = 'flex';
      secondaryColumn.style.display = 'flex';
      noSubColumn.style.display = 'none';
      mainColumn.append(prevBtn, repeatBtn, nextBtn);
      secondaryColumn.append(rewindBtn, forwardBtn);
      return;
    }
    // No-sub: single column with rewind, repeat, forward
    mainColumn.style.display = 'none';
    secondaryColumn.style.display = 'none';
    noSubColumn.style.display = 'flex';
    noSubColumn.append(rewindBtn, repeatBtn, forwardBtn);
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

    // Repeat button: 3-state cycle (idle → recording-end → looping → idle)
    this.dom.repeatBtn.addEventListener('click', () => this.handleRepeatClick());
  }

  /** 3-state repeat cycle: idle → recording-end → looping → idle. */
  private handleRepeatClick(): void {
    const currentTime = this.video.currentTime;
    if (this.recordLoopState === 'idle') {
      this.recordedLoop = { start: currentTime, end: currentTime };
      this.recordLoopState = 'recording-end';
      this.applyRepeatState();
      return;
    }
    if (this.recordLoopState === 'recording-end') {
      if (this.recordedLoop) {
        this.recordedLoop.end = Math.max(this.recordedLoop.start + 0.1, currentTime);
        this.recordLoopState = 'looping';
        this.applyRepeatState();
      }
      return;
    }
    // looping
    this.recordLoopState = 'idle';
    this.recordedLoop = null;
    this.applyRepeatState();
  }

  /** Update repeat button visual/ARIA state. */
  private applyRepeatState(): void {
    if (!this.dom) return;
    const state = this.recordLoopState;
    const labels: Record<typeof this.recordLoopState, string> = {
      idle: 'Record loop start',
      'recording-end': 'Record loop end',
      looping: 'Cancel loop',
    };
    const active = state === 'looping';
    const btn = this.dom.repeatBtn;
    btn.setAttribute('aria-label', labels[state]);
    btn.setAttribute('aria-pressed', String(active));
    btn.classList.toggle('nav-cluster-btn--active', active);
  }

  private wireTimeupdate(): void {
    this.timeupdateHandler = () => {
      // 3-state recorded loop: loop [start, end] until user cancels.
      if (this.recordLoopState === 'looping' && this.recordedLoop) {
        const { start, end } = this.recordedLoop;
        const safeEnd = Math.max(start + 0.1, end);
        if (this.video.currentTime >= safeEnd) {
          this.video.currentTime = start;
        }
      }
    };
    this.video.addEventListener('timeupdate', this.timeupdateHandler);
  }

  private wireDrag(): void {
    if (!this.dom) return;
    const cluster = this.dom.cluster;

    const onPointerDown = (e: PointerEvent): void => {
      // Drag only on outer border (viền) — 4px padding zone around cluster edge.
      // e.target === cluster means pointer is on cluster's direct area (padding
      // frame OR inter-column gap). Exclude interior by checking pointer is within
      // 4px of any edge.
      if (e.target !== cluster) return;
      const rect = cluster.getBoundingClientRect();
      const pad = 4; // matches CSS padding: 4px
      const ox = e.clientX - rect.left;
      const oy = e.clientY - rect.top;
      const onBorder = ox < pad || ox > rect.width - pad || oy < pad || oy > rect.height - pad;
      if (!onBorder) return;

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
      // Only reset on double-click of outer border (viền), not interior or buttons.
      if (e.target !== cluster) return;
      const rect = cluster.getBoundingClientRect();
      const pad = 4;
      const ox = e.clientX - rect.left;
      const oy = e.clientY - rect.top;
      const onBorder = ox < pad || ox > rect.width - pad || oy < pad || oy > rect.height - pad;
      if (!onBorder) return;
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
      case 'repeat-toggle':
        this.handleRepeatClick();
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
