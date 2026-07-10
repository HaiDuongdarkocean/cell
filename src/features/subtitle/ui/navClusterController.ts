// NavClusterController — floating 6-button subtitle navigation cluster (ADR-018).
// ponytail: class mimics SubtitleOverlayController pattern (init/update/destroy lifecycle).
// Wires DOM (navClusterDom) + actions (navClusterActions) + buttons (navClusterButton) +
// keyboard (navClusterKeyboard) + drag (Pointer Events, reuse ADR-015) + repeat hold
// state machine + persist debounced + fullscreen re-parent + destroy cleanup.

import { buildClusterDOM, clampPosition, findNearestEdge, type NavClusterDOM } from './navClusterDom';
import { NAV_CLUSTER_ICONS, type NavClusterIconName } from './navClusterIcons';
import { prevSentence, nextSentence, seekBy, findActiveCueIndex, findNearestCueIndex } from './navClusterActions';
import { syncElementTheme } from '@/shared/lib/themeTokens';

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
  // ADR-024: cleanup for syncElementTheme — keeps the cluster's own data-theme
  // attribute in sync with the container, even when the cluster is re-parented.
  private themeSyncCleanup: (() => void) | null = null;
  // ADR-019 sync: lazy offset provider so nav actions read current offsetMs
  // (same pattern as SubtitleOverlayController.setOffsetProvider). Without this,
  // cluster nav used offset=0 while overlay used real offset → nav jumped to
  // wrong cue (sub at t+offset, nav searched at t).
  private getOffsetMs: () => number = () => 0;

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
    this.applyCollapsedState();
    this.container.appendChild(dom.cluster);

    // ADR-024: cluster is a portable component (re-parented in fullscreen) so
    // it must carry its own data-theme attribute instead of relying on container.
    this.themeSyncCleanup = syncElementTheme(dom.cluster, this.container);

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

  /**
   * Wire offset provider (ADR-019 sync). Nav actions read current offsetMs
   * so prev/next/repeat jump to the same cue the overlay is showing.
   * Mirror of SubtitleOverlayController.setOffsetProvider.
   */
  setOffsetProvider(provider: () => number): void {
    this.getOffsetMs = provider;
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

    // ADR-024: disconnect theme observer before removing DOM.
    if (this.themeSyncCleanup) {
      this.themeSyncCleanup();
      this.themeSyncCleanup = null;
    }

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
    const hasSub = this.hasSubtitles();
    const { cluster, mainColumn, secondaryColumn, noSubColumn, prevBtn, repeatBtn, nextBtn, rewindBtn, forwardBtn } = this.dom;
    cluster.classList.toggle('no-sub', !hasSub);
    if (hasSub) {
      // Restore has-sub 2-column layout: prev/repeat/next | rewind/forward
      mainColumn.style.display = 'flex';
      secondaryColumn.style.display = 'flex';
      noSubColumn.style.display = 'none';
      mainColumn.append(prevBtn, repeatBtn, nextBtn);
      secondaryColumn.append(rewindBtn, forwardBtn);
      // Reset no-sub recorder state and restore normal repeat icon/label
      this.recordLoopState = 'idle';
      this.recordedLoop = null;
      this.setButtonIcon(repeatBtn, 'repeat');
      repeatBtn.setAttribute('aria-label', 'Repeat current sentence');
      repeatBtn.setAttribute('aria-pressed', 'false');
      repeatBtn.classList.remove('nav-cluster-btn--active');
      return;
    }
    // No-sub: single column with rewind, repeat, forward
    mainColumn.style.display = 'none';
    secondaryColumn.style.display = 'none';
    noSubColumn.style.display = 'flex';
    noSubColumn.append(rewindBtn, repeatBtn, forwardBtn);
    // Reset has-sub hold state and apply no-sub repeat icon
    this.repeatHolding = false;
    this.repeatLoopCue = null;
    if (this.repeatHoldTimer) {
      clearTimeout(this.repeatHoldTimer);
      this.repeatHoldTimer = null;
    }
    this.applyRepeatState();
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
      prevSentence(this.video, this.cueSource.targetCues, this.cueSource.nativeCues, this.getOffsetMs());
    });
    this.dom.nextBtn.addEventListener('click', () => {
      nextSentence(this.video, this.cueSource.targetCues, this.cueSource.nativeCues, this.getOffsetMs());
    });
    this.dom.rewindBtn.addEventListener('click', () => seekBy(this.video, -5));
    this.dom.forwardBtn.addEventListener('click', () => seekBy(this.video, 10));

    // Repeat button: mode depends on subtitle availability.
    this.dom.repeatBtn.addEventListener('click', () => this.handleRepeatClick());
    this.dom.repeatBtn.addEventListener('pointerdown', () => this.startRepeatHold());
    this.dom.repeatBtn.addEventListener('pointerup', () => this.stopRepeatHold());
    this.dom.repeatBtn.addEventListener('pointercancel', () => this.stopRepeatHold());
  }

  private hasSubtitles(): boolean {
    return this.cueSource.targetCues.length > 0 || this.cueSource.nativeCues.length > 0;
  }

  /** Repeat click: cue-based when subtitles exist, 3-state loop recorder when no subs. */
  private handleRepeatClick(): void {
    if (this.hasSubtitles()) {
      this.repeatOnce();
      return;
    }
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

  /** Start cue-based repeat loop when repeat button is held (has-sub only). */
  private startRepeatHold(): void {
    if (!this.hasSubtitles() || this.repeatHolding) return;
    this.repeatHolding = true;
    this.applyRepeatHoldState(true);
    this.repeatHoldTimer = setTimeout(() => {
      this.beginRepeatLoop();
    }, REPEAT_HOLD_MS);
  }

  private beginRepeatLoop(): void {
    const currentMs = this.video.currentTime * 1000;
    const { cues, index } = findActiveCueIndex(this.cueSource.targetCues, this.cueSource.nativeCues, currentMs, this.getOffsetMs());
    if (index >= 0 && cues[index]) {
      this.repeatLoopCue = { start: cues[index].start, end: cues[index].end };
      return;
    }
    const nearestIndex = findNearestCueIndex(cues, currentMs);
    if (nearestIndex >= 0 && cues[nearestIndex]) {
      this.repeatLoopCue = { start: cues[nearestIndex].start, end: cues[nearestIndex].end };
    }
  }

  private stopRepeatHold(): void {
    if (!this.repeatHolding) return;
    const wasLooping = this.repeatLoopCue !== null;
    this.repeatHolding = false;
    this.repeatLoopCue = null;
    if (this.repeatHoldTimer) {
      clearTimeout(this.repeatHoldTimer);
      this.repeatHoldTimer = null;
    }
    if (this.dom) this.applyRepeatHoldState(false);
    if (!this.hasSubtitles() || wasLooping) return;
    this.repeatOnce();
  }

  /** One-shot repeat: seek to active/nearest cue start (has-sub only). */
  private repeatOnce(): void {
    const currentMs = this.video.currentTime * 1000;
    const offsetMs = this.getOffsetMs();
    const { cues, index } = findActiveCueIndex(this.cueSource.targetCues, this.cueSource.nativeCues, currentMs, offsetMs);
    if (index >= 0 && cues[index]) {
      // ADR-019 sync: seek so overlay DISPLAYS this cue → shift by -offsetMs.
      this.video.currentTime = (cues[index].start - offsetMs) / 1000;
      return;
    }
    const nearestIndex = findNearestCueIndex(cues, currentMs);
    if (nearestIndex >= 0 && cues[nearestIndex]) {
      this.video.currentTime = (cues[nearestIndex].start - offsetMs) / 1000;
    }
  }

  private applyRepeatHoldState(active: boolean): void {
    if (!this.dom) return;
    this.dom.repeatBtn.setAttribute('aria-pressed', String(active));
    this.dom.repeatBtn.classList.toggle('nav-cluster-btn--active', active);
  }

  /** Update repeat button visual/ARIA state (no-sub 3-state only). */
  private applyRepeatState(): void {
    if (!this.dom) return;
    const state = this.recordLoopState;
    const config: Record<typeof this.recordLoopState, { label: string; icon: NavClusterIconName }> = {
      idle: { label: 'Repeat A', icon: 'repeatA' },
      'recording-end': { label: 'Repeat B', icon: 'repeatB' },
      looping: { label: 'Repeat cancel', icon: 'repeatCancel' },
    };
    const active = state === 'looping';
    const btn = this.dom.repeatBtn;
    btn.setAttribute('aria-label', config[state].label);
    btn.setAttribute('aria-pressed', String(active));
    btn.classList.toggle('nav-cluster-btn--active', active);
    this.setButtonIcon(btn, config[state].icon);
  }

  private setButtonIcon(btn: HTMLButtonElement, iconName: NavClusterIconName): void {
    const iconHtml = NAV_CLUSTER_ICONS[iconName];
    if (iconHtml) btn.innerHTML = iconHtml;
  }

  private wireTimeupdate(): void {
    this.timeupdateHandler = () => {
      // Has-sub: loop current cue while repeat button is held.
      if (this.repeatHolding && this.repeatLoopCue) {
        const currentMs = this.video.currentTime * 1000;
        if (currentMs >= this.repeatLoopCue.end) {
          this.video.currentTime = this.repeatLoopCue.start / 1000;
        }
        return;
      }
      // No-sub: loop recorded [start, end] until user cancels.
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
    const grip = this.dom.grip;

    // ADR-018 D5-rev: drag via grip tab (expanded) OR cluster (collapsed).
    // Collapsed state has no buttons inside → whole circle is the handle.
    // Expanded state: only grip tab triggers drag (cluster body = buttons).
    const isDragTarget = (target: EventTarget | null): boolean => {
      if (cluster.classList.contains('collapsed')) return target === cluster;
      return target === grip;
    };
    // The element that receives pointer capture + aria-grabbed.
    const dragHandle = (): HTMLElement => (cluster.classList.contains('collapsed') ? cluster : grip);

    const onPointerDown = (e: PointerEvent): void => {
      if (!isDragTarget(e.target)) return;
      e.preventDefault();
      const handle = dragHandle();
      try {
        handle.setPointerCapture(e.pointerId);
      } catch {
        // setPointerCapture can throw if pointerId invalid — ignore
      }
      handle.setAttribute('aria-grabbed', 'true');
      cluster.classList.add('dragging');
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
      const handle = dragHandle();
      try {
        handle.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      handle.setAttribute('aria-grabbed', 'false');
      cluster.classList.remove('dragging');
      this.dragStart = null;
      this.persistSettings({ position: this.settings.position });
    };

    const onDblClick = (e: MouseEvent): void => {
      // Reset on double-click of drag handle (grip when expanded, cluster when collapsed).
      if (!isDragTarget(e.target)) return;
      const defaultPos: NavClusterPosition = { x: 0, y: 75 };
      this.updateSettings({ position: defaultPos, collapsed: false });
      this.persistSettings({ position: defaultPos, collapsed: false });
    };

    // Listen on cluster (capture phase) so grip + collapsed-cluster both work
    // with a single listener set. Grip is a child of cluster → events bubble.
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
        prevSentence(this.video, this.cueSource.targetCues, this.cueSource.nativeCues, this.getOffsetMs());
        break;
      case 'next-sentence':
        nextSentence(this.video, this.cueSource.targetCues, this.cueSource.nativeCues, this.getOffsetMs());
        break;
      case 'repeat-start':
        if (this.hasSubtitles()) {
          this.startRepeatHold();
        } else {
          this.handleRepeatClick();
        }
        break;
      case 'repeat-stop':
        if (this.hasSubtitles()) {
          this.stopRepeatHold();
        }
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
