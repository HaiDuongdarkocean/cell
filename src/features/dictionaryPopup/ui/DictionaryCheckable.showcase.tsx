import { useState, type ReactElement, type ReactNode } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { Spinner } from '@/shared/ui/Spinner';
import checkStyles from './DictionaryCheckable.module.css';
import candStyles from './CandidateView.module.css';
import audioStyles from './AudioPanel.module.css';
import imgStyles from './ImagePanel.module.css';
import transStyles from './TranslatePanel.module.css';
import styles from './DictionaryCheckable.showcase.module.css';

type BoxState = 'idle' | 'revealed' | 'checked' | 'indeterminate' | 'disabled' | 'loading';

const STATES: BoxState[] = ['idle', 'revealed', 'checked', 'indeterminate', 'disabled', 'loading'];

/** Box-level modifiers for forced/static states (checked is host-driven). */
const BOX_MOD: Record<Exclude<BoxState, 'idle' | 'checked'>, string> = {
  revealed: checkStyles['cellDefCheckBox--revealed'],
  indeterminate: checkStyles['cellDefCheckBox--indeterminate'],
  disabled: checkStyles['cellDefCheckBox--disabled'],
  loading: checkStyles['cellDefCheckBox--loading'],
};

function boxClass(state: BoxState, checkedMod?: string): string {
  return [checkStyles.cellDefCheckBox, checkedMod ?? '', state === 'idle' || state === 'checked' ? '' : BOX_MOD[state]]
    .filter(Boolean)
    .join(' ');
}

function boxIcon(state: BoxState, indeterminate: boolean): ReactNode {
  if (state === 'loading') return <Spinner size="xl" color="accent" />;
  return <Icon name={indeterminate ? 'minus' : 'check'} size="md" />;
}

function Demo({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className={styles.demo}>
      <span className={styles.stateLabel}>{label}</span>
      <div className={styles.demoHost}>{children}</div>
    </div>
  );
}

const DEF_TEXT = 'the occurrence of events by chance in a happy or beneficial way';

