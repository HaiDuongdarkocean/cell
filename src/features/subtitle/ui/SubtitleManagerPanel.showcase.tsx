import { useState, useCallback, type ReactElement } from 'react';
import { SubtitleManagerPanel, type AppearanceState } from './SubtitleManagerPanel';
import type { SubtitlePanelItem } from './subtitlePanelModel';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import type { SubtitleBlockSettings, NavClusterSettings, SubtitleApiKey, SubtitleApiKeyProvider, SubtitleApiKeyStatus } from '@/entities/settings';
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
  { id: 't4', name: 'English (US) — OpenSubtitles', format: 'srt', size: 28672, source: 'searched', role: 'target', index: 3 },
  { id: 't5', name: 'English (UK) — OpenSubtitles', format: 'vtt', size: 26214, source: 'searched', role: 'target', index: 4 },
  { id: 't6', name: 'English — YIFY', format: 'srt', size: 30208, source: 'searched', role: 'target', index: 5 },
  { id: 't7', name: 'English — Subscene', format: 'srt', size: 25600, source: 'searched', role: 'target', index: 6, isAsr: true },
  { id: 't8', name: 'English — Addic7ed', format: 'ass', size: 35840, source: 'searched', role: 'target', index: 7 },
  { id: 't9', name: 'English — Podnapisi', format: 'srt', size: 22528, source: 'searched', role: 'target', index: 8 },
  { id: 't10', name: 'custom-translation.ass', format: 'ass', size: 5120, source: 'imported', role: 'target', index: 9 },
  { id: 't11', name: 'English — TVSubtitles', format: 'srt', size: 20480, source: 'searched', role: 'target', index: 10 },
  { id: 't12', name: 'English (SDH)', format: 'srt', size: 33792, source: 'searched', role: 'target', index: 11, isAsr: true },
  { id: 't13', name: 'English — Subs.srt', format: 'srt', size: 19200, source: 'searched', role: 'target', index: 12 },
  { id: 't14', name: 'English — SubtitleCat', format: 'vtt', size: 24064, source: 'searched', role: 'target', index: 13 },
  { id: 't15', name: 'backup-subs.srt', format: 'srt', size: 6144, source: 'imported', role: 'target', index: 14 },
];

const mockNativeItems: SubtitlePanelItem[] = [
  { id: 'n1', name: 'Vietnamese (translated)', format: 'srt', source: 'translated', role: 'native', index: 0 },
  { id: 'n2', name: 'Tiếng Việt — OpenSubtitles', format: 'srt', size: 18432, source: 'searched', role: 'native', index: 1 },
  { id: 'n3', name: 'Vietnamese — Subscene', format: 'srt', size: 16384, source: 'searched', role: 'native', index: 2 },
  { id: 'n4', name: 'Tiếng Việt — Podnapisi', format: 'vtt', size: 14336, source: 'searched', role: 'native', index: 3 },
  { id: 'n5', name: 'Vietnamese (auto-translated)', format: 'srt', source: 'translated', role: 'native', index: 4, isAsr: true },
];

// === Mock API keys — many, various providers + statuses ===

function makeKey(
  provider: SubtitleApiKeyProvider,
  suffix: string,
  status: SubtitleApiKeyStatus,
  label: string,
  ageMinutes: number,
): SubtitleApiKey {
  return {
    id: `key-${provider}-${suffix}`,
    provider,
    key: `sk-${provider}-${suffix.padStart(4, '0')}-abcd-efgh-ijkl-mnop`,
    label,
    status,
    addedAt: Date.now() - ageMinutes * 60_000,
    ...(status === 'rate-limited' ? { rateLimitedUntil: Date.now() + 30 * 60_000 } : {}),
  };
}

