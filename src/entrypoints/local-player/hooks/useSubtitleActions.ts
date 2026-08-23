/**
 * useSubtitleActions — builds SubtitleActionContext for local-player + exposes
 * card/dictionary/generate-native handlers wired to the shared action module.
 *
 * This hook bridges local-player state (video ref, cues store, subtitle engine)
 * to the shared subtitle actions (cardActions.ts, generateNativeAction.ts)
 * that content-script also uses — SSOT for card/dictionary/generate-native logic.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import {
  DEFAULT_CARD_CREATOR_SETTINGS,
  DEFAULT_DICTIONARY_POPUP_SETTINGS,
} from '@/shared/config/config';
import { createWebTextDictionaryController } from '@/features/dictionaryPopup/controller/webTextDictionaryController';
import type { WebTextDictionaryController } from '@/features/dictionaryPopup/controller/webTextDictionaryController';
import { handleCardCreatorAction } from '@/features/subtitle/actions/cardActions';
import { startGenerateNative } from '@/features/subtitle/actions/generateNativeAction';
import type { SubtitleActionContext } from '@/features/subtitle/actions/subtitleActionContext';
import type { CardCreatorAction } from '@/features/subtitle/ui/subtitleCueEngine';
import { useCuesStore } from '@/stores/cuesStore';
import type { SrtCue } from '@/entities/media';

export interface SubtitleActionHandlers {
  onQuickAdd: () => void;
  onEditCard: () => void;
  onUpdateCurrentCard: () => void;
  onGenerateNative: () => void;
  generateNativeEnabled: boolean;
}

export interface UseSubtitleActionsDeps {
  readonly videoRef: React.RefObject<HTMLVideoElement | null>;
  readonly offsetMs: number;
}

/** Find current target cue text by playback time. */
function findCurrentCueText(cues: readonly SrtCue[], currentMs: number): string {
  const cue = cues.find((c) => currentMs >= c.start && currentMs <= c.end);
  return cue?.text ?? '';
}

export function useSubtitleActions(deps: UseSubtitleActionsDeps): SubtitleActionHandlers {
  const { videoRef, offsetMs } = deps;
  const [generateNativeEnabled, setGenerateNativeEnabled] = useState(false);
  const webTextCtrlRef = useRef<WebTextDictionaryController | null>(null);

  // Cues from global store (driven by SubtitleCueEngine).
  const targetCues = useCuesStore((s) => s.targetCues);

  // Create webTextCtrl on mount — owns Card Creator dialog + dictionary popup.
  useEffect(() => {
    const ctrl = createWebTextDictionaryController({
      container: document.body,
      dictionaryPopupSettings: DEFAULT_DICTIONARY_POPUP_SETTINGS,
      cardCreatorSettings: DEFAULT_CARD_CREATOR_SETTINGS,
      hasVideo: true,
      video: videoRef.current ?? undefined,
      getTargetCues: () => useCuesStore.getState().targetCues,
    });
    webTextCtrlRef.current = ctrl;

    // Load settings + update controller config.
    void loadSettings().then((settings) => {
      ctrl.updateSettings({
        dictionaryPopup: settings.dictionaryPopup ?? DEFAULT_DICTIONARY_POPUP_SETTINGS,
        cardCreator: settings.cardCreator ?? DEFAULT_CARD_CREATOR_SETTINGS,
        subtitleOverlayNativeLanguage: settings.subtitleOverlayNativeLanguage,
      });
    });

    return () => {
      ctrl.destroy();
      webTextCtrlRef.current = null;
    };
  }, [videoRef]);

  // Update generateNativeEnabled when cues or settings change.
  useEffect(() => {
    void loadSettings().then((settings) => {
      const sl = settings.subtitleOverlayTargetLanguage ?? '';
      const tl = settings.subtitleOverlayNativeLanguage ?? '';
      setGenerateNativeEnabled(sl !== '' && tl !== '' && sl !== tl && targetCues.length > 0);
    }).catch(() => setGenerateNativeEnabled(false));
  }, [targetCues]);

  /** Build SubtitleActionContext from current state. */
  const buildContext = useCallback((): SubtitleActionContext => {
    const video = videoRef.current;
    if (!video) throw new Error('useSubtitleActions: video ref is null');

    return {
      video,
      container: document.body,
      webTextCtrl: webTextCtrlRef.current ?? undefined,
      getTargetCues: () => useCuesStore.getState().targetCues,
      getNativeCues: () => useCuesStore.getState().nativeCues,
      getCurrentTargetText: () => {
        const cues = useCuesStore.getState().targetCues;
        const currentMs = video.currentTime * 1000 + offsetMs;
        return findCurrentCueText(cues, currentMs);
      },
      getCurrentNativeText: () => {
        const cues = useCuesStore.getState().nativeCues;
        const currentMs = video.currentTime * 1000 + offsetMs;
        return findCurrentCueText(cues, currentMs);
      },
      getOffsetMs: () => offsetMs,
      showToast: (message, options) => {
        // ponytail: simple console toast for now — local-player doesn't have
        // the subtitle toast system. Can be upgraded to a real toast later.
        const variant = options?.variant ?? 'info';
        console.log(`[local-player] ${variant}: ${message}`);
      },
      loadSettingsOrToast: async (_container: HTMLElement) => {
        try {
          return await loadSettings();
        } catch {
          console.error('[local-player] Cannot load settings — storage unavailable.');
          return undefined;
        }
      },
    };
  }, [videoRef, offsetMs]);

  const handleAction = useCallback((action: CardCreatorAction) => {
    const ctx = buildContext();
    void handleCardCreatorAction(ctx, action);
  }, [buildContext]);

  const handleGenerate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const ctx = buildContext();
    const targetCuesSnapshot = [...useCuesStore.getState().targetCues];

    void startGenerateNative(targetCuesSnapshot, {
      onChunkTranslated: (translatedCues) => {
        // Load translated cues as native cues into the store.
        useCuesStore.getState().setCues(targetCuesSnapshot, translatedCues);
      },
      onError: (msg) => {
        ctx.showToast(msg, { variant: 'error' });
        setGenerateNativeEnabled(true);
      },
      onComplete: () => {
        ctx.showToast('Native subtitle generated', { variant: 'success' });
        setGenerateNativeEnabled(true);
      },
    }).then((result) => {
      if (!result) {
        ctx.showToast('Cannot generate native — check language settings.', { variant: 'info' });
        return;
      }
      ctx.showToast('Generating native subtitle…', { variant: 'info' });
      setGenerateNativeEnabled(false);
    });
  }, [videoRef, buildContext]);

  return useMemo(() => ({
    onQuickAdd: () => handleAction('quick-update'),
    onEditCard: () => handleAction('edit-card'),
    onUpdateCurrentCard: () => handleAction('update-current'),
    onGenerateNative: handleGenerate,
    generateNativeEnabled,
  }), [handleAction, handleGenerate, generateNativeEnabled]);
}
