import { useState } from 'react';
import ReactDOM from 'react-dom/client';
import '@/shared/styles/tokens.css';
import './mockup.css';
import { ENTRIES, ENTRY_LIST } from './mockData';
import { Real } from './Real';
import { ConceptA } from './ConceptA';
import { ConceptB } from './ConceptB';
import { ConceptC } from './ConceptC';

type Concept = 'real' | 'a' | 'b' | 'c';
type Viewport = 'mobile' | 'desktop';
type Theme = 'dark' | 'light';

const CONCEPTS: { id: Concept; label: string; note: string }[] = [
  { id: 'real', label: 'Real', note: 'Production PopupDictionary — implemented Concept A: PosVariantNav chapter links + accent label before IPA + per-variant status/freq/defs.' },
  { id: 'a', label: 'A · Chapter links', note: 'POS as text links `adjective | verb | noun` pinned at the very top, GoldenDict/Macmillan style. Accent label inline before IPA, tap to toggle.' },
  { id: 'b', label: 'B · Variant tabs', note: 'POS as segmented pill tabs under the headword — bigger touch targets, clearer selected state. Accent is a two-segment AmE|BrE mini control.' },
  { id: 'c', label: 'C · Meta chip', note: 'Compact: one `pos ⌄` chip beside the headword opens a Menu listing variants with per-POS status dots + rank. Frees a full row.' },
];

function App() {
  const [concept, setConcept] = useState<Concept>('a');
  const [term, setTerm] = useState('present');
  const [viewport, setViewport] = useState<Viewport>('mobile');
  const [theme, setTheme] = useState<Theme>('dark');

  document.documentElement.dataset.theme = theme;

  const entry = ENTRIES[term] ?? ENTRIES.present;
  const active = CONCEPTS.find((c) => c.id === concept);

  return (
    <>
      <nav className="stageBar" aria-label="concept">
        {CONCEPTS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`stageChip${concept === c.id ? ' stageChip--on' : ''}`}
            onClick={() => setConcept(c.id)}
          >
            {c.label}
          </button>
        ))}
      </nav>
      <nav className="stageBar" aria-label="entry">
        {ENTRY_LIST.map((t) => (
          <button
            key={t}
            type="button"
            className={`stageChip${term === t ? ' stageChip--on' : ''}`}
            onClick={() => setTerm(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      <nav className="stageBar" aria-label="viewport and theme">
        <button type="button" className={`stageChip${viewport === 'mobile' ? ' stageChip--on' : ''}`} onClick={() => setViewport('mobile')}>Mobile</button>
        <button type="button" className={`stageChip${viewport === 'desktop' ? ' stageChip--on' : ''}`} onClick={() => setViewport('desktop')}>Desktop</button>
        <span className="stageSep" />
        <button type="button" className={`stageChip${theme === 'dark' ? ' stageChip--on' : ''}`} onClick={() => setTheme('dark')}>Dark</button>
        <button type="button" className={`stageChip${theme === 'light' ? ' stageChip--on' : ''}`} onClick={() => setTheme('light')}>Light</button>
      </nav>

      <p className="stageNote">{active?.note}</p>

      <div className={`mkStage mkStage--${viewport}`}>
        {concept === 'real' && <Real term={term} />}
        {concept === 'a' && <ConceptA key={term} entry={entry} />}
        {concept === 'b' && <ConceptB key={term} entry={entry} />}
        {concept === 'c' && <ConceptC key={term} entry={entry} />}
      </div>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
