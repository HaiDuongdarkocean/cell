import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SrtCue } from '@/entities/media';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import type {
  Settings,
  SubtitleBlockSettings,
  NavClusterSettings,
} from '@/entities/settings';
import type { AppearanceState } from '@/features/subtitle/ui/subtitlePanelsTypes';
import { cuesToSrt } from '@/features/subtitle/logic/cuesToSrt';
import {
  DEFAULT_OVERLAY_STYLE_TARGET,
  DEFAULT_OVERLAY_STYLE_NATIVE,
} from '@/shared/config/config';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import { t } from '@/shared/i18n';

const PERSIST_DEBOUNCE_MS = 400;

export interface ManagerEngine {
  readonly targetStyle: OverlayStyleConfig;
  readonly nativeStyle: OverlayStyleConfig;
  readonly blockSettings: SubtitleBlockSettings;
  readonly clusterSettings: NavClusterSettings;
  readonly updateStyle: (
    role: 'target' | 'native',
    partial: Partial<OverlayStyleConfig>,
  ) => void;
  readonly updateBlockSettings: (partial: Partial<SubtitleBlockSettings>) => void;
  readonly updateClusterSettings: (partial: Partial<NavClusterSettings>) => void;
  readonly getTargetCues: () => readonly SrtCue[];
  readonly getNativeCues: () => readonly SrtCue[];
  readonly setOffset: (ms: number) => void;
}

export interface ManagerControls {
  readonly targetHidden: boolean;
  readonly nativeHidden: boolean;
  readonly appearance: AppearanceState;
  readonly onHideSection: (role: 'target' | 'native') => void;
  readonly onHideBoth: () => void;
  readonly onOffsetChange: (role: 'target' | 'native', ms: number) => void;
  readonly onDownloadItem: (role: 'target' | 'native', index: number) => void;
}

