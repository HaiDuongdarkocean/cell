import { useEffect, useState } from 'react';
import { Icon } from '@/shared/ui/Icon';
import type { VoiceLab } from './voiceLab';

export function ConceptA({ lab, targetLabel }: { lab: VoiceLab; targetLabel: string }) {
  const full = lab.filledCount === 3;
  const [note, setNote] = useState(false);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(false), 1600);
    return () => clearTimeout(t);
  }, [note]);

  return (
    <div className="va">
      <div className="va-head">
        <span className="va-title">{targetLabel} voices</span>
        <span className="va-status">
          <span className="va-count" key={lab.filledCount}>{lab.filledCount}</span> of 3 buttons set
          <SavedFlash tick={lab.savedTick} />
        </span>
      </div>
      {note && (
        <p className="va-note" role="status">
          All 3 buttons are set — tap a picked voice to remove it first.
        </p>
      )}
      {lab.loading ? (
        <p className="va-empty">Loading voices…</p>
      ) : (
        <ul className="va-list" role="listbox" aria-label={`${targetLabel} voices`} aria-multiselectable="true">
          {lab.voices.map((v) => {
            const slot = lab.slotOf(v.name);
            const used = slot !== -1;
            return (
              <li key={v.name}>
                <div
                  className={`va-row${used ? ' used' : ''}`}
                  role="checkbox"
                  aria-checked={used}
                  aria-label={`${v.short}, ${v.lang}`}
                  tabIndex={0}
                  onClick={() => {
                    if (!used && full) {
                      setNote(true);
                      return;
                    }
                    lab.toggle(v.name);
                    if (!used) lab.preview(v.name);
                  }}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      e.currentTarget.click();
                    }
                  }}
                >
                  <span
                    className={`va-play${lab.playing === v.name ? ' playing' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Preview ${v.short}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      lab.preview(v.name);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        lab.preview(v.name);
                      }
                    }}
                  >
                    <Icon name={lab.playing === v.name ? 'pause' : 'play'} size="sm" />
                  </span>
                  <span className="va-label">
                    <span className="va-name">{v.short}</span>
                    <span className="va-meta">
                      {v.lang}
                      {v.natural ? ' · Natural' : ''}
                    </span>
                  </span>
                  <span className={`va-check${used ? ' on' : ''}`} aria-hidden="true">
                    {used && <span className="va-checknum" key={slot}>{slot + 1}</span>}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function SavedFlash({ tick }: { tick: number }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (tick === 0) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 1400);
    return () => clearTimeout(t);
  }, [tick]);
  return (
    <span className={`va-saved${visible ? ' on' : ''}`} role="status">
      {' '}
      · <Icon name="check" size="xs" /> Saved
    </span>
  );
}