/** Definition row — markup mirrors CandidateView. */
function DefRow({ state, examples = [] }: { state: BoxState; examples?: string[] }): ReactElement {
  const [checked, setChecked] = useState(state === 'checked');
  const disabled = state === 'disabled';
  const indeterminate = state === 'indeterminate' && !checked;
  return (
    <div
      className={`${checkStyles.cellDefItem} ${disabled ? checkStyles['cellDefItem--disabled'] : ''}`}
      onClick={disabled ? undefined : (): void => setChecked(!checked)}
    >
      <div className={candStyles.cellDefRow}>
        <label
          className={`${checkStyles.cellDefCheck} ${checked ? checkStyles['cellDefCheck--checked'] : ''}`}
          onClick={(e): void => e.stopPropagation()}
        >
          <input
            type="checkbox"
            className={checkStyles.cellDefCheckInput}
            checked={checked}
            disabled={disabled}
            ref={(el): void => { if (el) el.indeterminate = indeterminate; }}
            onChange={(e): void => setChecked(e.target.checked)}
            aria-label={`Select definition: ${DEF_TEXT}`}
          />
          <span className={boxClass(state)} aria-hidden="true">
            {boxIcon(state, indeterminate)}
          </span>
        </label>
        <span className={candStyles.cellDefText}>noun · {DEF_TEXT}</span>
      </div>
      {examples.length > 0 && (
        <div className={candStyles.cellDefExamples}>
          {examples.map((ex, i) => (
            <div key={i}>• {ex}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Audio row — checked modifier lives on the box (markup mirrors AudioPanel). */
function AudioRow({ state }: { state: BoxState }): ReactElement {
  const [selected, setSelected] = useState(state === 'checked');
  const disabled = state === 'disabled';
  const indeterminate = state === 'indeterminate' && !selected;
  return (
    <div className={`${checkStyles.cellAudioItem} ${disabled ? checkStyles['cellAudioItem--disabled'] : ''}`}>
      <Button shape="circle" size="sm" variant="outline" material="solid" aria-label="Play word pronunciation">
        <Icon name="audioWave" />
      </Button>
      <button
        type="button"
        className={audioStyles.cellAudioLabel}
        aria-pressed={selected}
        disabled={disabled}
        onClick={(): void => setSelected(!selected)}
      >
        <span className={audioStyles.cellAudioLabelName}>serendipity</span>
        <span className={audioStyles.cellAudioLabelMeta}>Cambridge · US</span>
      </button>
      <span className={boxClass(state, selected ? checkStyles['cellAudioCheck--checked'] : undefined)} aria-hidden="true">
        {boxIcon(state, indeterminate)}
      </span>
    </div>
  );
}

const IMG = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c8cff"/><stop offset="1" stop-color="#b06ab3"/></linearGradient></defs><rect width="160" height="120" fill="url(#g)"/><text x="80" y="66" font-family="sans-serif" font-size="14" fill="white" text-anchor="middle">serendipity</text></svg>',
)}`;

/** Image card — host --selected modifier (markup mirrors ImagePanel). */
function ImageCard({ state }: { state: BoxState }): ReactElement {
  const [selected, setSelected] = useState(state === 'checked');
  const disabled = state === 'disabled';
  const indeterminate = state === 'indeterminate' && !selected;
  return (
    <button
      type="button"
      className={`${checkStyles.cellImageCard} ${selected ? checkStyles['cellImageCard--selected'] : ''} ${disabled ? checkStyles['cellImageCard--disabled'] : ''}`}
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : selected}
      disabled={disabled}
      onClick={(): void => setSelected(!selected)}
    >
      <img src={IMG} alt="Serendipity — illustrative" className={imgStyles.cellImageThumb} />
      <span className={boxClass(state)} aria-hidden="true">
        {boxIcon(state, indeterminate)}
      </span>
    </button>
  );
}

/** Translate block — host --selected modifier (markup mirrors TranslatePanel). */
function TranslateRow({ state }: { state: BoxState }): ReactElement {
  const [selected, setSelected] = useState(state === 'checked');
  const disabled = state === 'disabled';
  const indeterminate = state === 'indeterminate' && !selected;
  return (
    <div
      className={`${checkStyles.cellTranslateBlock} ${selected ? checkStyles['cellTranslateBlock--selected'] : ''} ${disabled ? checkStyles['cellTranslateBlock--disabled'] : ''}`}
      onClick={disabled ? undefined : (): void => setSelected(!selected)}
      role="button"
      aria-pressed={selected}
      tabIndex={disabled ? -1 : 0}
    >
      <div className={transStyles.cellTranslateText}>
        <div className={transStyles.cellTranslateTarget}>sự tình cờ may mắn</div>
        <div className={transStyles.cellTranslateNative}>serendipity</div>
      </div>
      <span className={boxClass(state)} aria-hidden="true">
        {boxIcon(state, indeterminate)}
      </span>
    </div>
  );
}

export function Showcase(): ReactElement {
  return (
    <div className={styles.wrapper}>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Definition row — cellDefItem</h3>
        {STATES.map((s) => (
          <Demo key={s} label={s}><DefRow state={s} /></Demo>
        ))}
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Definition row with examples</h3>
        <Demo label="checked">
          <DefRow
            state="checked"
            examples={[
              'a fortunate stroke of serendipity',
              'finding the perfect candidate by pure serendipity',
            ]}
          />
        </Demo>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Audio row — cellAudioItem</h3>
        {STATES.map((s) => (
          <Demo key={s} label={s}><AudioRow state={s} /></Demo>
        ))}
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Image card — cellImageCard</h3>
        {STATES.map((s) => (
          <Demo key={s} label={s}><ImageCard state={s} /></Demo>
        ))}
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Translate block — cellTranslateBlock</h3>
        {STATES.map((s) => (
          <Demo key={s} label={s}><TranslateRow state={s} /></Demo>
        ))}
      </section>

      <p className={styles.hint}>
        Live states: hover a row reveals the unchecked box · press-and-hold squashes it ·
        Tab focuses the row (focus ring + box revealed). Disabled rows are inert.
      </p>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Dictionary Checkable',
  description:
    'Selectable row/card contract (SSOT) — unified checkbox states across Definition, Audio, Image, and Translate panels: idle, revealed, checked, indeterminate, disabled, loading, plus live hover/press/focus.',
  level: 'molecules' as const,
  category: 'Dictionary',
  order: 16,
};