const mockApiKeys: SubtitleApiKey[] = [
  // SubDL — active
  makeKey('subdl', '1', 'active', 'Free #1', 60),
  makeKey('subdl', '2', 'active', 'Free #2', 120),
  makeKey('subdl', '3', 'active', 'Premium', 30),
  makeKey('subdl', '4', 'active', 'Work account', 1440),
  makeKey('subdl', '5', 'active', 'Backup', 2880),
  // SubDL — other statuses
  makeKey('subdl', '6', 'rate-limited', 'Rate limited key', 720),
  makeKey('subdl', '7', 'invalid', 'Old invalid key', 5760),
  makeKey('subdl', '8', 'unverified', 'Just added', 5),
  // OpenSubtitles — active
  makeKey('opensubtitles', '1', 'active', 'Free #1', 90),
  makeKey('opensubtitles', '2', 'active', 'Free #2', 200),
  makeKey('opensubtitles', '3', 'active', 'VIP account', 45),
  makeKey('opensubtitles', '4', 'active', 'Backup VIP', 360),
  makeKey('opensubtitles', '5', 'active', 'Test key', 600),
  // OpenSubtitles — other statuses
  makeKey('opensubtitles', '6', 'rate-limited', 'Hit daily limit', 180),
  makeKey('opensubtitles', '7', 'invalid', 'Expired key', 4320),
  makeKey('opensubtitles', '8', 'unverified', 'Pending verify', 2),
];

// === Mock search results — 40+ results, various providers/langs/formats ===

const LANGS = ['en', 'vi', 'es', 'fr', 'de', 'ja', 'ko', 'zh', 'pt', 'it', 'ru', 'ar', 'hi', 'th', 'id'];
const PROVIDER_LANG_NAMES: Record<string, string> = {
  en: 'English', vi: 'Vietnamese', es: 'Spanish', fr: 'French', de: 'German',
  ja: 'Japanese', ko: 'Korean', zh: 'Chinese', pt: 'Portuguese', it: 'Italian',
  ru: 'Russian', ar: 'Arabic', hi: 'Hindi', th: 'Thai', id: 'Indonesian',
};
const FORMATS = ['srt', 'vtt', 'ass'] as const;
const SOURCES = ['subdl', 'opensubtitles'] as const;

function makeResult(i: number, langOverride?: string): SubtitleSearchResult {
  const lang = langOverride ?? LANGS[i % LANGS.length];
  const format = FORMATS[i % FORMATS.length];
  const source = SOURCES[i % SOURCES.length];
  const langName = PROVIDER_LANG_NAMES[lang] ?? lang;
  const isArchive = i % 7 === 0;
  const sdh = i % 5 === 0;
  const forced = i % 11 === 0;
  const rating = ((i * 37) % 50) / 10;
  const downloads = ((i * 911) % 50000) + 100;

  return {
    id: `result-${i}`,
    name: `${langName} — ${source === 'subdl' ? 'SubDL' : 'OpenSubtitles'} #${i + 1}${sdh ? ' (SDH)' : ''}${forced ? ' (Forced)' : ''}${isArchive ? ' (zip)' : ''}`,
    providerLanguage: langName,
    isoLanguage: lang,
    format,
    download: source === 'opensubtitles'
      ? { kind: 'handshake', fileId: 1000 + i }
      : { kind: 'direct', url: `https://api.subdl.com/dl/${i}` },
    source,
    rating,
    downloads,
    sdh,
    forced,
    isArchive,
  };
}

// Generate 120 results: 40 English, 30 Vietnamese, 50 other languages
const mockSearchResults: SubtitleSearchResult[] = [
  ...Array.from({ length: 40 }, (_, i) => makeResult(i, 'en')),
  ...Array.from({ length: 30 }, (_, i) => makeResult(i + 40, 'vi')),
  ...Array.from({ length: 50 }, (_, i) => makeResult(i + 70)),
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
  const [apiKeys, setApiKeys] = useState<SubtitleApiKey[]>(mockApiKeys);
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
        apiKeys={apiKeys}
        onApiKeysChange={setApiKeys}
        onSearchResultSelect={(_r: SubtitleSearchResult, _role: 'target' | 'native') => {}}
        mockSearchResults={mockSearchResults}
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
