import { useCallback, useState } from 'react';
import { PlayerModeOverlay } from '@/features/subtitle/ui/PlayerModeOverlay';
import { SubtitleManagerPanel } from '@/features/subtitle/ui/SubtitleManagerPanel';
import { Sheet } from '@/shared/ui/Sheet';
import { MOCK_CUES, MOCK_TARGET_STYLE, MOCK_NATIVE_STYLE } from './mockData';
import type { SubtitlePanelItem } from '@/features/subtitle/ui/subtitlePanelModel';

const MOCK_TARGET_ITEMS: SubtitlePanelItem[] = [
  { id: 't1', name: 'English #1', format: 'vtt', source: 'auto', role: 'target', index: 0 },
  { id: 't2', name: 'English (auto-sync)', format: 'srt', source: 'searched', role: 'target', index: 1 },
];
const MOCK_NATIVE_ITEMS: SubtitlePanelItem[] = [
  { id: 'n1', name: 'Vietnamese (translated)', format: 'vtt', source: 'translated', role: 'native', index: 0 },
];

export function RealPanel(): React.ReactElement {
  const [playing, setPlaying] = useState(false);
  const [timeMs, setTimeMs] = useState(352000);
  const [managerOpen, setManagerOpen] = useState(false);
  const noop = useCallback((): void => undefined, []);
  return (
    <>
      <PlayerModeOverlay
        targetStyle={MOCK_TARGET_STYLE}
        nativeStyle={MOCK_NATIVE_STYLE}
        isPlaying={playing}
        repeatActive={false}
        repeatIcon="navRepeat"
        videoAspectRatio={16 / 9}
        generateNativeEnabled
        toolsExpanded
        onQuickAdd={noop}
        onEditCard={noop}
        onToggleOcr={noop}
        onToggleManager={() => setManagerOpen(true)}
        onGenerateNative={noop}
        onToggleSidePanel={noop}
        onToggleTools={noop}
        onPrev={noop}
        onNext={noop}
        onRepeat={noop}
        onRewind={noop}
        onForward={noop}
        onPlayPause={() => setPlaying((p) => !p)}
        onToggleCollapsed={noop}
        onExit={noop}
        cues={MOCK_CUES}
        currentTimeMs={timeMs}
        onSeek={setTimeMs}
        tokenize={{ langCode: 'en', onTokenClick: noop }}
        trackLabel="English #1"
      />
      <Sheet
        open={managerOpen}
        onClose={() => setManagerOpen(false)}
        aria-label="Subtitle Manager"
        data-cell-id="subtitle-manager-layer"
      >
        <SubtitleManagerPanel
          targetItems={MOCK_TARGET_ITEMS}
          nativeItems={MOCK_NATIVE_ITEMS}
          targetActiveIndex={0}
          nativeActiveIndex={0}
          onSelect={noop}
          onClose={() => setManagerOpen(false)}
          onImport={noop}
          onGenerateNative={noop}
          hasSearchKeys={false}
          apiKeys={[]}
          onApiKeysChange={noop}
          onSearchResultSelect={noop}
          inSheet
        />
      </Sheet>
    </>
  );
}
