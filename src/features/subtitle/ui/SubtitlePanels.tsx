import { useState, useImperativeHandle, forwardRef, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { NavClusterSettings, SubtitleBlockSettings, BilingualCue } from '@/entities/media';
import { SubtitleBlock } from './SubtitleBlock';
import { NavCluster } from './NavCluster';
import { ClusterRightToolbar } from './ClusterRightToolbar';
import { ManagerLayer } from './ManagerLayer';
import { OffsetLayer } from './OffsetLayer';
import { SubtitleToast } from './SubtitleToast';
import { useToasts } from './subtitleToasts';
import { SubtitleHint } from './SubtitleHint';
import { useSubtitleBlockDrag } from './subtitleDrag';
import { usePlayerMode } from './subtitlePlayerMode';
import { PlayerModeLayer } from './PlayerModeLayer';
import { SubtitlePanel } from './SubtitlePanel';
import { saveCueToQueue } from '@/features/miningQueue';
import { canonicalNavUrl } from './contentScriptShared';
import { useOverlayPortals } from './subtitlePortals';
import { useSplitView } from './subtitleSplitView';
import { ShadowThemeProvider } from '@/features/theme';
import { useIsMobile } from '@/shared/ui/useIsMobile';
import { loadStudyModeState, useStudyModeStore } from '@/features/studyModes';
import { BREAKPOINTS } from '@/shared/lib/tokens';
import { buildClusterCssVars } from './subtitleUI';
import styles from './SubtitlePanels.module.css';
import { useManagerHostDelegation } from './subtitleManagerHost';
import { t } from '@/shared/i18n';
import type { SubtitlePracticeMode } from '@/features/studyModes';
import type { PlaybackSpeed } from '@/entities/studyMode/types';
import type {
  ManagerState,
  OffsetState,
  SubtitlePanelsRef,
  SubtitlePanelsProps,
  IconCatalogKey,
} from './subtitlePanelsTypes';

// Re-export for backward compatibility — SSOT lives in subtitlePanelsTypes.ts
export type {
  ManagerState,
  OffsetState,
  SubtitlePanelsRef,
  SubtitlePanelsProps,
  AppearanceState,
} from './subtitlePanelsTypes';

export const SubtitlePanels = forwardRef<SubtitlePanelsRef, SubtitlePanelsProps>(
  function SubtitlePanels(
    {
      targetStyle: initialTargetStyle,
      nativeStyle: initialNativeStyle,
      collapsed: initialCollapsed,
      isPlaying: initialIsPlaying,
      repeatActive: initialRepeatActive,
      repeatIcon: initialRepeatIcon = 'repeat',
      repeatLabel: initialRepeatLabel = t('player.nav.repeat'),
      clusterSettings: initialClusterSettings,
      blockSettings: initialBlockSettings,
      yOffsetPercent: initialYOffsetPercent = 75,
      onDragReposition,
      onPrev,
      onNext,
      onRepeat,
      onRewind,
      onForward,
      onPlayPause,
      onToggleCollapsed,
      onQuickAdd,
      onEditCard,
      onToggleOcr,
      ocrEnabled,
      onGenerateNative,
      onToggleSidePanel,
      onToggleManager,
      manager: initialManager,
      offset: initialOffset,
      generateNativeEnabled: initialGenerateNativeEnabled = true,
      videoAspectRatio: initialVideoAspectRatio = 16 / 9,
      onTogglePlayerMode,
      cues: initialCues,
      currentTimeMs: initialCurrentTimeMs,
      offsetMs,
      onSeek,
      onSplitViewChange,
      managerShadowCss,
      playlistContent,
      filename,
      fallbackPlayerContainerRef,
      removeBracketed: initialRemoveBracketed = false,
      practiceMode: initialPracticeMode = 'off',
      onPracticeModeChange,
      onPlaybackSpeedChange,
      onPreviousCue,
      onReplayCue,
      onContinueCue,
      tokenize: initialTokenize = null,
    },
    ref,
  ): React.JSX.Element {
    const [targetStyle, setTargetStyle] = useState(initialTargetStyle);
    const [nativeStyle, setNativeStyle] = useState(initialNativeStyle);
    const [collapsed, setCollapsed] = useState(initialCollapsed);
    const [isPlaying, setIsPlaying] = useState(initialIsPlaying);
    const [repeatActive, setRepeatActive] = useState(initialRepeatActive);
    const [repeatIcon, setRepeatIcon] = useState<IconCatalogKey>(initialRepeatIcon);
    const [repeatLabel, setRepeatLabel] = useState(initialRepeatLabel);
    const [yOffsetPercent, setYOffsetPercent] = useState(initialYOffsetPercent);
    const [clusterSettings, setClusterSettingsState] = useState<NavClusterSettings | undefined>(initialClusterSettings);
    const [blockSettings, setBlockSettingsState] = useState<SubtitleBlockSettings | undefined>(initialBlockSettings);
    const [manager, setManager] = useState<ManagerState | undefined>(initialManager);
    // Sync manager prop → state when parent passes a *new* manager object
    // (e.g. local-player rebuilds ManagerState when subtitles change). Guard
    // against the first render where the prop is undefined but the controller
    // will immediately set the real state via the imperative ref.
    const lastInitialManagerRef = useRef(initialManager);
    useEffect(() => {
      if (initialManager !== lastInitialManagerRef.current) {
        lastInitialManagerRef.current = initialManager;
        setManager(initialManager);
      }
    }, [initialManager]);
    const [offset, setOffset] = useState<OffsetState | undefined>(initialOffset);
    const lastInitialOffsetRef = useRef(initialOffset);
    useEffect(() => {
      if (initialOffset !== lastInitialOffsetRef.current) {
        lastInitialOffsetRef.current = initialOffset;
        setOffset(initialOffset);
      }
    }, [initialOffset]);
    const [removeBracketed, setRemoveBracketed] = useState(initialRemoveBracketed);
    const [managerOpen, setManagerOpen] = useState(false);
    const [managerExiting, setManagerExiting] = useState(false);
    const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isMobile = useIsMobile(BREAKPOINTS.medium);
    const activeModeId = useStudyModeStore((s) => s.activeModeId);
    const customModes = useStudyModeStore((s) => s.customModes);
    const setActiveModeId = useStudyModeStore((s) => s.setActiveModeId);

    useEffect(() => {
      void loadStudyModeState();
    }, []);

    const handleStudyModeChange = useCallback((modeId: string): void => {
      setActiveModeId(modeId);
    }, [setActiveModeId]);
    // Desktop: trigger slide-out animation, then unmount after 280ms.
    // Mobile: unmount immediately (Sheet handles its own exit animation).
    const closeManager = useCallback(() => {
      if (!isMobile) {
        setManagerExiting(true);
        if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
        exitTimerRef.current = setTimeout(() => {
          setManagerOpen(false);
          setManagerExiting(false);
          exitTimerRef.current = null;
        }, 280);
      } else {
        setManagerOpen(false);
      }
    }, [isMobile]);
    const [offsetOpen, setOffsetOpen] = useState(false);
    const [hintOpen, setHintOpen] = useState(false);
    const { toasts, addToast, clearToasts, removeToast } = useToasts();
    const [generateNativeEnabled, setGenerateNativeEnabled] = useState(initialGenerateNativeEnabled);
    const [videoAspectRatio, setVideoAspectRatio] = useState(initialVideoAspectRatio);
    const [ocrEnabledState, setOcrEnabledState] = useState(ocrEnabled ?? false);
    const [toolsExpanded, setToolsExpanded] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const { managerPortalTarget } = useOverlayPortals({ rootRef, managerShadowCss, isMobile });
    const [playerMode, setPlayerMode] = useState(false);
    const [cues, setCues] = useState<readonly BilingualCue[]>(initialCues ?? []);
    const [tokenize, setTokenize] = useState(initialTokenize);
    const handleSaveCue = useCallback(
      (cue: BilingualCue): void => {
        saveCueToQueue(cue, {
          langCode: tokenize?.langCode,
          // Local-player hosts pass the media filename; content overlays get the
          // page title (document.title on an extension page would be ours).
          sourceLabel: filename ?? (typeof document !== 'undefined' ? document.title || undefined : undefined),
          videoId: filename ?? (typeof location !== 'undefined' ? canonicalNavUrl(location.href) : undefined),
          notify: addToast,
        });
      },
      [addToast, tokenize, filename],
    );
    const [currentTimeMs, setCurrentTimeMs] = useState(initialCurrentTimeMs ?? 0);
    const [practiceMode, setPracticeMode] = useState<SubtitlePracticeMode>(initialPracticeMode);
    const [panelBlurred, setPanelBlurred] = useState(false);
    const lastInitialPracticeModeRef = useRef(initialPracticeMode);
    useEffect(() => {
      if (initialPracticeMode !== lastInitialPracticeModeRef.current) {
        lastInitialPracticeModeRef.current = initialPracticeMode;
        setPracticeMode(initialPracticeMode);
      }
    }, [initialPracticeMode]);
    const handlePracticeModeChange = useCallback((mode: SubtitlePracticeMode): void => {
      setPracticeMode(mode);
      onPracticeModeChange?.(mode);
    }, [onPracticeModeChange]);
    const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
    const handlePlaybackSpeedChange = useCallback((speed: PlaybackSpeed): void => {
      setPlaybackSpeed(speed);
      onPlaybackSpeedChange?.(speed);
    }, [onPlaybackSpeedChange]);
    // Sync prop → state when cues change after mount (e.g. subtitle loaded later).
    useEffect(() => { setCues(initialCues ?? []); }, [initialCues]);
    useEffect(() => { setCurrentTimeMs(initialCurrentTimeMs ?? 0); }, [initialCurrentTimeMs]);
    const {
      splitViewOpen,
      splitViewPortalTarget,
      handleToggleSplitView,
      setSplitViewOpen,
      drainPendingRestore,
    } = useSplitView({ playerMode, onSplitViewChange, fallbackPlayerContainerRef });

    const handleSplitViewOpenChange = useCallback((open: boolean): void => {
      setSplitViewOpen(open);
      onSplitViewChange?.(open);
    }, [setSplitViewOpen, onSplitViewChange]);

    const prevPlayerModeRef = useRef(playerMode);
    useEffect(() => {
      const wasPlayerMode = prevPlayerModeRef.current;
      prevPlayerModeRef.current = playerMode;
      if (playerMode && !wasPlayerMode) handleSplitViewOpenChange(true);
    }, [playerMode, handleSplitViewOpenChange]);

    const { managerOpenOnHost } = useManagerHostDelegation({
      managerOpen,
      isMobile,
      manager,
      offset,
      generateNativeEnabled,
      closeManager,
    });

    const handleToggleCollapsed = useCallback((): void => {
      setCollapsed((prev) => !prev);
      onToggleCollapsed();
    }, [onToggleCollapsed]);

    const handlePlayPause = useCallback((): void => {
      onPlayPause();
    }, [onPlayPause]);

    const handleTogglePlayerMode = usePlayerMode({
      playerMode,
      setPlayerMode,
      onTogglePlayerMode,
      addToast,
      drainPendingRestore,
    });

    useImperativeHandle(
      ref,
      () => ({
        setStyles: (t, n) => { setTargetStyle(t); setNativeStyle(n); },
        setClusterSettings: (s) => setClusterSettingsState(s),
        setBlockSettings: (s) => setBlockSettingsState(s),
        setManager: (m) => setManager(m),
        setOffset: (o) => setOffset(o),
        setManagerOpen,
        setOffsetOpen,
        setHintOpen,
        addToast,
        clearToasts,
        setIsPlaying,
        setRepeatActive,
        setRepeatIcon,
        setRepeatLabel,
        setGenerateNativeEnabled,
        setVideoAspectRatio,
        setCollapsed,
        setYOffsetPercent,
        setCues,
        setTokenize,
        setCurrentTimeMs,
        setRemoveBracketed,
        togglePlayerMode: () => { void handleTogglePlayerMode(); },
        toggleSplitView: () => { handleToggleSplitView(); },
        setSplitViewOpen,
        setOcrEnabled: (enabled: boolean) => { setOcrEnabledState(enabled); },
        setPracticeMode: (mode: SubtitlePracticeMode) => { setPracticeMode(mode); },
        setPlaybackSpeed: (speed: PlaybackSpeed) => { setPlaybackSpeed(speed); },
        setPanelBlurred: (blurred: boolean) => { setPanelBlurred(blurred); },
      }),
      [addToast, clearToasts, handleTogglePlayerMode, handleToggleSplitView, setSplitViewOpen],
    );

    const { dragging, handlePointerDown, handlePointerMove, handlePointerUp } = useSubtitleBlockDrag({
      rootRef,
      yOffsetPercent,
      setYOffsetPercent,
      onDragReposition,
    });

    // Cluster settings CSS variables — áp dụng cho cả clusterLeft (NavCluster) + clusterRight
    // Cluster CSS vars — SSOT: buildClusterCssVars (shared with NavCluster + PlayerModeOverlay + OverlayPreview)
    const clusterRightStyle = buildClusterCssVars(clusterSettings);

    // Manager portal renders above every surface — including Player Mode
    // (the portal host carries max z-index, so the sheet floats over the PM
    // overlay). Without this shared hoist the manager was unreachable in PM.
    const managerPortal =
      managerOpen && manager && managerPortalTarget && !managerOpenOnHost
        ? createPortal(
            <ShadowThemeProvider container={managerPortalTarget}>
              <ManagerLayer
                manager={manager}
                isMobile={isMobile}
                exiting={managerExiting}
                onClose={closeManager}
                generateNativeEnabled={generateNativeEnabled}
              />
            </ShadowThemeProvider>,
            managerPortalTarget,
          )
        : null;

    if (playerMode) {
      return (
        <>
        <PlayerModeLayer
          targetStyle={targetStyle}
          nativeStyle={nativeStyle}
          isPlaying={isPlaying}
          repeatActive={repeatActive}
          repeatIcon={repeatIcon}
          repeatLabel={repeatLabel}
          clusterSettings={clusterSettings}
          blockSettings={blockSettings}
          videoAspectRatio={videoAspectRatio}
          onQuickAdd={onQuickAdd}
          onEditCard={onEditCard}
          onToggleOcr={onToggleOcr}
          ocrEnabled={ocrEnabledState}
          onGenerateNative={onGenerateNative}
          onToggleSidePanel={onToggleSidePanel}
          onToggleManager={onToggleManager}
          generateNativeEnabled={generateNativeEnabled}
          toolsExpanded={toolsExpanded}
          onToggleTools={() => setToolsExpanded((value) => !value)}
          onPrev={onPrev}
          onNext={onNext}
          onRepeat={onRepeat}
          onRewind={onRewind}
          onForward={onForward}
          onPlayPause={onPlayPause}
          onToggleCollapsed={handleToggleCollapsed}
          onExit={() => { void handleTogglePlayerMode(); }}
          yOffsetPercent={yOffsetPercent}
          setYOffsetPercent={setYOffsetPercent}
          onDragReposition={onDragReposition}
          cueListOpen={splitViewOpen}
          onCueListOpenChange={handleSplitViewOpenChange}
          cues={cues as BilingualCue[]}
          currentTimeMs={currentTimeMs}
          offsetMs={offsetMs}
          onSeek={onSeek}
          activeModeId={activeModeId}
          customModes={customModes}
          onStudyModeChange={handleStudyModeChange}
          practiceMode={practiceMode}
          onPracticeModeChange={handlePracticeModeChange}
          playbackSpeed={playbackSpeed}
          onPlaybackSpeedChange={handlePlaybackSpeedChange}
          onPreviousCue={onPreviousCue}
          onReplayCue={onReplayCue}
          onContinueCue={onContinueCue}
          tokenize={tokenize}
          panelBlurred={panelBlurred}
          onSaveCue={handleSaveCue}
        />
        {managerPortal}
        </>
      );
    }

    return (
      <div
        ref={rootRef}
        className={`${styles.root}${dragging ? ` ${styles.dragging}` : ''}`}
        style={{ '--sb-y': yOffsetPercent } as React.CSSProperties}
        data-cell-id="subtitle-panels-root"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className={styles.navLayer}>
          <NavCluster
            collapsed={collapsed}
            isPlaying={isPlaying}
            repeatActive={repeatActive}
            repeatIcon={repeatIcon}
            repeatLabel={repeatLabel}
            clusterSettings={clusterSettings}
            onToggleCollapsed={handleToggleCollapsed}
            onPrev={onPrev}
            onNext={onNext}
            onRepeat={onRepeat}
            onRewind={onRewind}
            onForward={onForward}
            onPlayPause={handlePlayPause}
          />
        </div>

        <div className={styles.blockLayer}>
          <SubtitleBlock targetStyle={targetStyle} nativeStyle={nativeStyle} blockSettings={blockSettings} removeBracketed={removeBracketed} />
        </div>

        {!collapsed && (
          <ClusterRightToolbar
            mode="overlay"
            clusterRightStyle={clusterRightStyle}
            onQuickAdd={onQuickAdd}
            onEditCard={onEditCard}
            onToggleOcr={onToggleOcr}
            ocrEnabled={ocrEnabledState}
            onToggleManager={onToggleManager}
            onGenerateNative={onGenerateNative}
            generateNativeEnabled={generateNativeEnabled}
            onToggleSidePanel={onToggleSidePanel ? handleToggleSplitView : undefined}
            sidePanelLabel={splitViewOpen ? t('subtitle.toolbar.closeList') : t('subtitle.toolbar.openList')}
            toolsExpanded={toolsExpanded}
            onToggleTools={() => setToolsExpanded((v) => !v)}
            onTogglePlayerMode={() => { void handleTogglePlayerMode(); }}
            playerMode={playerMode}
          />
        )}

        {managerPortal}

        {offsetOpen && offset && (
          <OffsetLayer offset={offset} />
        )}

        <div className={styles.toastLayer}>
          <SubtitleToast toasts={toasts} onRemove={removeToast} />
        </div>

        {hintOpen && (
          <div className={styles.hintLayer} data-cell-id="subtitle-hint-layer">
            <SubtitleHint onClick={() => setHintOpen(false)} />
          </div>
        )}

        {splitViewOpen && splitViewPortalTarget && onSeek && createPortal(
          <SubtitlePanel
            cues={cues as BilingualCue[]}
            currentTimeMs={currentTimeMs}
            offsetMs={offsetMs}
            onSeek={onSeek}
            onClose={handleToggleSplitView}
            playlistContent={playlistContent}
            filename={filename}
            activeModeId={activeModeId}
            customModes={customModes}
            onStudyModeChange={handleStudyModeChange}
            practiceMode={practiceMode}
            onPracticeModeChange={handlePracticeModeChange}
            isPlaying={isPlaying}
            playbackSpeed={playbackSpeed}
            onPlaybackSpeedChange={handlePlaybackSpeedChange}
            onPlayPause={onPlayPause}
            onPreviousCue={onPreviousCue}
            onReplayCue={onReplayCue}
            onContinueCue={onContinueCue}
            tokenize={tokenize}
            panelBlurred={panelBlurred}
            onSaveCue={handleSaveCue}
          />,
          splitViewPortalTarget,
        )}
      </div>
    );
  },
);
