import { useState, useMemo } from 'react';
import { Button, Input } from '@/shared/ui';
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

interface SectionState {
  expanded: boolean;
  offset: string;
}

const defaultOffsets = { target: '0', native: '0' };

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
      className={[styles.item, active && styles.itemActive].filter(Boolean).join(' ')}
      onClick={() => onSelect(role, index)}
    >
      <span
        aria-hidden="true"
        className={[styles.radio, active && styles.radioActive].filter(Boolean).join(' ')}
      >
        {active && <span className={styles.radioDot} />}
      </span>
      <span className={styles.itemText}>
        <span className={styles.itemName}>{item.name}</span>
        <span className={styles.itemMeta}>
          <span className={styles.badge}>{item.format.toUpperCase()}</span>
          {item.isAsr && <span className={[styles.badge, styles.asrBadge].join(' ')}>AUTO</span>}
          {item.size !== undefined && <span className={styles.metaText}>{formatBytes(item.size)}</span>}
          {getSourceLabel(item.source) && (
            <span className={[styles.badge, styles.sourceBadge].join(' ')}>{getSourceLabel(item.source)}</span>
          )}
        </span>
      </span>
    </button>
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

  const handleOffset = (): void => {
    const ms = parseFloat(state.offset) * 1000;
    if (!Number.isNaN(ms)) onOffsetChange?.(role, ms);
  };

  return (
    <section className={styles.section} data-role={role} data-cell-id="manager-section">
      <button
        type="button"
        className={styles.sectionHeader}
        onClick={() => setState({ ...state, expanded: !state.expanded })}
        aria-expanded={state.expanded}
        data-cell-id="manager-section-header"
        data-role={role}
      >
        <span
          className={[styles.chevron, !state.expanded && styles.chevronCollapsed].filter(Boolean).join(' ')}
          aria-hidden="true"
        >
          <Icon name="chevronDown" size={16} />
        </span>
        <span className={styles.sectionLabel}>
          {lang ? `${label} · ${lang}` : label}
        </span>
        <span className={styles.sectionCount}>
          {items.length} subtitle{items.length === 1 ? '' : 's'}
        </span>
      </button>

      {state.expanded && (
        <div className={styles.sectionBody} data-cell-id="manager-section-body" data-role={role}>
          {items.length === 0 ? (
            <div className={styles.empty}>No subtitles available.</div>
          ) : (
            items.map((item, index) => (
              <ItemRow
                key={item.id}
                item={item}
                role={role}
                index={index}
                active={index === activeIndex}
                onSelect={onSelect}
              />
            ))
          )}
          <div className={styles.sectionActions}>
            <div className={styles.offsetRow}>
              <Input
                type="number"
                step={0.5}
                size="sm"
                className={styles.offsetInput}
                value={state.offset}
                onChange={(e) => setState({ ...state, offset: e.target.value })}
                onBlur={handleOffset}
                aria-label={`${label} offset in seconds`}
                data-cell-id={`manager-offset-input-${role}`}
              />
              <Button size="sm" variant="outline" onClick={handleOffset}>
                Apply offset
              </Button>
            </div>
            {onImport && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onImport(role)}
                data-cell-id={`manager-import-${role}`}
              >
                Import
              </Button>
            )}
          </div>
        </div>
      )}
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
    expanded: true,
    offset: defaultOffsets.target,
  });
  const [nativeState, setNativeState] = useState<SectionState>({
    expanded: true,
    offset: defaultOffsets.native,
  });

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
          <Button
            size="sm"
            variant="secondary"
            onClick={onGenerateNative}
            data-cell-id="manager-generate-native"
            disabled={generateNativeDisabled}
          >
            Generate native
          </Button>
        </div>
      )}
    </div>
  );
}
