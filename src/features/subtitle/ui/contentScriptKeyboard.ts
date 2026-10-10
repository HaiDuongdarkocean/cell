import { sendMessage } from '@/shared/lib/chrome-apis';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { BackgroundPrefillController } from '@/features/translate';
import {
  isEditableEvent,
  isInsideCellUi,
  isActivatableTarget,
  handleShortcutKey,
  navigateCue,
  mergeCuesForPanel,
  showToast,
  createTranslateFunction,
  broadcastCues,
} from '@/features/subtitle';
import { shouldDedupeCueSeek } from './contentScriptShared';
import { t } from '@/shared/i18n';
import type { ContentScriptContext } from './contentScriptContext';
import type { ShortcutAction, SrtCue } from '@/entities/media';

/** Page-level actions owned by featureInit's global listener — never swallowed
 *  here, on keydown or keyup, so the universal panel works on video pages too. */
const PAGE_LEVEL_ACTIONS = new Set<ShortcutAction>([
  'toggle-universal-panel',
  'open-dictionary-search',
]);

export function createContentScriptKeyboardHandlers(ctx: ContentScriptContext): {
  onKeydown: (e: KeyboardEvent) => void;
  onKeyup: (e: KeyboardEvent) => void;
} {
  const { video, container, blockController, syncController, sharedWebTextCtrl } = ctx;

  // Wire keyboard shortcuts. window capture phase (3rd arg = true) so we fire
  // BEFORE host keydown listeners (e.g. YouTube 't' = theater mode, space =
  // play/pause) and can block them via stopImmediatePropagation when the key
  // matches a configured action. See ADR-034 (listener on window, not document).
  const onKeydown = (e: KeyboardEvent) => {
    const offsetController = ctx.getOffsetController();
    const shortcuts = ctx.getShortcuts();
    // Rule: when focus is inside Cell UI (shadow DOM), block ALL host shortcuts
    // so the host page doesn't react to keys the user intends for Cell UI.
    // Cell's own shortcuts are processed below before this guard returns.
    // Escape is always allowed through so panels can close.
    const insideCellUi = isInsideCellUi(e);
    const realTarget = e.composedPath()[0] ?? e.target;
    const key = e.key.toLowerCase();

    if (insideCellUi && realTarget instanceof HTMLElement && realTarget.closest('[data-cell-keycapture]')) {
      return;
    }

    // Chrome hides the side panel when a tab enters fullscreen (Chromium
    // commit 6c6eb90, bug 1249462). sidePanel.open() in fullscreenchange
    // fails (no user gesture). But the 'f' keydown that triggers fullscreen
    // IS a user gesture — so re-open the panel synchronously here, before
    // YouTube's fullscreen handler runs. Chrome will hide the panel when
    // fullscreen completes, but the re-open keeps it visible.
    // ponytail ceiling: only covers 'f' key, not UI fullscreen button click.
    // Upgrade: if Chrome exposes a "keep visible in fullscreen" flag, drop this.
    if (!isEditableEvent(e) && key === 'f' && ctx.isSidePanelOpen()) {
      void sendMessage({
        type: MESSAGE_TYPES.OPEN_SIDE_PANEL,
        payload: { tabId: undefined },
      });
    }
    // ADR-019: fixed parallel offset shortcuts `[` `]` `{` `}` `\` (ponytail: not in
    // ShortcutAction union — avoid config UI bloat, like NavCluster fixed shortcuts).
    // Guard: skip when focus in editable (input/textarea/contenteditable) — avoid YouTube search conflict.
    // Guard: skip when focus inside Cell UI — user is interacting with panel, not video.
    if (!isEditableEvent(e) && !insideCellUi) {
      if (key === '[' || key === ']' || key === '{' || key === '}' || key === '\\') {
        if (offsetController) {
          e.preventDefault();
          switch (key) {
            case '[': // -0.5s (accumulate)
              offsetController.stepBy(-500);
              break;
            case ']': // +0.5s
              offsetController.stepBy(500);
              break;
            case '{': // -2s
              offsetController.stepBy(-2000);
              break;
            case '}': // +2s
              offsetController.stepBy(2000);
              break;
            case '\\': // reset
              offsetController.reset();
              break;
          }
        }
      }
    }

    // In Player Mode the video/overlay is the focus, so allow configured
    // shortcuts even if the event path passes through a Cell UI host. In normal
    // mode, allow shortcuts inside Cell UI too — if a panel shortcut conflicts
    // with the host the panel must win while it has focus. Skip when focus is in
    // an editable element, and skip Enter/Space on buttons/links so those
    // controls still activate with the keyboard.
    // While a lookup popup is open, Space means "resume playback" (the video
    // 'play' listener then closes the popup). Without this, Space landing on a
    // focusable popup element is skipped as an activation key, no default is
    // prevented, and the host page scrolls. Enter is left alone so focused
    // popup controls can still be activated.
    if (key === ' ' && !isEditableEvent(e) && sharedWebTextCtrl?.hasOpenPopup()) {
      e.preventDefault();
      e.stopImmediatePropagation();
      ctx.togglePlay();
      return;
    }

    const isActivationKey = key === ' ' || key === 'enter';
    const shouldSkipShortcut =
      isEditableEvent(e) ||
      (isActivatableTarget(realTarget) && isActivationKey && !blockController.isPlayerModeActive);
    const action = shouldSkipShortcut
      ? null
      : handleShortcutKey(key, shortcuts, realTarget, {
          ctrl: e.ctrlKey,
          shift: e.shiftKey,
          alt: e.altKey,
        });
    if (!action) {
      const vocabNavShift =
        e.shiftKey && !isEditableEvent(e)
          ? shortcuts.find(
              (s) =>
                (s.action === 'next-vocab-token' || s.action === 'prev-vocab-token') &&
                s.key === key &&
                (s.ctrl ?? false) === e.ctrlKey &&
                (s.alt ?? false) === e.altKey,
            )
          : undefined;
      if (vocabNavShift) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (vocabNavShift.action === 'next-vocab-token') ctx.nextVocabToken(true);
        else ctx.prevVocabToken(true);
        return;
      }
      // Status shortcuts 1-4: route through the tokenize controllers. They are
      // handled here on window capture so the host page (e.g. YouTube seeking
      // on digit keys) cannot override them.
      if (!isEditableEvent(e) && ctx.handleSubtitleStatusKey(e.key)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      if (
        !blockController.isPlayerModeActive &&
        !isEditableEvent(e) &&
        ctx.handleWebStatusKey?.(e.key)
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      // Player Mode: block ALL host keyboard shortcuts (host page is covered by
      // backdrop, no host interaction should work). Let Escape through so the
      // overlay's window listener can exit Player Mode / close CueList.
      if (blockController.isPlayerModeActive && e.key !== 'Escape' && !isEditableEvent(e)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      // Cell UI: block host shortcuts when focus is inside Cell UI panels. Let
      // Escape through so panels can close. Don't stop when focus is in an
      // editable or activatable control — those own Enter/Space and typing;
      // the Cell UI root (Surface/Sheet) will stop the event from reaching the
      // host after the focused control handles it.
      if (insideCellUi && e.key !== 'Escape' && !shouldSkipShortcut) {
        e.stopImmediatePropagation();
      }
      return;
    }

    if (PAGE_LEVEL_ACTIONS.has(action)) return;

    // Context-aware T: in Player Mode, let PlayerModeOverlay's keydown handle
    // 't' (toggles CueList). Don't preventDefault/stopImmediatePropagation —
    // the overlay's window listener needs to receive the event.
    if (action === 'toggle-panel' && blockController.isPlayerModeActive) return;

    // Block YouTube's own shortcuts (e.g. 't' = theater mode) + other
    // same-target listeners so only our action runs.
    e.preventDefault();
    e.stopImmediatePropagation();

    // ADR-032: dedupe cue-nav when Side Panel also fires SHORTCUT_ACTION.
    if ((action === 'prev-cue' || action === 'next-cue' || action === 'replay-cue') && shouldDedupeCueSeek(action)) {
      return;
    }

    switch (action) {
      case 'prev-cue':
      case 'next-cue':
      case 'replay-cue': {
        // ADR-019 sync: find cue via effective time, seek so overlay DISPLAYS it.
        // ADR-033: use getEffectiveMs so rapid press computes from intended pos.
        const offsetMs = offsetController?.getOffsetMs() ?? 0;
        const effectiveMs = ctx.getEffectiveMs();
        navigateCue(action, video, ctx.getBilingualCues(), effectiveMs, offsetMs, blockController.getActiveIndices().target);
        break;
      }
      case 'toggle-overlay': {
        ctx.toggleOverlay();
        break;
      }
      case 'toggle-panel': {
        // Page thường: toggle Split View (CueList beside video container).
        // Player Mode: already returned early above (PlayerModeOverlay handles 't').
        blockController.toggleSplitView();
        break;
      }
      case 'toggle-player-mode': {
        blockController.togglePlayerMode();
        break;
      }
      case 'toggle-translate': {
        // ADR-021 D7: temporary toggle (no setting change). Same logic as
        // SHORTCUT_ACTION handler above — extract to shared helper if grows.
        if (ctx.getTranslatePrefill()?.isRunning) {
          ctx.getTranslatePrefill()?.clear();
          ctx.setTranslatePrefill(null);
          blockController?.loadBilingualCues(syncController.latestTargetCues, []);
          ctx.setBilingualCues(mergeCuesForPanel(syncController.latestTargetCues, []));
          // latestNativeCues tracked by blockController — no longer needed here
          // updateCues(syncController.latestTargetCues, []);
          showToast(t('subtitle.autoTranslate.off'), container, { variant: 'info' });
        } else if (syncController.latestTargetCues.length > 0) {
          void (async () => {
            const s = await loadSettings();
            const sl = s.subtitleOverlayTargetLanguage;
            const tl = s.subtitleOverlayNativeLanguage;
            if (!sl || !tl || sl === tl) return;
            ctx.getTranslatePrefill()?.clear();
            const translatePrefill = new BackgroundPrefillController({
              translate: createTranslateFunction(sl, tl),
              onChunkTranslated: (translatedCues: SrtCue[]) => {
                blockController?.loadBilingualCues(syncController.latestTargetCues, translatedCues);
                ctx.showOverlay();
                ctx.setBilingualCues(mergeCuesForPanel(syncController.latestTargetCues, translatedCues));
                // updateCues(syncController.latestTargetCues, translatedCues);
                broadcastCues(ctx.getBilingualCues());
              },
              onError: (msg: string) => {
                showToast(msg, container, { variant: 'error' });
              },
            });
            ctx.setTranslatePrefill(translatePrefill);
            translatePrefill.start(syncController.latestTargetCues, sl, tl);
            showToast(t('subtitle.autoTranslate.on'), container, { variant: 'success' });
          })();
        }
        break;
      }
      case 'play-pause': {
        // ADR-030: route through playVideo/pauseVideo to avoid Netflix M7375.
        ctx.togglePlay();
        break;
      }
      // ADR-026: Card Creator entry shortcuts (q quick-update, e edit-card).
      // Guard: dialog open → let dialog handle keys. auto-repeat → no action.
      case 'quick-update':
      case 'edit-card': {
        if (e.repeat) return;
        if (sharedWebTextCtrl?.isCardCreatorOpen()) return;
        void ctx.handleCardCreatorAction(action);
        break;
      }
      case 'next-vocab-token': {
        ctx.nextVocabToken(e.shiftKey);
        break;
      }
      case 'prev-vocab-token': {
        ctx.prevVocabToken(e.shiftKey);
        break;
      }
      // Generate native subtitle manually (button or shortcut).
      case 'generate-native': {
        void ctx.handleGenerateNative();
        break;
      }
    }
  };

  // ADR-034 D2: also block keyup for configured actions. YouTube handles
  // space on keyup (not keydown) — if Cell pauses on keydown but lets keyup
  // through, YouTube's keyup handler plays the video again (double-toggle).
  // Same guard as keydown: skip editable targets, only block configured keys.
  const onKeyup = (e: KeyboardEvent) => {
    if (isEditableEvent(e)) return;

    // Match the keydown popup-open Space intercept — block the keyup too so a
    // host keyup handler (e.g. YouTube's space toggle) can't double-toggle.
    if (e.key.toLowerCase() === ' ' && sharedWebTextCtrl?.hasOpenPopup()) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }

    const realTarget = e.composedPath()[0] ?? e.target;
    const key = e.key.toLowerCase();

    if (realTarget instanceof HTMLElement && realTarget.closest('[data-cell-keycapture]')) {
      return;
    }

    const isActivationKey = key === ' ' || key === 'enter';

    // In Player Mode the overlay owns the keyboard; otherwise, let buttons and
    // links handle Enter/Space themselves. The Cell UI root stops the event
    // from leaking to the host after the focused control consumes it.
    if (isActivatableTarget(realTarget) && isActivationKey && !blockController.isPlayerModeActive) {
      return;
    }

    const action = handleShortcutKey(key, ctx.getShortcuts(), realTarget, {
      ctrl: e.ctrlKey,
      shift: e.shiftKey,
      alt: e.altKey,
    });

    if (action !== null && PAGE_LEVEL_ACTIONS.has(action)) return;

    if (action) {
      // The keydown handler already performed the action. Stop keyup too so
      // host keyup listeners (e.g. YouTube's space toggle) don't undo it.
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }

    // Block host keyup when focus is inside Cell UI and the key wasn't handled
    // by a focused control. Escape is allowed through so panels/escape layers
    // can close; don't preventDefault here so activatable controls still work.
    if (isInsideCellUi(e) && e.key !== 'Escape') {
      e.stopImmediatePropagation();
    }
  };

  return { onKeydown, onKeyup };
}