export function useManagerControls(engine: ManagerEngine): ManagerControls {
  const {
    targetStyle,
    nativeStyle,
    blockSettings,
    clusterSettings,
    updateStyle,
    updateBlockSettings,
    updateClusterSettings,
    getTargetCues,
    getNativeCues,
    setOffset,
  } = engine;

  const [targetHidden, setTargetHidden] = useState(false);
  const [nativeHidden, setNativeHidden] = useState(false);

  const [previewTargetText, setPreviewTargetText] = useState(
    t('player.manager.previewTarget'),
  );
  const [previewNativeText, setPreviewNativeText] = useState(
    t('player.manager.previewNative'),
  );

  const stylePersistRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockPersistRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clusterPersistRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewTextPersistRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void (async (): Promise<void> => {
      try {
        const settings = await loadSettings();
        if (settings.subtitleOverlayTargetStyle) {
          updateStyle('target', settings.subtitleOverlayTargetStyle);
        }
        if (settings.subtitleOverlayNativeStyle) {
          updateStyle('native', settings.subtitleOverlayNativeStyle);
        }
        if (settings.subtitleBlockSettings) {
          updateBlockSettings(settings.subtitleBlockSettings);
        }
        if (settings.navClusterEnabled !== undefined) {
          updateClusterSettings({
            enabled: settings.navClusterEnabled,
            buttonSize: settings.navClusterButtonSize,
            textOpacity: settings.navClusterTextOpacity,
            bgOpacity: settings.navClusterButtonBgOpacity,
          });
        }
        if (
          typeof settings.subtitlePreviewTargetText === 'string' &&
          settings.subtitlePreviewTargetText
        ) {
          setPreviewTargetText(settings.subtitlePreviewTargetText);
        }
        if (
          typeof settings.subtitlePreviewNativeText === 'string' &&
          settings.subtitlePreviewNativeText
        ) {
          setPreviewNativeText(settings.subtitlePreviewNativeText);
        }
      } catch {}
    })();
  }, [updateStyle, updateBlockSettings, updateClusterSettings]);

  const handleHideSection = useCallback(
    (role: 'target' | 'native'): void => {
      if (role === 'target') {
        setTargetHidden((prev) => {
          const next = !prev;
          updateStyle('target', { visible: !next });
          return next;
        });
      } else {
        setNativeHidden((prev) => {
          const next = !prev;
          updateStyle('native', { visible: !next });
          return next;
        });
      }
    },
    [updateStyle],
  );

  const handleHideBoth = useCallback((): void => {
    const bothHidden = targetHidden && nativeHidden;
    if (bothHidden) {
      setTargetHidden(false);
      setNativeHidden(false);
      updateStyle('target', { visible: true });
      updateStyle('native', { visible: true });
    } else {
      setTargetHidden(true);
      setNativeHidden(true);
      updateStyle('target', { visible: false });
      updateStyle('native', { visible: false });
    }
  }, [targetHidden, nativeHidden, updateStyle]);

  const handleDownloadItem = useCallback(
    (role: 'target' | 'native', _index: number): void => {
      const cues = role === 'target' ? getTargetCues() : getNativeCues();
      if (cues.length === 0) return;
      const srt = cuesToSrt(cues);
      const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${role}-subtitle.srt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [getTargetCues, getNativeCues],
  );

  const handleOffsetChange = useCallback(
    (_role: 'target' | 'native', ms: number): void => {
      setOffset(ms);
    },
    [setOffset],
  );

  const handleStyleChange = useCallback(
    (role: 'target' | 'native', partial: Partial<OverlayStyleConfig>): void => {
      updateStyle(role, partial);
      const merged = {
        ...(role === 'target' ? targetStyle : nativeStyle),
        ...partial,
      };
      if (stylePersistRef.current) clearTimeout(stylePersistRef.current);
      stylePersistRef.current = setTimeout(() => {
        const key =
          role === 'target'
            ? 'subtitleOverlayTargetStyle'
            : 'subtitleOverlayNativeStyle';
        void saveSettings({ [key]: merged } as Partial<Settings>);
        stylePersistRef.current = null;
      }, PERSIST_DEBOUNCE_MS);
    },
    [updateStyle, targetStyle, nativeStyle],
  );

  const handleBlockSettingsChange = useCallback(
    (partial: Partial<SubtitleBlockSettings>): void => {
      updateBlockSettings(partial);
      const merged = { ...blockSettings, ...partial };
      if (blockPersistRef.current) clearTimeout(blockPersistRef.current);
      blockPersistRef.current = setTimeout(() => {
        void saveSettings({ subtitleBlockSettings: merged });
        blockPersistRef.current = null;
      }, PERSIST_DEBOUNCE_MS);
    },
    [updateBlockSettings, blockSettings],
  );

  const handleClusterSettingsChange = useCallback(
    (partial: Partial<NavClusterSettings>): void => {
      updateClusterSettings(partial);
      const merged = { ...clusterSettings, ...partial };
      if (clusterPersistRef.current) clearTimeout(clusterPersistRef.current);
      clusterPersistRef.current = setTimeout(() => {
        void saveSettings({
          navClusterEnabled: merged.enabled,
          navClusterButtonSize: merged.buttonSize,
          navClusterTextOpacity: merged.textOpacity,
          navClusterButtonBgOpacity: merged.bgOpacity,
        });
        clusterPersistRef.current = null;
      }, PERSIST_DEBOUNCE_MS);
    },
    [updateClusterSettings, clusterSettings],
  );

  const handleResetStyle = useCallback(
    (role: 'target' | 'native'): void => {
      const defaults =
        role === 'target'
          ? DEFAULT_OVERLAY_STYLE_TARGET
          : DEFAULT_OVERLAY_STYLE_NATIVE;
      updateStyle(role, defaults);
      const key =
        role === 'target'
          ? 'subtitleOverlayTargetStyle'
          : 'subtitleOverlayNativeStyle';
      void saveSettings({ [key]: defaults } as Partial<Settings>);
    },
    [updateStyle],
  );

  const handlePreviewTextChange = useCallback(
    (role: 'target' | 'native', text: string): void => {
      if (role === 'target') setPreviewTargetText(text);
      else setPreviewNativeText(text);
      if (previewTextPersistRef.current) clearTimeout(previewTextPersistRef.current);
      previewTextPersistRef.current = setTimeout(() => {
        const key =
          role === 'target'
            ? 'subtitlePreviewTargetText'
            : 'subtitlePreviewNativeText';
        void saveSettings({ [key]: text } as Partial<Settings>);
        previewTextPersistRef.current = null;
      }, PERSIST_DEBOUNCE_MS);
    },
    [],
  );

  useEffect(() => {
    return (): void => {
      if (stylePersistRef.current) clearTimeout(stylePersistRef.current);
      if (blockPersistRef.current) clearTimeout(blockPersistRef.current);
      if (clusterPersistRef.current) clearTimeout(clusterPersistRef.current);
      if (previewTextPersistRef.current) clearTimeout(previewTextPersistRef.current);
    };
  }, []);

  const appearance: AppearanceState = useMemo(
    () => ({
      targetStyle,
      nativeStyle,
      blockSettings,
      clusterSettings,
      defaultTargetStyle: DEFAULT_OVERLAY_STYLE_TARGET,
      defaultNativeStyle: DEFAULT_OVERLAY_STYLE_NATIVE,
      previewTargetText,
      previewNativeText,
      onStyleChange: handleStyleChange,
      onBlockSettingsChange: handleBlockSettingsChange,
      onClusterSettingsChange: handleClusterSettingsChange,
      onResetStyle: handleResetStyle,
      onPreviewTextChange: handlePreviewTextChange,
    }),
    [
      targetStyle,
      nativeStyle,
      blockSettings,
      clusterSettings,
      previewTargetText,
      previewNativeText,
      handleStyleChange,
      handleBlockSettingsChange,
      handleClusterSettingsChange,
      handleResetStyle,
      handlePreviewTextChange,
    ],
  );

  return useMemo(
    () => ({
      targetHidden,
      nativeHidden,
      appearance,
      onHideSection: handleHideSection,
      onHideBoth: handleHideBoth,
      onOffsetChange: handleOffsetChange,
      onDownloadItem: handleDownloadItem,
    }),
    [
      targetHidden,
      nativeHidden,
      appearance,
      handleHideSection,
      handleHideBoth,
      handleOffsetChange,
      handleDownloadItem,
    ],
  );
}
