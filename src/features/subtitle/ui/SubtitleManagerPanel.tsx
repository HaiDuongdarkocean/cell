import { useState, useMemo, useCallback, useEffect } from 'react';
import { Icon } from '@/shared/icons/Icon';
import { IconButton } from '@/shared/ui/IconButton';
import { SubtitlePanelItem, formatBytes, extractLanguageName } from './subtitlePanelModel';
import styles from './SubtitleManagerPanel.module.css';

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
}

type SaveState = 'idle' | 'saving' | 'saved';

interface SectionState {
  offset: string;
  saveState: SaveState;
}

const defaultOffsets = { target: '0', native: '0' };
const OFFSET_STEP = 0.5;

function getSourceLabel(source: SubtitlePanelItem['source']): string {
  switch (source) {
    case 'imported':
      return 'Imported';
    case 'translated':
      return 'Translated';
    default:
      return '';
  }
}

function clampStep(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.round(value * 1000) / 1000;
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
      const ms = parseFloat(offsetStr) * 1000;
      if (!Number.isNaN(ms)) {
        onOffsetChange?.(role, ms);
      }
      setState({ ...state, offset: offsetStr, saveState: 'saved' });
    },
    [role, state, setState, onOffsetChange],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setState({ ...state, offset: e.target.value, saveState: 'saving' });
  };

  const handleBlur = (): void => {
    commitOffset(state.offset);
  };

  const bump = (delta: number): void => {
    const next = clampStep(Number(state.offset || 0) + delta);
    const nextStr = String(next);
    commitOffset(nextStr);
  };

  const saveLabel = state.saveState === 'saving' ? 'Saving…' : 'Saved';

  return (
    <div className={styles.timing}>
      <span className={styles.timingLabel}>Sync</span>
      <div className={styles.timingControl}>
        <div className={styles.stepper}>
          <button
            type="button"
            className={styles.stepperBtn}
            aria-label={`Decrease ${label} offset by ${OFFSET_STEP} seconds`}
            data-cell-id={`manager-offset-dec-${role}`}
            onClick={() => bump(-OFFSET_STEP)}
          >
            −
          </button>
          <label className={styles.stepperField}>
            <input
              type="number"
              step={OFFSET_STEP}
              className={styles.stepperInput}
              value={state.offset}
              onChange={handleInputChange}
              onBlur={handleBlur}
              aria-label={`${label} offset in seconds`}
              data-cell-id={`manager-offset-input-${role}`}
            />
            <span className={styles.unit} aria-hidden="true">sec</span>
          </label>
          <button
            type="button"
            className={styles.stepperBtn}
            aria-label={`Increase ${label} offset by ${OFFSET_STEP} seconds`}
            data-cell-id={`manager-offset-inc-${role}`}
            onClick={() => bump(OFFSET_STEP)}
          >
            +
          </button>
        </div>
        <span className={styles.saveState} role="status" data-cell-id={`manager-offset-save-${role}`}>
          {saveLabel}
        </span>
      </div>
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
  const lang = useMemo(() => {
    const active = items[activeIndex];
    return active ? extractLanguageName(active.name) : '';
  }, [items, activeIndex]);

  return (
    <section className={styles.section} data-role={role} data-cell-id="manager-section">
      <div className={styles.sectionHead} data-cell-id="manager-section-header" data-role={role}>
        <div className={styles.sectionHeading}>
          <span className={styles.sectionName}>
            {lang ? `${label} · ${lang}` : label}
          </span>
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
        {items.length === 0 ? (
          <div className={styles.empty}>No subtitles available.</div>
        ) : (
          <div className={styles.trackList}>
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
        )}
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
}: SubtitleManagerPanelProps): React.JSX.Element {
  const [targetState, setTargetState] = useState<SectionState>({
    offset: defaultOffsets.target,
    saveState: 'saved',
  });
  const [nativeState, setNativeState] = useState<SectionState>({
    offset: defaultOffsets.native,
    saveState: 'saved',
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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

      {onGenerateNative && (
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.generateBtn}
            onClick={onGenerateNative}
            data-cell-id="manager-generate-native"
            disabled={generateNativeDisabled}
          >
            Generate native
          </button>
        </div>
      )}
    </div>
  );
}
