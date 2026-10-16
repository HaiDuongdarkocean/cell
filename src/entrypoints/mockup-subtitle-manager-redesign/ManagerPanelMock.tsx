import { useEffect, useRef, useState } from 'react';
import {
  Button,
  FooterBar,
  InkTabs,
  Input,
  Label,
  SegmentedControl,
  SettingsGroup,
  SettingsRow,
  StepperSection,
  Toggle,
} from '@/shared/ui';
import { Icon } from '@/shared/icons/Icon';
import { ICON_SIZE_PX } from '@/shared/icons';
import { formatBytes } from '@/shared/lib/formatBytes';
import type { SubtitlePanelItem } from '@/features/subtitle/ui/subtitlePanelModel';
import type { AutoChain, Locale, Scenario } from './mockData';
import {
  NATIVE_DEFAULT,
  NATIVE_MANY,
  STRINGS,
  TARGET_DEFAULT,
  TARGET_MANY,
} from './mockData';
import styles from './mockup.module.css';

function sourceLabel(source: SubtitlePanelItem['source'], s: Record<string, string>): string {
  switch (source) {
    case 'imported':
      return s.srcImported;
    case 'searched':
      return s.srcSearched;
    case 'translated':
      return s.srcTranslated;
    default:
      return '';
  }
}

