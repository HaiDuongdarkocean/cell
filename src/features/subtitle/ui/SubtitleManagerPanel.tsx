import { useState, useCallback, useEffect, useRef } from 'react';
import { Icon } from '@/shared/icons/Icon';
import { IconButton } from '@/shared/ui/IconButton';
import { Tabs } from '@/shared/ui/Tabs';
import { SubtitlePanelItem, formatBytes } from './subtitlePanelModel';
import { SubtitleSearchPanel } from './SubtitleSearchPanel';
import { SubtitleManagerFooter } from './SubtitleManagerFooter';
import { SubtitleStylePanel } from './appearance/SubtitleStylePanel';
import { SubtitleBlockSettingsPanel } from './appearance/SubtitleBlockSettingsPanel';
import { NavClusterSettingsPanel } from './appearance/NavClusterSettingsPanel';
import { OverlayPreview } from './appearance/OverlayPreview';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import type { SubtitleBlockSettings, NavClusterSettings, SubtitleApiKey } from '@/entities/settings';
import type { SubtitleSearchResult } from '../logic/subtitleSearchTypes';
import styles from './SubtitleManagerPanel.module.css';

export interface AppearanceState {
  targetStyle: OverlayStyleConfig;
  nativeStyle: OverlayStyleConfig;
  blockSettings: SubtitleBlockSettings;
  clusterSettings: NavClusterSettings;
  defaultTargetStyle: OverlayStyleConfig;
  defaultNativeStyle: OverlayStyleConfig;
  previewTargetText: string;
  previewNativeText: string;
  onStyleChange: (role: 'target' | 'native', partial: Partial<OverlayStyleConfig>) => void;
  onBlockSettingsChange: (partial: Partial<SubtitleBlockSettings>) => void;
  onClusterSettingsChange: (partial: Partial<NavClusterSettings>) => void;
  onResetStyle: (role: 'target' | 'native') => void;
  onPreviewTextChange: (role: 'target' | 'native', text: string) => void;
}

export interface SubtitleManagerPanelProps {
  targetItems: SubtitlePanelItem[];
  nativeItems: SubtitlePanelItem[];
  targetActiveIndex: number;
  nativeActiveIndex: number;
  targetLabel?: string;
  nativeLabel?: string;
  onSelect: (role: 'target' | 'native', index: number) => void;
  onClose: () => void;
  onImport?: (role: 'target' | 'native') => void;
  onGenerateNative?: () => void;
  onOffsetChange?: (role: 'target' | 'native', offsetMs: number) => void;
  generateNativeDisabled?: boolean;
  appearance?: AppearanceState;
  readonly hasSearchKeys: boolean;
  readonly apiKeys: readonly SubtitleApiKey[];
  readonly onApiKeysChange: (keys: SubtitleApiKey[]) => void;
  readonly onSearchResultSelect: (result: SubtitleSearchResult, role: 'target' | 'native') => void;
  /** Showcase-only: bypasses sendMessage with mock results for testing. */
  readonly mockSearchResults?: readonly SubtitleSearchResult[];
  /** Download a specific subtitle item to the user's machine. */
  readonly onDownload?: (role: 'target' | 'native', index: number) => void;
  /** Toggle hide/show for a section's subtitle in the overlay. */
  readonly onHideSection?: (role: 'target' | 'native') => void;
  /** Toggle hide/show for both target + native subtitles in the overlay. */
  readonly onHideBoth?: () => void;
  /** Whether target subtitle is currently hidden in the overlay. */
  readonly targetHidden?: boolean;
  /** Whether native subtitle is currently hidden in the overlay. */
  readonly nativeHidden?: boolean;
  /** Whether both subtitles are currently hidden in the overlay. */
  readonly bothHidden?: boolean;
}

type SaveState = 'idle' | 'saving' | 'saved';

interface SectionState {
  offset: string;
  saveState: SaveState;
  lastValid: number;
}

const defaultOffsets = { target: 0, native: 0 };
const OFFSET_STEP = 0.5;

function getSourceLabel(source: SubtitlePanelItem['source']): string {
  switch (source) {
    case 'imported':
      return 'Imported';
    case 'searched':
      return 'Searched';
    case 'translated':
      return 'Translated';
    default:
      return '';
  }
}

function roundSeconds(seconds: number): number {
  return Math.round(seconds * 1000) / 1000;
}

