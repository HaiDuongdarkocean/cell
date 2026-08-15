import { useState, useCallback, type ReactElement } from 'react';
import { SubtitleManagerPanel, type AppearanceState } from './SubtitleManagerPanel';
import type { SubtitlePanelItem } from './subtitlePanelModel';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import type { SubtitleBlockSettings, NavClusterSettings, SubtitleApiKey } from '@/entities/settings';
import type { SubtitleSearchResult } from '../logic/subtitleSearchTypes';
import {
  DEFAULT_OVERLAY_STYLE_TARGET,
  DEFAULT_OVERLAY_STYLE_NATIVE,
  DEFAULT_SUBTITLE_BLOCK_SETTINGS,
  DEFAULT_NAV_CLUSTER_SETTINGS,
} from '@/shared/config/config';
import styles from './SubtitleManagerPanel.showcase.module.css';

const mockTargetItems: SubtitlePanelItem[] = [
  { id: 't1', name: 'English #1', format: 'vtt', size: 24576, source: 'auto', role: 'target', index: 0, isAsr: true },
  { id: 't2', name: 'English #2', format: 'srt', size: 31744, source: 'auto', role: 'target', index: 1 },
  { id: 't3', name: 'my-subtitle.srt', format: 'srt', size: 4096, source: 'imported', role: 'target', index: 2 },
];

const mockNativeItems: SubtitlePanelItem[] = [
  { id: 'n1', name: 'Vietnamese (translated)', format: 'srt', source: 'translated', role: 'native', index: 0 },
];

function useMockAppearance(): AppearanceState {
  const [targetStyle, setTargetStyle] = useState<OverlayStyleConfig>(DEFAULT_OVERLAY_STYLE_TARGET);
  const [nativeStyle, setNativeStyle] = useState<OverlayStyleConfig>(DEFAULT_OVERLAY_STYLE_NATIVE);
  const [blockSettings, setBlockSettings] = useState<SubtitleBlockSettings>(DEFAULT_SUBTITLE_BLOCK_SETTINGS);
  const [clusterSettings, setClusterSettings] = useState<NavClusterSettings>(DEFAULT_NAV_CLUSTER_SETTINGS);
  const [previewTargetText, setPreviewTargetText] = useState('Hello world');
  const [previewNativeText, setPreviewNativeText] = useState('Xin chào');

  return {
    targetStyle,
    nativeStyle,
    blockSettings,
    clusterSettings,
    defaultTargetStyle: DEFAULT_OVERLAY_STYLE_TARGET,
    defaultNativeStyle: DEFAULT_OVERLAY_STYLE_NATIVE,
    previewTargetText,
    previewNativeText,
    onStyleChange: (role, partial) => {
      if (role === 'target') setTargetStyle((s) => ({ ...s, ...partial }));
      else setNativeStyle((s) => ({ ...s, ...partial }));
    },
    onBlockSettingsChange: (partial) => setBlockSettings((s) => ({ ...s, ...partial })),
    onClusterSettingsChange: (partial) => setClusterSettings((s) => ({ ...s, ...partial })),
    onResetStyle: (role) => {
      if (role === 'target') setTargetStyle(DEFAULT_OVERLAY_STYLE_TARGET);
      else setNativeStyle(DEFAULT_OVERLAY_STYLE_NATIVE);
    },
    onPreviewTextChange: (role, text) => {
      if (role === 'target') setPreviewTargetText(text);
      else setPreviewNativeText(text);
    },
  };
}

function PanelHost(): ReactElement {
  const [targetActive, setTargetActive] = useState(1);
  const [nativeActive, setNativeActive] = useState(0);
  const [bothHidden, setBothHidden] = useState(false);
  const appearance = useMockAppearance();

  const onSelect = useCallback((role: 'target' | 'native', index: number) => {
    if (role === 'target') setTargetActive(index);
    else setNativeActive(index);
  }, []);

  return (
    <div className={styles.host}>
      <SubtitleManagerPanel
        targetItems={mockTargetItems}
        nativeItems={mockNativeItems}
        targetActiveIndex={targetActive}
        nativeActiveIndex={nativeActive}
        onSelect={onSelect}
        onClose={() => {}}
        onImport={() => {}}
        onGenerateNative={() => {}}
        onOffsetChange={() => {}}
        generateNativeDisabled={false}
        appearance={appearance}
        hasSearchKeys
        apiKeys={[] as SubtitleApiKey[]}
        onApiKeysChange={() => {}}
        onSearchResultSelect={(_r: SubtitleSearchResult, _role: 'target' | 'native') => {}}
        onDownload={() => {}}
        onHideSection={() => {}}
        onHideBoth={() => setBothHidden((v) => !v)}
        targetHidden={false}
        nativeHidden={false}
        bothHidden={bothHidden}
      />
    </div>
  );
}

export function Showcase(): ReactElement {
  return (
    <div className={styles.showcase}>
      <div className={styles.stage}>
        <PanelHost />
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'SubtitleManagerPanel',
  description: 'Responsive subtitle manager — test panel layout across breakpoints 320→1280 via viewport selector.',
  level: 'pages' as const,
  category: 'Subtitle',
  order: 110,
};
