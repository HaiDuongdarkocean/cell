import { useState } from 'react';
import { Icon } from '@/shared/ui/Icon';
import type { VoiceLab } from './voiceLab';
import { SavedFlash } from './ConceptA';

export function ConceptC({ lab, targetLabel }: { lab: VoiceLab; targetLabel: string }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="vc">
      <div className="vc-head">
        <span className="va-title">Speak buttons</span>
        <SavedFlash tick={lab.savedTick} />
      </div>
      <ul className="vc-rows">
        {[0, 1, 2].map((i) => {
          const name = lab.slots[i];
          const isOpen = open === i;
          return (
            <li key={i} className={`vc-item${isOpen ? ' open' : ''}`}>
              <div
                className="vc-row"
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                aria-label={
                  name
                    ? `Button ${i + 1}: ${lab.shortOf(name)} — change voice`
                    : `Button ${i + 1}: pick a voice`
                }
                onClick={() => setOpen(isOpen ? null : i)}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    setOpen(isOpen ? null : i);
                  }
                }}
              >
                <span className={`vc-num${name ? ' on' : ''}`}>{i + 1}</span>
                <span
                  className={`vc-play${name ? '' : ' off'}`}
                  role="button"
                  tabIndex={name ? 0 : -1}
                  aria-label={name ? `Preview ${lab.shortOf(name)}` : 'No voice yet'}
                  aria-disabled={!name}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (name) lab.preview(name);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      if (name) lab.preview(name);
                    }
                  }}
                >
                  <Icon name={name && lab.playing === name ? 'pause' : 'play'} size="sm" />
                </span>
                <span className="va-label">
                  <span className="va-name">{name ? lab.shortOf(name) : 'Pick a voice'}</span>
                  <span className="va-meta">{name ? lab.voices.find((v) => v.name === name)?.lang ?? '' : `Button ${i + 1}`}</span>
                </span>
                <span className={`vc-chev${isOpen ? ' up' : ''}`} aria-hidden="true">
                  <Icon name="chevronDown" size="sm" />
                </span>
              </div>
              {isOpen && (
                <ul className="vc-picker" role="listbox" aria-label={`${targetLabel} voices`}>
                  {lab.voices.map((v) => {
                    const slot = lab.slotOf(v.name);
                    const isThis = slot === i;
                    return (
                      <li key={v.name}>
                        <div
                          className={`va-row${slot !== -1 ? ' used' : ''}`}
                          role="radio"
                          aria-checked={isThis}
                          aria-label={`${v.short}, ${v.lang}`}
                          tabIndex={0}
                          onClick={() => {
                            lab.assignTo(v.name, i);
                            lab.preview(v.name);
                            setOpen(null);
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
                              {slot !== -1 && slot !== i ? ` · button ${slot + 1}` : ''}
                            </span>
                          </span>
                          <span className={`va-check${isThis ? ' on' : ''}`} aria-hidden="true">
                            {isThis ? <Icon name="check" size="xs" /> : ''}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