function formatSigned(seconds: number): string {
  if (seconds === 0) return '0';
  const sign = seconds > 0 ? '+' : '-';
  return `${sign}${Math.abs(seconds)}`;
}

function ItemRow({
  item,
  role,
  index,
  active,
  onSelect,
  onDownload,
}: {
  item: SubtitlePanelItem;
  role: 'target' | 'native';
  index: number;
  active: boolean;
  onSelect: (role: 'target' | 'native', index: number) => void;
  onDownload?: (role: 'target' | 'native', index: number) => void;
}): React.JSX.Element {
  return (
    <div
      data-cell-id={`manager-item-${role}-${index}`}
      role="option"
      aria-selected={active}
      tabIndex={0}
      className={[styles.track, active && styles.trackActive].filter(Boolean).join(' ')}
      onClick={() => onSelect(role, index)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(role, index);
        }
      }}
    >
      <span
        aria-hidden="true"
        className={[styles.radio, active && styles.radioActive].filter(Boolean).join(' ')}
      >
        {active && <span className={styles.radioDot} />}
      </span>
      <span className={styles.trackCopy}>
        <span className={styles.trackName}>{item.name}</span>
        <span className={styles.trackMeta}>
          <span className={styles.tag}>{item.format.toUpperCase()}</span>
          {item.isAsr && <span className={[styles.tag, styles.tagInfo].join(' ')}>AUTO</span>}
          {item.size !== undefined && <span className={styles.tag}>{formatBytes(item.size)}</span>}
          {getSourceLabel(item.source) && (
            <span className={[styles.tag, styles.tagSuccess].join(' ')}>{getSourceLabel(item.source)}</span>
          )}
        </span>
      </span>
      {onDownload && (
        <span className={styles.trackActions}>
          <IconButton
            size="sm"
            variant="ghost"
            aria-label={`Download ${item.name}`}
            data-cell-id={`manager-download-${role}-${index}`}
            onClick={(e) => {
              e.stopPropagation();
              onDownload(role, index);
            }}
          >
            <Icon name="download"  />
          </IconButton>
        </span>
      )}
    </div>
  );
}

function OffsetStepper({
  role,
  label,
  state,
  setState,
  onOffsetChange,
}: {
  role: 'target' | 'native';
  label: string;
  state: SectionState;
  setState: (s: SectionState) => void;
  onOffsetChange?: (role: 'target' | 'native', offsetMs: number) => void;
}): React.JSX.Element {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const AUTOSAVE_DELAY = 800;

  const commitOffset = useCallback(
    (offsetStr: string) => {
      const seconds = parseFloat(offsetStr);
      if (Number.isNaN(seconds)) {
        setState({ offset: formatSigned(state.lastValid), saveState: 'saved', lastValid: state.lastValid });
        return;
      }
      const rounded = roundSeconds(seconds);
      onOffsetChange?.(role, Math.round(rounded * 1000));
      setState({ offset: formatSigned(rounded), saveState: 'saved', lastValid: rounded });
    },
    [role, state.lastValid, setState, onOffsetChange],
  );

  const scheduleSave = useCallback(
    (offsetStr: string, newLastValid?: number) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const valid = newLastValid ?? state.lastValid;
      setState({ offset: offsetStr, saveState: 'saving', lastValid: valid });
      debounceRef.current = setTimeout(() => commitOffset(offsetStr), AUTOSAVE_DELAY);
    },
    [state.lastValid, setState, commitOffset],
  );

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    scheduleSave(e.target.value);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>): void => {
    e.currentTarget.select();
  };

  const handleBlur = (): void => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    commitOffset(state.offset);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') e.currentTarget.blur();
  };

  const bump = (delta: number): void => {
    const next = roundSeconds(state.lastValid + delta);
    scheduleSave(formatSigned(next), next);
  };

  const handleReset = (): void => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    commitOffset('0');
  };

  const saveLabel = state.saveState === 'saving' ? 'Saving…' : 'Saved';

  return (
    <div className={styles.latency}>
      <div className={styles.latencyHead}>
        <span className={styles.latencyLabel}>Latency</span>
        <span className={styles.latencySave} role="status" data-cell-id={`manager-offset-save-${role}`}>
          {saveLabel}
        </span>
      </div>
      <div className={styles.latencyRow}>
        <div className={styles.pillGroup}>
          <button
            type="button"
            className={styles.stepBtn}
            aria-label={`Decrease ${label} latency by ${OFFSET_STEP} seconds`}
            data-cell-id={`manager-offset-dec-${role}`}
            onClick={() => bump(-OFFSET_STEP)}
          >
            <Icon name="minus" />
            <span className={styles.stepLabel}>-0.5s</span>
          </button>
          <label className={styles.valueField}>
            <input
              type="text"
              inputMode="decimal"
              className={styles.valueInput}
              value={state.offset}
              onChange={handleInputChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              aria-label={`${label} latency in seconds`}
              data-cell-id={`manager-offset-input-${role}`}
            />
          </label>
          <button
            type="button"
            className={styles.stepBtn}
            aria-label={`Increase ${label} latency by ${OFFSET_STEP} seconds`}
            data-cell-id={`manager-offset-inc-${role}`}
            onClick={() => bump(OFFSET_STEP)}
          >
            <Icon name="plus" />
            <span className={styles.stepLabel}>+0.5s</span>
          </button>
        </div>
        <IconButton
          size="md"
          variant="outline"
          active={state.saveState === 'saving'}
          aria-label="Reset latency"
          data-cell-id={`manager-offset-reset-${role}`}
          onClick={handleReset}
          className={styles.resetBtn}
        >
          <Icon name="rotateCcw" />
        </IconButton>
      </div>
    </div>
  );
}

