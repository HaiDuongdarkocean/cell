import { useState, useCallback, useEffect, useRef } from 'react';
import { Icon } from '@/shared/icons/Icon';
import { IconButton } from '@/shared/ui/IconButton';
import { Button } from '@/shared/ui/Button';
import { Tabs } from '@/shared/ui/Tabs';
import { SubtitlePanelItem, formatBytes } from './subtitlePanelModel';
import { SubtitleSearchPanel } from './SubtitleSearchPanel';
import { SubtitleStylePanel } from './appearance/SubtitleStylePanel';
import { SubtitleBlockSettingsPanel } from './appearance/SubtitleBlockSettingsPanel';
import { NavClusterSettingsPanel } from './appearance/NavClusterSettingsPanel';
import { OverlayPreview } from './appearance/OverlayPreview';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import type { SubtitleBlockSettings, NavClusterSettings } from '@/entities/settings';
import type { SubtitleSearchResult } from '../logic/subtitleSearchTypes';
import type { SrtCue } from '@/entities/media';
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
  readonly onOpenSettings: () => void;
  readonly onSearchResultSelect: (result: SubtitleSearchResult, role: 'target' | 'native', cues?: SrtCue[]) => void;
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
}: {
  item: SubtitlePanelItem;
  role: 'target' | 'native';
  index: number;
  active: boolean;
  onSelect: (role: 'target' | 'native', index: number) => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      data-cell-id={`manager-item-${role}-${index}`}
      role="option"
      aria-selected={active}
      className={[styles.track, active && styles.trackActive].filter(Boolean).join(' ')}
      onClick={() => onSelect(role, index)}
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
    </button>
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setState({ offset: e.target.value, saveState: 'saving', lastValid: state.lastValid });
  };

  const handleBlur = (): void => {
    commitOffset(state.offset);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') e.currentTarget.blur();
  };

  const bump = (delta: number): void => {
    const next = roundSeconds(state.lastValid + delta);
    commitOffset(formatSigned(next));
  };

  const handleReset = (): void => {
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
        <button
          type="button"
          className={styles.stepBtn}
          aria-label={`Decrease ${label} latency by ${OFFSET_STEP} seconds`}
          data-cell-id={`manager-offset-dec-${role}`}
          onClick={() => bump(-OFFSET_STEP)}
        >
          -0.5s
        </button>
        <label className={styles.valueField}>
          <input
            type="text"
            inputMode="decimal"
            className={styles.valueInput}
            value={state.offset}
            onChange={handleInputChange}
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
          +0.5s
        </button>
      </div>
      <button
        type="button"
        className={styles.resetBtn}
        onClick={handleReset}
        data-cell-id={`manager-offset-reset-${role}`}
      >
        Reset
      </button>
    </div>
  );
}

