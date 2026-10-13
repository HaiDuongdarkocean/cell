import React, { useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Icon } from '@/shared/ui/Icon';
import '@/shared/styles/tokens.css';
import './mockup.css';
import type { ProtoEntry, ProtoLine, ProtoSense } from './data';
import { REAL_ENTRIES } from './data.generated';

const ENTRIES = REAL_ENTRIES;
const ENTRY_LIST = ['take', 'no', 'run across', 'take off', 'set', 'act', 'yeet'];

const STATUSES = ['unknown', 'tracking', 'known', 'ignore'] as const;
type Status = (typeof STATUSES)[number];

function Reveal({ text, cite }: { text: string; cite?: string }) {
  const [on, setOn] = useState(false);
  return (
    <>
      <button
        type="button"
        className={`mkIconBtn mkRevealBtn${on ? ' mkRevealBtn--open' : ''}`}
        aria-expanded={on}
        aria-label={on ? 'Hide translation' : 'Show translation'}
        onClick={() => setOn(!on)}
      >
        <Icon name="chevronDown" size="sm" />
      </button>
      {on && (
        <span className="mkTrans">
          {text}
          {cite ? <span className="mkCite"> — {cite}</span> : null}
        </span>
      )}
    </>
  );
}

function Lines({ lines }: { lines: readonly ProtoLine[] }) {
  return (
    <>
      {lines.map((l, i) => {
        const inner = (
          <>
            {l.text}
            {l.pattern ? <span className="mkLabel">{l.pattern}</span> : null}
            {l.translation ? <Reveal text={l.translation} cite={l.citation} /> : null}
            {l.citation && !l.translation ? <span className="mkCite"> — {l.citation}</span> : null}
          </>
        );
        if (l.role === 'example') return <span key={i} className="mkExample">{inner}</span>;
        if (l.role === 'note' || l.role === 'collocation') return <span key={i} className="mkNote">{inner}</span>;
        return <span key={i} className="mkLine">{inner}</span>;
      })}
    </>
  );
}