function TrackCard({
  item,
  active,
  onSelect,
  s,
}: {
  item: SubtitlePanelItem;
  active: boolean;
  onSelect: () => void;
  s: Record<string, string>;
}): React.JSX.Element {
  return (
    <div
      role="option"
      aria-selected={active}
      tabIndex={0}
      data-tihoka-id={`manager-item-${item.role}-${item.index}`}
      className={[styles.trackRow, active && styles.trackRowActive].filter(Boolean).join(' ')}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <span aria-hidden="true" className={[styles.trackTile, active && styles.trackTileActive].filter(Boolean).join(' ')}>
        <Icon name="captions" size={ICON_SIZE_PX} />
      </span>
      <span className={styles.trackCopy}>
        <span className={styles.trackName}>{item.name}</span>
        <span className={styles.trackMeta}>
          <span className={styles.tag}>{item.format.toUpperCase()}</span>
          {item.size !== undefined && <span className={styles.tag}>{formatBytes(item.size)}</span>}
          {item.isAsr && <span className={[styles.tag, styles.tagInfo].join(' ')}>{s.tagAuto}</span>}
          {sourceLabel(item.source, s) && (
            <span className={[styles.tag, styles.tagSuccess].join(' ')}>{sourceLabel(item.source, s)}</span>
          )}
        </span>
      </span>
      <span className={styles.trackActions}>
        <Button
          shape="circle"
          size="md"
          variant="ghost"
          aria-label={`Download ${item.name}`}
          data-tihoka-id={`manager-download-${item.role}-${item.index}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Icon name="download" size={ICON_SIZE_PX} />
        </Button>
      </span>
    </div>
  );
}

export function ManagerPanelMock({
  locale,
  scenario,
  autoChain,
}: {
  locale: Locale;
  scenario: Scenario;
  autoChain: AutoChain;
}): React.JSX.Element {
  const s = STRINGS[locale];
  const [tab, setTab] = useState<'target' | 'native'>('target');
  const [targetSel, setTargetSel] = useState(scenario === 'empty' ? -1 : 0);
  const [nativeSel, setNativeSel] = useState(scenario === 'empty' ? -1 : 0);
  const [cueMode, setCueMode] = useState<'list' | 'active'>('list');
  const [bothHidden, setBothHidden] = useState(false);
  const [sectionHidden, setSectionHidden] = useState(false);
  const [offset, setOffset] = useState('0');
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const [autoLoad, setAutoLoad] = useState(autoChain !== 'off');
  const [autoAsr, setAutoAsr] = useState(autoChain === 'chain' ? false : true);
  const [autoTranslate, setAutoTranslate] = useState(true);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const check = (): void =>
      setHasMore(el.scrollHeight - el.scrollTop - el.clientHeight > 8);
    check();
    el.addEventListener('scroll', check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', check);
      ro.disconnect();
    };
  }, [scenario, tab, locale]);

  const bumpOffset = (delta: number): void => {
    const next = Math.round((parseFloat(offset || '0') + delta) * 1000) / 1000;
    setOffset(next === 0 ? '0' : `${next > 0 ? '+' : ''}${next}`);
    setSaveState('saving');
    window.setTimeout(() => setSaveState('saved'), 600);
  };

  const sel = tab === 'target' ? targetSel : nativeSel;
  const setSel = tab === 'target' ? setTargetSel : setNativeSel;

  return (
    <div className={styles.panel} role="dialog" aria-label={s.title} data-tihoka-id="subtitle-manager-panel">
      <div className={styles.header}>
        <span className={styles.headerIcon}>
          <Icon name="subtitleManager" size={ICON_SIZE_PX} />
        </span>
        <span className={styles.title}>{s.title}</span>
        <Button shape="circle" variant="ghost" aria-label="Close" data-tihoka-id="subtitle-manager-close">
          <Icon name="x" size={ICON_SIZE_PX} />
        </Button>
      </div>

      <div className={styles.tracksBody} ref={bodyRef} data-more={hasMore || undefined}>
        <div className={styles.sectionBar} data-tihoka-id="manager-section-header">
          <InkTabs
            className={styles.inkTabs}
            aria-label="Subtitle sections"
            items={[
              {
                value: 'target',
                label: (
                  <>
                    {s.target}
                    <span className={styles.tabCount}>·&nbsp;{tabCounts(scenario, 'target')}</span>
                  </>
                ),
              },
              {
                value: 'native',
                label: (
                  <>
                    {s.native}
                    <span className={styles.tabCount}>·&nbsp;{tabCounts(scenario, 'native')}</span>
                  </>
                ),
              },
            ]}
            value={tab}
            onValueChange={(v) => setTab(v as 'target' | 'native')}
          />
          <div className={styles.sectionActions}>
            <Button shape="circle" size="md" variant="ghost" aria-label="Import" data-tihoka-id={`manager-import-${tab}`}>
              <Icon name="plus" size={ICON_SIZE_PX} />
            </Button>
            <Button
              shape="circle"
              size="md"
              variant="ghost"
              active={sectionHidden}
              aria-label="Hide section"
              data-tihoka-id={`manager-hide-section-${tab}`}
              onClick={() => setSectionHidden((v) => !v)}
            >
              <Icon name="eyeOff" size={ICON_SIZE_PX} />
            </Button>
            <Button shape="circle" size="md" variant="ghost" aria-label="Condensed audio" data-tihoka-id="manager-condense-audio">
              <Icon name="audioWave" size={ICON_SIZE_PX} />
            </Button>
          </div>
        </div>

        <div className={styles.tabContent} role="tabpanel">
          <div className={styles.sectionCard}>
            <div className={styles.trackList} role="listbox" data-tihoka-id="manager-section-body" data-role={tab}>
              <button
                type="button"
                role="option"
                aria-selected={sel === -1}
                className={[styles.trackRow, styles.offRow, sel === -1 && styles.trackRowActive].filter(Boolean).join(' ')}
                data-tihoka-id={`manager-off-${tab}`}
                onClick={() => setSel(-1)}
              >
                <span aria-hidden="true" className={[styles.trackTile, sel === -1 && styles.trackTileActive].filter(Boolean).join(' ')}>
                  <Icon name="circleX" size={ICON_SIZE_PX} />
                </span>
                <span className={styles.trackCopy}>
                  <span className={styles.offLabel}>{s.off}</span>
                </span>
              </button>

              {trackItems(scenario, tab).map((item, index) => (
                <TrackCard
                  key={item.id}
                  item={item}
                  active={index === sel}
                  onSelect={() => setSel(index)}
                  s={s}
                />
              ))}
            </div>
          </div>

          <div className={styles.sectionCard}>
            <div className={styles.playBody}>
            <StepperSection
            label={s.latency}
            status={
              <span role="status" data-tihoka-id={`manager-offset-save-${tab}`}>
                {saveState === 'saving' ? s.saving : s.saved}
              </span>
            }
            stepperClassName={styles.pillGroup}
            decreaseLabel="-0.5s"
            increaseLabel="+0.5s"
            decreaseAriaLabel="Decrease latency by 0.5s"
            increaseAriaLabel="Increase latency by 0.5s"
            onDecrease={() => bumpOffset(-0.5)}
            onIncrease={() => bumpOffset(0.5)}
            decreaseDataTihokaId={`manager-offset-dec-${tab}`}
            increaseDataTihokaId={`manager-offset-inc-${tab}`}
            trailing={
              <Button
                shape="circle"
                size="md"
                variant="ghost"
                aria-label="Reset offset"
                data-tihoka-id={`manager-offset-reset-${tab}`}
                onClick={() => setOffset('0')}
              >
                <Icon name="rotateCcw" size={ICON_SIZE_PX} />
              </Button>
            }
          >
            <Label className={styles.valueField}>
              <Input
                type="text"
                inputMode="decimal"
                className={styles.valueInput}
                value={offset}
                onChange={(e) => setOffset(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Subtitle offset"
                variant="ghost"
                data-tihoka-id={`manager-offset-input-${tab}`}
              />
            </Label>
            </StepperSection>

            <div className={styles.cueRow} data-tihoka-id="pm-cue-display-row">
              <span className={styles.cueLabel}>{s.cueDisplay}</span>
              <SegmentedControl
                variant="filled"
                ariaLabel={s.cueDisplay}
                className={styles.cueSeg}
                options={[
                  { value: 'list', label: s.cueList, testId: 'pm-cue-display-list' },
                  { value: 'active', label: s.cueActive, testId: 'pm-cue-display-active' },
                ]}
                value={cueMode}
                onChange={setCueMode}
              />
            </div>
            </div>
          </div>
        </div>

        <div className={[styles.sectionCard, styles.autoCard].join(' ')}>
          <SettingsGroup label={s.autoTitle} data-tihoka-id="manager-auto-group">
              <SettingsRow dense title={s.autoLoad} description={s.autoLoadHint}>
                <Toggle checked={autoLoad} onChange={setAutoLoad} ariaLabel={s.autoLoad} dataTestId="manager-auto-load" />
              </SettingsRow>
              <SettingsRow dense divider title={s.autoLoadAsr} className={!autoLoad ? styles.rowDisabled : undefined}>
                <Toggle
                  checked={autoAsr}
                  onChange={setAutoAsr}
                  ariaLabel={s.autoLoadAsr}
                  disabled={!autoLoad}
                  dataTestId="manager-auto-load-asr"
                />
              </SettingsRow>
              <SettingsRow dense divider title={s.autoTranslate} description={s.autoTranslateHint} className={!autoLoad ? styles.rowDisabled : undefined}>
                <Toggle
                  checked={autoTranslate}
                  onChange={setAutoTranslate}
                  ariaLabel={s.autoTranslate}
                  disabled={!autoLoad}
                  dataTestId="manager-auto-translate"
                />
              </SettingsRow>
          </SettingsGroup>
        </div>
      </div>

      <div className={styles.dock}>
        <Button
          variant="primary"
          size="md"
          className={styles.generateCta}
          leadingIcon={<Icon name="generateNative" size={ICON_SIZE_PX} />}
          disabled={scenario === 'empty'}
          data-tihoka-id="manager-generate-native"
        >
          {s.generate}
        </Button>

        <FooterBar
          className={styles.footerBar}
          slots={[
            {
              key: 'search',
              icon: <Icon name="search" />,
              label: s.search,
              onClick: () => undefined,
              buttonProps: { 'data-tihoka-id': 'manager-search-subtitles' },
            },
            {
              key: 'ocr',
              icon: <Icon name="scanText" />,
              label: s.ocr,
              onClick: () => undefined,
              buttonProps: { 'data-tihoka-id': 'manager-ocr-settings' },
            },
            {
              key: 'customize',
              icon: <Icon name="slidersHorizontal" />,
              label: s.customize,
              onClick: () => undefined,
              buttonProps: { 'data-tihoka-id': 'manager-customize-appearance' },
            },
            {
              key: 'hide',
              icon: <Icon name={bothHidden ? 'eye' : 'eyeOff'} />,
              label: bothHidden ? s.show : s.hide,
              active: bothHidden,
              onClick: () => setBothHidden((v) => !v),
              buttonProps: { 'data-tihoka-id': 'manager-hide-both' },
            },
          ]}
        />
      </div>
    </div>
  );
}

function trackItems(scenario: Scenario, tab: 'target' | 'native'): SubtitlePanelItem[] {
  if (scenario === 'empty') return [];
  if (scenario === 'many') return tab === 'target' ? TARGET_MANY : NATIVE_MANY;
  return tab === 'target' ? TARGET_DEFAULT : NATIVE_DEFAULT;
}

function tabCounts(scenario: Scenario, tab: 'target' | 'native'): number {
  return trackItems(scenario, tab).length;
}
