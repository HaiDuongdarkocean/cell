import { useCallback, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
  getAllVideos,
  getAllSubtitles,
} from '@/features/local-player/services/mediaLibraryRepository';
import {
  useLocalPlayerStore,
  type LibrarySort,
} from './hooks/useLocalPlayerStore';
import { useSubtitleEngine } from './hooks/useSubtitleEngine';
import { useSubtitleActions } from './hooks/useSubtitleActions';
import { useFileCaches } from './hooks/useFileCaches';
import { useSubtitleMatching } from './hooks/useSubtitleMatching';
import { useVideoLibrary } from './hooks/useVideoLibrary';
import { useManagerControls } from './hooks/useManagerControls';
import { resumeService } from './logic/mediaPersistence';
import type { SortBy } from '@/features/local-player/logic/librarySort';
import { sortLibrary } from '@/features/local-player/logic/librarySort';
import type { SubtitleMatch } from '@/features/local-player/logic/subtitleMatch';
import type { ManagerState } from '@/features/subtitle/ui/subtitlePanelsTypes';
import { buildPanelItemsFromSubtitles } from './logic/subtitlePanelItems';
import { PlayerView } from './components/PlayerView';
import { ThemeProvider } from '@/features/theme/ui/ThemeProvider';
import { ErrorBoundary } from '@/shared/ui';
import { installRippleDelegation } from '@/shared/lib/dom/ripple';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { onStorageChanged } from '@/shared/lib/chrome-apis';
import { getActiveProfileSettings, type Settings } from '@/entities/settings';
import { STORAGE_KEYS } from '@/shared/config/config';
import { mountComprehensionPill } from '@/features/tokenize/ui/mountComprehensionPill';
import { comprehensionStore } from '@/features/tokenize/services/comprehensionStore';
import { startMediaScoreSource } from '@/features/subtitle/logic/mediaScoreSource';
import { startWordStatusCrossTabRelay } from '@/features/dictionary/services/wordStatusCrossTab';
import { useLibraryScores } from './hooks/useLibraryScores';
import { useImmersionSession } from './hooks/useImmersionSession';
import { t } from '@/shared/i18n';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import type { CondenseAudioStartPayload } from '@/entities/message';
import './styles/global.css';

installRippleDelegation(document);
document.title = t('settings.localPlayer.title');
startWordStatusCrossTabRelay();