function SectionPanel({
  role,
  label,
  items,
  activeIndex,
  state,
  setState,
  onSelect,
  onImport,
  onOffsetChange,
}: {
  role: 'target' | 'native';
  label: string;
  items: SubtitlePanelItem[];
  activeIndex: number;
  state: SectionState;
  setState: (s: SectionState) => void;
  onSelect: (role: 'target' | 'native', index: number) => void;
  onImport?: (role: 'target' | 'native') => void;
  onOffsetChange?: (role: 'target' | 'native', offsetMs: number) => void;
}): React.JSX.Element {
  return (
    <section className={styles.section} data-role={role} data-cell-id="manager-section">
      <div className={styles.sectionHead} data-cell-id="manager-section-header" data-role={role}>
        <div className={styles.sectionHeading}>
          <span className={styles.sectionName}>{label}</span>
          <span className={styles.sectionCount}>
            {items.length} subtitle{items.length === 1 ? '' : 's'}
          </span>
        </div>
        {onImport && (
          <button
            type="button"
            className={styles.sectionImport}
            onClick={() => onImport(role)}
            data-cell-id={`manager-import-${role}`}
          >
            Import
          </button>
        )}
      </div>

      <div className={styles.sectionBody} data-cell-id="manager-section-body" data-role={role}>
        <div className={styles.trackList}>
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
            />
          ))}
        </div>
        <OffsetStepper
          role={role}
          label={label}
          state={state}
          setState={setState}
          onOffsetChange={onOffsetChange}
        />
      </div>
    </section>
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
  onOpenSettings,
  onSearchResultSelect,
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
  const [view, setView] = useState<'tracks' | 'appearance'>('tracks');
  const customizeBtnRef = useRef<HTMLButtonElement>(null);
  const backBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleCustomizeClick = useCallback((): void => {
    setView('appearance');
    // Focus moves to Back button after render
    requestAnimationFrame(() => backBtnRef.current?.focus());
  }, []);

  const handleBackClick = useCallback((): void => {
    setView('tracks');
    // Focus returns to Customize button
    requestAnimationFrame(() => customizeBtnRef.current?.focus());
  }, []);

  if (view === 'appearance' && appearance) {
    return (
      <div className={styles.panel} role="dialog" aria-label="Subtitle manager" data-cell-id="subtitle-manager-panel">
        <div className={styles.header}>
          <span className={styles.title}>Subtitle Manager</span>
          <IconButton
            aria-label="Close subtitle manager"
            onClick={onClose}
            data-cell-id="subtitle-manager-close"
          >
            <Icon name="x" size={16} />
          </IconButton>
        </div>

        <div className={styles.appearanceBody}>
          <button
            type="button"
            ref={backBtnRef}
            className={styles.backBtn}
            onClick={handleBackClick}
            data-cell-id="manager-back-to-subtitles"
          >
            <span aria-hidden="true">←</span> Subtitles
          </button>

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
                <Tabs.Trigger value="block">Block</Tabs.Trigger>
                <Tabs.Trigger value="target">Target</Tabs.Trigger>
                <Tabs.Trigger value="native">Native</Tabs.Trigger>
                <Tabs.Trigger value="buttons">Buttons</Tabs.Trigger>
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
    );
  }

  return (
    <div className={styles.panel} role="dialog" aria-label="Subtitle manager" data-cell-id="subtitle-manager-panel">
      <div className={styles.header}>
        <span className={styles.title}>Subtitle Manager</span>
        <IconButton
          aria-label="Close subtitle manager"
          onClick={onClose}
          data-cell-id="subtitle-manager-close"
        >
          <Icon name="x" size={16} />
        </IconButton>
      </div>

      <div className={styles.tracksBody}>
        <div data-cell-id="manager-search-section">
          <SubtitleSearchPanel
            hasSearchKeys={hasSearchKeys}
            onOpenSettings={onOpenSettings}
            onSearchResultSelect={onSearchResultSelect}
          />
        </div>
        <SectionPanel
          role="target"
          label={targetLabel}
          items={targetItems}
          activeIndex={targetActiveIndex}
          state={targetState}
          setState={setTargetState}
          onSelect={onSelect}
          onImport={onImport}
          onOffsetChange={onOffsetChange}
        />
        <SectionPanel
          role="native"
          label={nativeLabel}
          items={nativeItems}
          activeIndex={nativeActiveIndex}
          state={nativeState}
          setState={setNativeState}
          onSelect={onSelect}
          onImport={onImport}
          onOffsetChange={onOffsetChange}
        />
      </div>

      {(onGenerateNative || appearance) && (
        <div className={styles.footer}>
          {appearance && (
            <Button
              variant="outline"
              size="md"
              className={styles.footerCustomize}
              ref={customizeBtnRef}
              onClick={handleCustomizeClick}
              data-cell-id="manager-customize-appearance"
            >
              Customize appearance
            </Button>
          )}
          {onGenerateNative && (
            <Button
              variant="primary"
              size="md"
              className={styles.footerGenerate}
              onClick={onGenerateNative}
              data-cell-id="manager-generate-native"
              disabled={generateNativeDisabled}
            >
              Generate native
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
