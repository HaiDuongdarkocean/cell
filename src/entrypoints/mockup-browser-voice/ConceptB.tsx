import { useEffect, useState } from 'react';
import { Icon } from '@/shared/ui/Icon';
import type { VoiceLab } from './voiceLab';
import { SavedFlash } from './ConceptA';

export function ConceptB({ lab, targetLabel }: { lab: VoiceLab; targetLabel: string }) {
  const [armed, setArmed] = useState(0);

  useEffect(() => {
    const empty = lab.slots.findIndex((n) => n === null);
    if (empty !== -1 && lab.slots[armed] !== null) setArmed(empty);
  }, [lab.slots, armed]);

  return (
    <div className="vb">
      <div className="vb-strip" role="radiogroup" aria-label="Speak buttons">
        {[0, 1, 2].map((i) => {
          const name = lab.slots[i];
          const isArmed = armed === i;
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={isArmed}
              aria-label={
                name
                  ? `Button ${i + 1}: ${lab.shortOf(name)}`
                  : `Button ${i + 1}: pick a voice below`
              }
              className={`vb-btn${isArmed ? ' armed' : ''}${name ? ' filled' : ''}`}
              onClick={() => {
                setArmed(i);
                if (name) lab.preview(name);
              }}
            >
              <span className="vb-ico">
                <Icon name="audioWave" size="sm" />
              </span>
              <span className="vb-num">{i + 1}</span>
              <span className="vb-caption">
                {name ? lab.shortOf(name) : isArmed ? 'pick ↓' : 'empty'}
              </span>
            </button>
          );
        })}
        <SavedFlash tick={lab.savedTick} />
      </div>

      <div className="vb-head">
        <span className="va-title">{targetLabel} voices</span>
        <span className="vb-note">tap to assign · tap again to remove</span>
      </div>

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
                    if (used) {
                      lab.remove(v.name);
                    } else {
                      lab.assignTo(v.name, armed);
                      lab.preview(v.name);
                    }
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
                    className="va-play"
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
                    {used ? slot + 1 : ''}
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
