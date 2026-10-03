import { Fragment, type ReactElement } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { fmtGenres, useVariantState, type MockEntry } from './mockData';

export function ConceptA({ entry }: { entry: MockEntry }): ReactElement {
  const st = useVariantState(entry);
  const v = entry.variants[st.vIdx];
  const accent = v.accents[st.accentIdx];
  const multi = entry.variants.length > 1;

  return (
    <article className="mkPopup">
      {multi && (
        <nav className="caPosBar" aria-label="Part of speech">
          {entry.variants.map((variant, i) => (
            <Fragment key={variant.pos || 'other'}>
              {i > 0 && <span className="caSep" aria-hidden="true">|</span>}
              <button
                type="button"
                className={`caPosLink${i === st.vIdx ? ' caPosLink--on' : ''}`}
                aria-current={i === st.vIdx ? 'true' : undefined}
                onClick={() => st.selectVariant(i)}
              >
                {variant.label}
              </button>
            </Fragment>
          ))}
        </nav>
      )}

      <header className="mkHead">
        <span className="mkWord">{entry.term}</span>
        <span className="mkHeadSpacer" />
        <button type="button" className="mkActionBtn" aria-label="Send to card"><Icon name="pencil" size="sm" /></button>
        <button type="button" className="mkActionBtn mkActionBtn--accent" aria-label="Quick add"><Icon name="zap" size="sm" /></button>
      </header>

      <div className="mkSwap" key={v.pos || 'other'}>
        {(accent || v.stars > 0) && (
          <div className="mkReadingRow">
            {accent && (
              <>
                {v.accents.length > 1 ? (
                  <button type="button" className="mkAccent" onClick={st.cycleAccent} aria-label="Switch accent">
                    {accent.label}
                  </button>
                ) : (
                  <span className="mkAccent mkAccent--static">{accent.label}</span>
                )}
                <span className="mkIpa">{accent.ipa}</span>
                <button type="button" className="mkIconBtn" aria-label={`Play ${accent.label} pronunciation`}>
                  <Icon name="volumeHigh" size="sm" />
                </button>
              </>
            )}
            {v.stars > 0 && <span className="mkStars">{'●'.repeat(v.stars)}</span>}
          </div>
        )}

        <div className="mkStatusRow">
          <button type="button" className={`mkStatus mkStatus--${st.status}`} onClick={st.cycleStatus}>
            {st.status}
          </button>
          {v.freq && (
            <span className="mkFreq" title={fmtGenres(v.freq)}>
              <span className="mkFreqSource">{v.freq.source}</span>
              <span className="mkFreqRank">{v.freq.rank.toLocaleString()}</span>
            </span>
          )}
        </div>

        <div className="mkToolbar">
          <button type="button" className="mkTool" aria-label="Audio"><Icon name="audioWave" size="sm" /></button>
          <button type="button" className="mkTool" aria-label="Images"><Icon name="image" size="sm" /></button>
          <button type="button" className="mkTool" aria-label="Translate"><Icon name="languages" size="sm" /></button>
          <button type="button" className="mkTool" aria-label="Links"><Icon name="link" size="sm" /></button>
          <button type="button" className="mkTool" aria-label="Pronunciation"><Icon name="microphone" size="sm" /></button>
        </div>

        <div className="mkImgStrip" aria-label={`Images for "${v.imageQuery}"`}>
          <span className="mkImgQuery">{v.imageQuery}</span>
          {[0, 1, 2, 3].map((i) => <span key={i} className="mkImgTile" />)}
        </div>

        {v.inflections.length > 0 && (
          <div className="mkInflections">
            {v.inflections.map((f) => (
              <span key={f.type}><b>{f.type}:</b> {f.forms.join(', ')}{'  '}</span>
            ))}
          </div>
        )}

        <section className="mkSenses">
          {v.senses.map((s, i) => (
            <div
              key={i}
              className={`mkDef${st.checked[i] ? ' mkDef--on' : ''}`}
              role="checkbox"
              aria-checked={!!st.checked[i]}
              tabIndex={0}
              onClick={() => st.toggleSense(i)}
              onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); st.toggleSense(i); } }}
            >
              <span className="mkDefCheck" aria-hidden="true"><Icon name="check" size="sm" /></span>
              <span className="mkDefBody">
                <span className="mkLine">{i + 1}. {s.gloss}</span>
                {s.labels?.map((l) => <span key={l} className="mkLabel">[{l}]</span>)}
                {s.examples?.map((x) => <span key={x} className="mkExample">{x}</span>)}
              </span>
            </div>
          ))}
        </section>
      </div>
    </article>
  );
}