function CheckRow({
  checked,
  onToggle,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mkDef ${checked ? 'mkDef--on' : ''}`}
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={() => {
        if (window.getSelection()?.toString()) return;
        onToggle();
      }}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <span className="mkDefCheck" aria-hidden="true">
        <Icon name="check" size="sm" />
      </span>
      <div className="mkDefBody" onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) e.stopPropagation();
      }}>
        {children}
      </div>
    </div>
  );
}

function SenseBlock({
  sense,
  pos,
  checked,
  onToggle,
}: {
  sense: ProtoSense;
  pos?: string;
  checked: boolean;
  onToggle: () => void;
}) {
  const [first, ...rest] = sense.lines;
  const gloss = first?.role === 'gloss' ? first : undefined;
  const restLines = gloss ? rest : sense.lines;
  return (
    <CheckRow checked={checked} onToggle={onToggle}>
      <span className="mkLine">
        {pos ? <span className="mkLabel">[{pos}]</span> : null}
        {sense.labels?.map((l) => <span key={l} className="mkLabel">[{l}]</span>)}
        {sense.level ? <span className="mkLabel">[{sense.level}]</span> : null}
        {gloss?.text}
        {gloss?.translation ? <Reveal text={gloss.translation} cite={gloss.citation} /> : null}
      </span>
      <Lines lines={restLines} />
      {sense.subsenses?.map((sub) => (
        <span key={sub.num} className="mkLine mkSub">
          <span className="mkSenseNum">{sub.num}.</span>
          {sub.text}
        </span>
      ))}
      {sense.synonyms?.length ? (
        <span className="mkRel"><b>Synonyms:</b> {sense.synonyms.join(', ')}</span>
      ) : null}
      {sense.antonyms?.length ? (
        <span className="mkRel"><b>Opposite:</b> {sense.antonyms.join(', ')}</span>
      ) : null}
      {sense.thesaurus?.length ? (
        <span className="mkRel"><b>thesaurus:</b> {sense.thesaurus.join(', ')}</span>
      ) : null}
    </CheckRow>
  );
}

function Group({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  const [on, setOn] = useState(false);
  return (
    <div className="mkGroup">
      <button type="button" className="mkGroupHead" aria-expanded={on} onClick={() => setOn(!on)}>
        <Icon name={on ? 'chevronDown' : 'chevronRight'} size="sm" />
        {title}
        {count != null && <span className="mkGroupCount">({count})</span>}
      </button>
      {on && <div className="mkGroupBody">{children}</div>}
    </div>
  );
}

function Popup({ entry, onNavigate, stacked }: { entry: ProtoEntry; onNavigate: (term: string) => void; stacked?: boolean }) {
  const [status, setStatus] = useState<Status>('unknown');
  const [checked, setChecked] = useState<Record<string, boolean>>({});


  const link = (t: string) =>
    ENTRIES[t] ? (
      <a className="mkLink" onClick={() => onNavigate(t)}>{t}</a>
    ) : (
      <span className="mkLink">{t}</span>
    );

  const senseId = (s: number, i: number) => `${s}-${i}`;
  const toggle = (id: string) => setChecked((c) => ({ ...c, [id]: !c[id] }));

  return (
    <article className={stacked ? 'mkCandidate' : 'Tihoka'}>
      {/* ── header ── */}
      <div className="mkHead">
        <span className="mkWord">{entry.term}</span>
        {entry.homograph ? <sup className="mkHomo">{entry.homograph}</sup> : null}
        <span className="mkHeadSpacer" />
        <span className="mkHeadActions">
          <button type="button" className="mkActionBtn" aria-label="Edit card"><Icon name="pencil" size="sm" /></button>
          <button type="button" className="mkActionBtn mkActionBtn--accent" aria-label="Quick add"><Icon name="zap" size="sm" /></button>
        </span>
      </div>

      {entry.pronunciation?.ipa ? (
        <div className="mkReadingRow">
          <span>{entry.pronunciation.ipa}</span>
          <button type="button" className="mkIconBtn" aria-label="Play pronunciation"><Icon name="volumeHigh" size="sm" /></button>
          {entry.pronunciation?.ipaUs && entry.pronunciation.ipaUs !== entry.pronunciation.ipaUk ? (
            <>
              <span>{entry.pronunciation.ipaUs}</span>
              <button type="button" className="mkIconBtn" aria-label="Play US pronunciation"><Icon name="volumeLow" size="sm" /></button>
            </>
          ) : null}
        </div>
      ) : null}

      {/* status + freq */}
      <div className="mkStatusRow">
        <button
          type="button"
          className={`mkStatus mkStatus--${status}`}
          onClick={() => setStatus(STATUSES[(STATUSES.indexOf(status) + 1) % STATUSES.length])}
        >
          {status}
        </button>
        {entry.frequencyStars ? (
          <span className="mkFreq">frequency {entry.frequencyStars}</span>
        ) : null}
        {entry.level ? <span className="mkChip mkChip--accent">{entry.level}</span> : null}
      </div>

      {/* toolbar */}
      <div className="mkToolbar">
        <button type="button" className="mkTool" aria-label="Audio"><Icon name="audioWave" size="sm" /></button>
        <button type="button" className="mkTool" aria-label="Images"><Icon name="image" size="sm" /></button>
        <button type="button" className="mkTool" aria-label="Translate"><Icon name="languages" size="sm" /></button>
        <button type="button" className="mkTool" aria-label="Links"><Icon name="link" size="sm" /></button>
        <button type="button" className="mkTool" aria-label="Pronunciation"><Icon name="microphone" size="sm" /></button>
      </div>

      {entry.inflections?.length ? (
        <div className="mkInflections">
          {entry.inflections.map((f) => (
            <span key={f.type}>
              <b>{f.type}:</b> {f.forms.join(', ')}{'  '}
            </span>
          ))}
        </div>
      ) : null}

      {/* sense menu — removed per design feedback */}

      {entry.sections.map((sec, si) => (
        <section key={si}>
          {sec.senses.map((s, i) => (
            <div key={i} data-sense={si === 0 ? i : undefined}>
              <SenseBlock sense={s} pos={sec.pos} checked={!!checked[senseId(si, i)]} onToggle={() => toggle(senseId(si, i))} />
            </div>
          ))}
        </section>
      ))}

      {/* audience variants — appended as labeled senses, like any other provider */}
      {entry.audienceVariants?.map((v, vi) =>
        v.sections.map((sec, si) =>
          sec.senses.map((s, i) => (
            <div key={`${vi}-${si}-${i}`}>
              <SenseBlock
                sense={{ ...s, labels: [v.label.toLowerCase(), ...(s.labels ?? [])] }}
                pos={sec.pos}
                checked={!!checked[`aud-${vi}-${si}-${i}`]}
                onToggle={() => toggle(`aud-${vi}-${si}-${i}`)}
              />
            </div>
          ))
        )
      )}

      {/* word origin — selectable variants from multiple providers */}
      {entry.etymology ? (
        <>
          <CheckRow checked={!!checked['origin-0']} onToggle={() => toggle('origin-0')}>
            <span className="mkLine">
              <span className="mkLabel">[word origin]</span>
              {entry.etymology.chain}
              {entry.etymology.firstKnownUse ? <span className="mkRelText"> · first known use: {entry.etymology.firstKnownUse}</span> : null}
            </span>
          </CheckRow>
          {entry.etymology.variants?.map((v, i) => (
            <CheckRow key={i} checked={!!checked[`origin-${i + 1}`]} onToggle={() => toggle(`origin-${i + 1}`)}>
              <span className="mkLine">
                <span className="mkLabel">[word origin]</span>
                {v.text}
                {v.source ? <>{' '}<span className="mkLabel">[{v.source}]</span></> : null}
              </span>
            </CheckRow>
          ))}
        </>
      ) : null}

      {/* related — kind-grouped link lists; phrases resolve through normal lookup */}
      {(() => {
        const groups = new Map<string, { term: string }[]>();
        for (const r of entry.related ?? []) {
          const list = groups.get(r.kind) ?? [];
          list.push(r);
          groups.set(r.kind, list);
        }
        const KIND_LABELS: Record<string, string> = {
          phrasal: 'phrasal verbs',
          idiom: 'idioms',
          collocation: 'collocations',
          expression: 'phrases',
        };
        return [...groups].map(([kind, items]) => (
          <span key={kind} className="mkRel mkList">
            <b>{KIND_LABELS[kind] ?? `${kind}s`}:</b>{' '}
            {items.map((p, i) => (
              <React.Fragment key={p.term}>{i > 0 ? ' · ' : ''}{link(p.term)}</React.Fragment>
            ))}
          </span>
        ));
      })()}

      {/* meta */}
      {entry.synonymDiscussion ? (
        <Group title="Synonym discussion">
          <span className="mkLine">{entry.synonymDiscussion}</span>
        </Group>
      ) : null}
    </article>
  );
}

const MULTI_TERMS = ['take care of', 'takes', 'take'];

function MultiPopup({ onNavigate }: { onNavigate: (term: string) => void }) {
  const stackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const jump = (i: number) => {
    setActive(i);
    stackRef.current?.querySelectorAll<HTMLElement>('.mkCandidate')[i]
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const onScroll = () => {
    const el = stackRef.current;
    if (!el) return;
    let best = 0;
    let bestDist = Infinity;
    el.querySelectorAll<HTMLElement>('.mkCandidate').forEach((c, i) => {
      const d = Math.abs(c.offsetTop - el.scrollTop - el.offsetTop);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    setActive(best);
  };
  return (
    <div className="Tihoka mkFrame">
      <div className="mkStack" ref={stackRef} onScroll={onScroll}>
        {MULTI_TERMS.map((t) => (
          <Popup key={t} stacked entry={ENTRIES[t] ?? TAKE_FALLBACK} onNavigate={onNavigate} />
        ))}
      </div>
      <div className="mkChips" role="tablist" aria-label="candidates">
        {MULTI_TERMS.map((t, i) => (
          <button
            key={t}
            type="button"
            className={`stageChip mkChipBtn ${i === active ? 'stageChip--on' : ''}`}
            onClick={() => jump(i)}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

function App() {
  const [term, setTerm] = useState('take');
  const [multi, setMulti] = useState(false);
  const entry = ENTRIES[term] ?? TAKE_FALLBACK;
  const pick = (t: string) => { setTerm(t); setMulti(false); };
  return (
    <>
      <nav className="stageBar" aria-label="demo entries">
        {ENTRY_LIST.map((t) => (
          <button
            key={t}
            type="button"
            className={`stageChip ${t === term && !multi ? 'stageChip--on' : ''}`}
            onClick={() => pick(t)}
          >
            {t}
          </button>
        ))}
        <button
          type="button"
          className={`stageChip ${multi ? 'stageChip--on' : ''}`}
          onClick={() => setMulti(true)}
        >
          3 candidates
        </button>
      </nav>
      {multi ? <MultiPopup onNavigate={pick} /> : <Popup key={term} entry={entry} onNavigate={pick} />}
    </>
  );
}

const TAKE_FALLBACK = ENTRIES['take']!;

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