export function LocalPlayerApp(): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentVideo = useLocalPlayerStore((s) => s.currentVideo);
  const videoFile = useLocalPlayerStore((s) => s.videoFile);
  const subtitles = useLocalPlayerStore((s) => s.subtitles);
  const subtitleStatus = useLocalPlayerStore((s) => s.subtitleStatus);
  const library = useLocalPlayerStore((s) => s.library);
  const subtitlesLibrary = useLocalPlayerStore((s) => s.subtitlesLibrary);
  const librarySort = useLocalPlayerStore((s) => s.librarySort);

  const setLibrary = useLocalPlayerStore((s) => s.setLibrary);
  const setSubtitlesLibrary = useLocalPlayerStore((s) => s.setSubtitlesLibrary);
  const setLibrarySort = useLocalPlayerStore((s) => s.setLibrarySort);

  const subtitleEngine = useSubtitleEngine(videoRef, videoFile);
  const subtitleActions = useSubtitleActions({
    videoRef,
    offsetMs: subtitleEngine.offsetMs,
  });

  const caches = useFileCaches();
  const {
    autoMatchSubtitles,
    matchPendingSubsForVideo,
    matchPendingSubsForCurrentVideo,
    handleOpenSubtitle,
    handleSelectTrack,
    handleSubtitleSelect,
  } = useSubtitleMatching({
    caches,
    loadCues: subtitleEngine.loadCues,
  });
  const {
    handleOpenFile,
    handleOpenFolder,
    handleFilesDrop,
    handleVideoSelect,
    handleVideoDelete,
    handleClearAll,
    handleTimeUpdate,
  } = useVideoLibrary({
    caches,
    videoRef,
    autoMatchSubtitles,
    matchPendingSubsForVideo,
    matchPendingSubsForCurrentVideo,
  });
  const controls = useManagerControls(subtitleEngine);

  useLibraryScores({
    videos: library,
    subtitles: subtitlesLibrary,
    fileMapRef: caches.subtitleFileMapRef,
    setLibrary,
  });

  useImmersionSession(videoRef, currentVideo?.id ?? null, videoFile);

  useEffect(() => {
    void (async (): Promise<void> => {
      const [videos, subs] = await Promise.all([getAllVideos(), getAllSubtitles()]);
      setLibrary(videos);
      setSubtitlesLibrary(subs);
    })();
  }, [setLibrary, setSubtitlesLibrary]);

  useEffect(() => {
    if (!currentVideo) return;
    const video = videoRef.current;
    if (!video) return;
    void (async (): Promise<void> => {
      const shouldResume = await resumeService.promptResume(
        currentVideo.id,
        currentVideo.durationMs,
        async (text) => window.confirm(text),
      );
      if (shouldResume) {
        const pos = await resumeService.getResumePosition(currentVideo.id);
        if (pos !== null) video.currentTime = pos / 1000;
      }
    })();
  }, [currentVideo]);

  const sortedLibrary = useMemo(
    () => sortLibrary(library, librarySort as SortBy),
    [library, librarySort],
  );
  const currentIndex = currentVideo
    ? sortedLibrary.findIndex((v) => v.id === currentVideo.id)
    : -1;
  const hasPrevVideo = currentIndex > 0;
  const hasNextVideo = currentIndex >= 0 && currentIndex < sortedLibrary.length - 1;
  const handlePrevVideo = useCallback((): void => {
    if (!hasPrevVideo) return;
    void handleVideoSelect(sortedLibrary[currentIndex - 1].id);
  }, [hasPrevVideo, sortedLibrary, currentIndex, handleVideoSelect]);
  const handleNextVideo = useCallback((): void => {
    if (!hasNextVideo) return;
    void handleVideoSelect(sortedLibrary[currentIndex + 1].id);
  }, [hasNextVideo, sortedLibrary, currentIndex, handleVideoSelect]);

  const handleSortChange = useCallback(
    (sortBy: SortBy): void => {
      setLibrarySort(sortBy as LibrarySort);
    },
    [setLibrarySort],
  );

  const manager: ManagerState = useMemo(() => {
    const items = buildPanelItemsFromSubtitles(subtitles);
    const allMatches: SubtitleMatch[] = [
      subtitles.target,
      subtitles.native,
      ...subtitles.others,
    ].filter(Boolean) as SubtitleMatch[];

    return {
      targetItems: items.targetItems,
      nativeItems: items.nativeItems,
      targetActiveIndex: items.targetActiveIndex,
      nativeActiveIndex: items.nativeActiveIndex,
      onSelect: (role, index) => {
        const list = role === 'target' ? items.targetItems : items.nativeItems;
        const item = list[index];
        if (!item) return;
        const filename = item.id.slice(role.length + 1);
        const match = allMatches.find((m) => m.filename === filename);
        if (match) void handleSelectTrack(match);
      },
      onImport: () => { void handleOpenSubtitle(); },
      onGenerateNative: subtitleActions.onGenerateNative,
      onOffsetChange: controls.onOffsetChange,
      onDownload: controls.onDownloadItem,
      onHideSection: controls.onHideSection,
      onHideBoth: controls.onHideBoth,
      targetHidden: controls.targetHidden,
      nativeHidden: controls.nativeHidden,
      bothHidden: controls.targetHidden && controls.nativeHidden,
      appearance: controls.appearance,
      hasSearchKeys: false,
      apiKeys: [],
      onApiKeysChange: () => {},
      onSearchResultSelect: () => {},
      onCondenseAudio: () => {
        if (!currentVideo?.fileHandle) return;
        const cues = subtitleEngine.getTargetCues();
        const source = cues.length > 0 ? cues : subtitleEngine.getNativeCues();
        if (source.length === 0) return;
        const payload: CondenseAudioStartPayload = {
          title: currentVideo.title || currentVideo.filename,
          leg: 'file',
          source: { kind: 'library', videoId: currentVideo.id },
          ranges: source.map((c) => ({ startMs: c.start, endMs: c.end })),
          durationMs: currentVideo.durationMs,
        };
        void sendMessage({ type: MESSAGE_TYPES.CONDENSE_AUDIO_START, payload });
      },
      condenseAudioEnabled:
        !!currentVideo?.fileHandle &&
        (subtitleEngine.getTargetCues().length > 0 || subtitleEngine.getNativeCues().length > 0),
    };
  }, [
    subtitles,
    handleSelectTrack,
    handleOpenSubtitle,
    subtitleActions.onGenerateNative,
    controls,
    currentVideo,
    subtitleEngine,
  ]);

  return (
    <PlayerView
      videoRef={videoRef}
      videoFile={videoFile}
      filename={videoFile?.name ?? null}
      subtitles={subtitles}
      subtitleStatus={subtitleStatus}
      library={sortedLibrary}
      subtitlesLibrary={subtitlesLibrary}
      librarySort={librarySort as SortBy}
      targetStyle={subtitleEngine.targetStyle}
      nativeStyle={subtitleEngine.nativeStyle}
      onOpenFile={() => { void handleOpenFile(); }}
      onOpenFolder={() => { void handleOpenFolder(); }}
      onOpenSubtitle={() => { void handleOpenSubtitle(); }}
      onSelectTrack={(m) => { void handleSelectTrack(m); }}
      onFilesDrop={handleFilesDrop}
      onVideoSelect={(id) => { void handleVideoSelect(id); }}
      onVideoDelete={(id) => { void handleVideoDelete(id); }}
      onClearAll={() => { void handleClearAll(); }}
      onSubtitleSelect={(id) => { void handleSubtitleSelect(id); }}
      onSortChange={handleSortChange}
      currentVideoId={currentVideo?.id ?? null}
      onTimeUpdate={handleTimeUpdate}
      subtitleEngine={subtitleEngine}
      manager={manager}
      subtitleActions={subtitleActions}
      hasPrevVideo={hasPrevVideo}
      hasNextVideo={hasNextVideo}
      onPrevVideo={handlePrevVideo}
      onNextVideo={handleNextVideo}
    />
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <ThemeProvider>
      <ErrorBoundary>
        <LocalPlayerApp />
      </ErrorBoundary>
    </ThemeProvider>,
  );
}

let mediaScoreStop: (() => void) | undefined;
let mediaScoreLang: string | undefined;
const applyMediaScoreSettings = (settings: Settings): void => {
  const langCode = getActiveProfileSettings(settings)?.resourceLangCode
    ?? (settings.subtitleOverlayTargetLanguage || 'en');
  if (langCode === mediaScoreLang) return;
  mediaScoreLang = langCode;
  mediaScoreStop?.();
  mediaScoreStop = startMediaScoreSource({
    langCode,
    store: comprehensionStore,
  });
};

void loadSettings().then((settings) => {
  mountComprehensionPill();
  applyMediaScoreSettings(settings);
});
onStorageChanged((changes, area) => {
  if (area !== 'local' || !(STORAGE_KEYS.SETTINGS in changes)) return;
  void loadSettings().then(applyMediaScoreSettings);
});