function TrackList({
  role,
  items,
  activeIndex,
  onSelect,
  onDownload,
}: {
  role: 'target' | 'native';
  items: SubtitlePanelItem[];
  activeIndex: number;
  onSelect: (role: 'target' | 'native', index: number) => void;
  onDownload?: (role: 'target' | 'native', index: number) => void;
}): React.JSX.Element {
  return (
    <div className={styles.trackList} data-cell-id="manager-section-body" data-role={role}>
      <button
        type="button"
        role="option"
        aria-selected={activeIndex === -1}
        className={[styles.track, styles.offRow, activeIndex === -1 && styles.trackActive].filter(Boolean).join(' ')}
        onClick={() => onSelect(role, -1)}
        data-cell-id={`manager-off-${role}`}
      >
        <span
          aria-hidden="true"
          className={[styles.radio, activeIndex === -1 && styles.radioActive].filter(Boolean).join(' ')}
        >
          {activeIndex === -1 && <span className={styles.radioDot} />}
        </span>
        <span className={styles.trackCopy}>
          <span className={styles.offLabel}>Off</span>
        </span>
      </button>
      {items.map((item, index) => (
        <ItemRow
          key={item.id}
          item={item}
          role={role}
          index={index}
          active={index === activeIndex}
          onSelect={onSelect}
          onDownload={onDownload}
        />
      ))}
    </div>
  );
}

export function SubtitleManagerPanel({
  targetItems,
  nativeItems,
  targetActiveIndex,
  nativeActiveIndex,
  targetLabel = 'Target',
  nativeLabel = 'Native',
  onSelect,
  onClose,
  onImport,
  onGenerateNative,
  onOffsetChange,
  generateNativeDisabled,
  appearance,
  hasSearchKeys,
  apiKeys,
  onApiKeysChange,
  onSearchResultSelect,
  mockSearchResults,
  onDownload,
  onHideSection,
  onHideBoth,
  targetHidden,
  nativeHidden,
  bothHidden,
}: SubtitleManagerPanelProps): React.JSX.Element {
  const [targetState, setTargetState] = useState<SectionState>({
    offset: formatSigned(defaultOffsets.target),
    saveState: 'saved',
    lastValid: defaultOffsets.target,
  });
  const [nativeState, setNativeState] = useState<SectionState>({
    offset: formatSigned(defaultOffsets.native),
    saveState: 'saved',
    lastValid: defaultOffsets.native,
  });
  const [view, setView] = useState<'tracks' | 'appearance' | 'search'>('tracks');
  const [viewDirection, setViewDirection] = useState<'forward' | 'backward'>('forward');
  const [prevView, setPrevView] = useState<'tracks' | 'appearance' | 'search' | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const [activeTab, setActiveTab] = useState<'target' | 'native'>('target');
  const customizeBtnRef = useRef<HTMLButtonElement>(null);
  const backBtnRef = useRef<HTMLButtonElement>(null);
  const searchBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const transitionTo = useCallback((newView: 'tracks' | 'appearance' | 'search', direction: 'forward' | 'backward'): void => {
    setViewDirection(direction);
    setPrevView(viewRef.current);
    setView(newView);
    window.setTimeout(() => setPrevView(null), 380);
  }, []);

  const handleCustomizeClick = useCallback((): void => {
    transitionTo('appearance', 'forward');
  }, [transitionTo]);

  const handleBackClick = useCallback((): void => {
    transitionTo('tracks', 'backward');
    requestAnimationFrame(() => customizeBtnRef.current?.focus());
  }, [transitionTo]);

  const handleSearchClick = useCallback((): void => {
    transitionTo('search', 'forward');
  }, [transitionTo]);

  const handleSearchBack = useCallback((): void => {
    transitionTo('tracks', 'backward');
    requestAnimationFrame(() => searchBtnRef.current?.focus());
  }, [transitionTo]);

  const activeLabel = activeTab === 'target' ? targetLabel : nativeLabel;
  const activeHidden = activeTab === 'target' ? targetHidden : nativeHidden;

  const renderHeaderContent = (v: 'tracks' | 'appearance' | 'search'): React.JSX.Element => {
    const title = v === 'search' ? 'Search' : v === 'appearance' ? 'Customize' : 'Subtitle Manager';
    const handleBack = v === 'search' ? handleSearchBack : handleBackClick;
    return (
      <>
        {v !== 'tracks' && (
          <button
            type="button"
            ref={backBtnRef}
            className={styles.headerBack}
            onClick={handleBack}
            aria-label="Back to subtitles"
            data-cell-id="manager-back-to-subtitles"
          >
            <Icon name="chevronLeft"  />
          </button>
        )}
        {v === 'tracks' && (
          <span className={styles.headerIcon}>
            <Icon name="subtitleManager"  />
          </span>
        )}
        <span className={styles.title}>{title}</span>
      </>
    );
  };

  return (
    <div
      className={styles.panel}
      role="dialog"
      aria-label="Subtitle manager"
      data-cell-id="subtitle-manager-panel"
      data-view={view}
      data-direction={viewDirection}
    >
      {/* Header — container stays fixed, inner content slides between views */}
      <div className={styles.header}>
        <div className={styles.headerStack}>
          {/* Exiting view — slides out */}
          {prevView && (
            <div
              key={prevView}
              className={styles.headerSlide}
              data-state="exiting"
              data-direction={viewDirection}
            >
              {renderHeaderContent(prevView)}
            </div>
          )}
          {/* Entering view — slides in */}
          <div
            key={view}
            className={styles.headerSlide}
            data-state="entering"
            data-direction={viewDirection}
          >
            {renderHeaderContent(view)}
          </div>
        </div>
        <IconButton
          aria-label="Close subtitle manager"
          onClick={onClose}
          data-cell-id="subtitle-manager-close"
        >
          <Icon name="x"  />
        </IconButton>
      </div>

      {/* View content — key triggers remount → CSS enter animation */}
      {view === 'tracks' && (
        <div key="tracks" className={styles.viewContent}>
          <div className={styles.tracksBody}>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'target' | 'native')}>
              <div className={styles.sectionBar} data-cell-id="manager-section-header">
                <Tabs.List className={styles.tabsList}>
                  <Tabs.Trigger value="target" className={styles.tabTrigger}>
                    {targetLabel}
                    <span className={styles.tabCount}>{targetItems.length}</span>
                  </Tabs.Trigger>
                  <Tabs.Trigger value="native" className={styles.tabTrigger}>
                    {nativeLabel}
                    <span className={styles.tabCount}>{nativeItems.length}</span>
                  </Tabs.Trigger>
                </Tabs.List>
                <div className={styles.sectionActions}>
                  {onImport && (
                    <IconButton
                      size="sm"
                      variant="ghost"
                      aria-label={`Import ${activeLabel} subtitle`}
                      data-cell-id={`manager-import-${activeTab}`}
                      onClick={() => onImport(activeTab)}
                    >
                      <Icon name="plus"  />
                    </IconButton>
                  )}
                  {onHideSection && (
                    <IconButton
                      size="sm"
                      variant="ghost"
                      active={activeHidden}
                      aria-label={activeHidden ? `Show ${activeLabel} subtitle in overlay` : `Hide ${activeLabel} subtitle from overlay`}
                      data-cell-id={`manager-hide-section-${activeTab}`}
                      onClick={() => onHideSection(activeTab)}
                    >
                      <Icon name="eyeOff"  />
                    </IconButton>
                  )}
                </div>
              </div>

              <Tabs.Content value="target" className={styles.tabContent} data-role="target">
                <TrackList
                  role="target"
                  items={targetItems}
                  activeIndex={targetActiveIndex}
                  onSelect={onSelect}
                  onDownload={onDownload}
                />
                <OffsetStepper
                  role="target"
                  label={targetLabel}
                  state={targetState}
                  setState={setTargetState}
                  onOffsetChange={onOffsetChange}
                />
              </Tabs.Content>

              <Tabs.Content value="native" className={styles.tabContent} data-role="native">
                <TrackList
                  role="native"
                  items={nativeItems}
                  activeIndex={nativeActiveIndex}
                  onSelect={onSelect}
                  onDownload={onDownload}
                />
                <OffsetStepper
                  role="native"
                  label={nativeLabel}
                  state={nativeState}
                  setState={setNativeState}
                  onOffsetChange={onOffsetChange}
                />
              </Tabs.Content>
            </Tabs>
          </div>

          <SubtitleManagerFooter
            onSearch={handleSearchClick}
            searchBtnRef={searchBtnRef}
            onCustomize={appearance ? handleCustomizeClick : undefined}
            customizeBtnRef={customizeBtnRef}
            onHideBoth={onHideBoth}
            bothHidden={bothHidden}
            onGenerateNative={onGenerateNative}
            generateNativeDisabled={generateNativeDisabled}
          />
        </div>
      )}

      {view === 'search' && (
        <div key="search" className={styles.viewContent}>
          <div className={styles.appearanceBody}>
            <SubtitleSearchPanel
              hasSearchKeys={hasSearchKeys}
              apiKeys={apiKeys}
              onApiKeysChange={onApiKeysChange}
              onSearchResultSelect={onSearchResultSelect}
              mockResults={mockSearchResults}
            />
          </div>
        </div>
      )}

      {view === 'appearance' && appearance && (
        <div key="appearance" className={styles.viewContent}>
          <div className={styles.appearanceBody}>
            <div className={styles.previewWrap}>
              <OverlayPreview
                targetStyle={appearance.targetStyle}
                nativeStyle={appearance.nativeStyle}
                blockSettings={appearance.blockSettings}
                clusterSettings={appearance.clusterSettings}
                targetText={appearance.previewTargetText}
                nativeText={appearance.previewNativeText}
                onTextChange={appearance.onPreviewTextChange}
              />
            </div>

            <div className={styles.tabsRoot}>
              <Tabs defaultValue="block">
                <Tabs.List className={styles.tabsList}>
                  <Tabs.Trigger value="block" className={styles.tabTrigger}>Block</Tabs.Trigger>
                  <Tabs.Trigger value="target" className={styles.tabTrigger}>Target</Tabs.Trigger>
                  <Tabs.Trigger value="native" className={styles.tabTrigger}>Native</Tabs.Trigger>
                  <Tabs.Trigger value="buttons" className={styles.tabTrigger}>Buttons</Tabs.Trigger>
                </Tabs.List>

                <Tabs.Content value="block" className={styles.tabContent}>
                  <SubtitleBlockSettingsPanel
                    settings={appearance.blockSettings}
                    onChange={appearance.onBlockSettingsChange}
                  />
                </Tabs.Content>

                <Tabs.Content value="target" className={styles.tabContent}>
                  <SubtitleStylePanel
                    role="target"
                    style={appearance.targetStyle}
                    onChange={(partial) => appearance.onStyleChange('target', partial)}
                    onReset={() => appearance.onResetStyle('target')}
                    defaultStyle={appearance.defaultTargetStyle}
                  />
                </Tabs.Content>

                <Tabs.Content value="native" className={styles.tabContent}>
                  <SubtitleStylePanel
                    role="native"
                    style={appearance.nativeStyle}
                    onChange={(partial) => appearance.onStyleChange('native', partial)}
                    onReset={() => appearance.onResetStyle('native')}
                    defaultStyle={appearance.defaultNativeStyle}
                  />
                </Tabs.Content>

                <Tabs.Content value="buttons" className={styles.tabContent}>
                  <NavClusterSettingsPanel
                    settings={appearance.clusterSettings}
                    onChange={appearance.onClusterSettingsChange}
                  />
                </Tabs.Content>
              </Tabs>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
