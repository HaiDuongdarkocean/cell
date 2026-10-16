import { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Icon } from '@/shared/ui/Icon';
import '@/shared/styles/tokens.css';
import './mockup.css';

type Theme = 'light' | 'dark';
type Width = 'popup' | 'narrow';
type AiState = 'answered' | 'loading' | 'error' | 'failover';
type Panel = 'ai' | 'breakdown' | 'translate' | 'settings';

const PROVIDERS = ['ChatGPT', 'Gemini', 'DeepSeek', 'Claude'] as const;
const TABS = [
  { id: 'audio', icon: 'audioWave' },
  { id: 'image', icon: 'image' },
  { id: 'translate', icon: 'languages' },
  { id: 'ai', icon: 'atom' },
  { id: 'breakdown', icon: 'scanText' },
  { id: 'links', icon: 'link' },
  { id: 'pronunciation', icon: 'volumeHigh' },
] as const;

function Toolbar({ active }: { active: string }) {
  return (
    <div className="mkToolbar" role="tablist" aria-label="Dictionary panels">
      {TABS.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={t.id === active}
          className={`mkPill${t.id === active ? ' mkPill--active' : ''}`}
          title={t.id}
          aria-label={t.id}
        >
          <Icon name={t.icon} size="sm" />
        </button>
      ))}
    </div>
  );
}

function ProviderRow({ state }: { state: AiState }) {
  const busy = state === 'loading' || state === 'failover';
  const activeIdx = state === 'failover' ? 1 : 0;
  const allFailed = state === 'error';
  return (
    <div className="mkProviderRow" aria-label="AI provider">
      {PROVIDERS.map((p, i) => (
        <button
          key={p}
          className={[
            'mkProviderPill',
            !allFailed && i === activeIdx ? 'mkProviderPill--active' : '',
            (state === 'failover' && i === 0) || allFailed ? 'mkProviderPill--error' : '',
            busy && i !== activeIdx ? 'mkProviderPill--busy' : '',
          ].join(' ')}
          disabled={busy}
        >
          <span
            className={`mkDot ${
              (state === 'failover' && i === 0) || allFailed ? 'mkDot--error' : 'mkDot--ok'
            }`}
            aria-hidden
          />
          {p}
        </button>
      ))}
    </div>
  );
}

function AnswerView({ state }: { state: AiState }) {
  if (state === 'loading') {
    return (
      <div className="mkAnswer">
        <div className="mkSkel" style={{ width: '92%' }} />
        <div className="mkSkel" style={{ width: '78%' }} />
        <div className="mkSkel" style={{ width: '60%' }} />
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div className="mkAnswer mkAnswer--error">
        <Icon name="alertCircle" size="md" />
        <p>All providers failed to answer.</p>
        <button className="mkBtn mkBtn--outline">
          <Icon name="rotateCcw" size="sm" /> Retry
        </button>
      </div>
    );
  }
  return (
    <div className="mkAnswer">
      {state === 'failover' && (
        <p className="mkNotice">ChatGPT did not respond — asking Gemini…</p>
      )}
      <p className="mkAnswerText">
        Here “break a leg” is an idiom: it wishes the listener good luck, not injury. In this
        sentence it softens the advice with playful encouragement before the audition.
      </p>
      <div className="mkAttribution">
        <span>sourced from {state === 'failover' ? 'Gemini' : 'ChatGPT'}</span>
        <button className="mkIconBtn" aria-label="Retry" title="Retry">
          <Icon name="rotateCcw" size="sm" />
        </button>
      </div>
    </div>
  );
}

function BreakdownView() {
  const chunks = [
    { chunk: 'break a leg', meaning: 'good luck', note: 'fixed idiom used before performances; the literal meaning is never intended.' },
    { chunk: 'you’re going to', meaning: 'you will', note: 'informal future marker; signals confidence in the upcoming event.' },
  ];
  return (
    <div className="mkAnswer">
      <ol className="mkChunks">
        {chunks.map((c) => (
          <li key={c.chunk}>
            <b>{c.chunk}</b> → {c.meaning} — {c.note}
          </li>
        ))}
      </ol>
      <div className="mkAttribution">
        <span>sourced from ChatGPT</span>
        <button className="mkIconBtn" aria-label="Retry" title="Retry">
          <Icon name="rotateCcw" size="sm" />
        </button>
      </div>
    </div>
  );
}

function TranslateView() {
  const [engine, setEngine] = useState<'google' | 'ai'>('google');
  return (
    <div className="mkTranslate">
      <div className="mkSeg" role="radiogroup" aria-label="Translation engine">
        {(['google', 'ai'] as const).map((e) => (
          <button
            key={e}
            role="radio"
            aria-checked={engine === e}
            className={`mkSegItem${engine === e ? ' mkSegItem--on' : ''}`}
            onClick={() => setEngine(e)}
          >
            {e === 'google' ? 'Google' : 'AI'}
          </button>
        ))}
      </div>
      <div className="mkAnswer">
        <p className="mkAnswerText">
          {engine === 'google'
            ? 'Bạn sẽ thành công — cố lên nhé!'
            : 'Bạn nhất định sẽ làm được — chúc may mắn!'}
        </p>
        {engine === 'ai' && (
          <div className="mkAttribution">
            <span>sourced from ChatGPT</span>
            <button className="mkIconBtn" aria-label="Retry" title="Retry">
              <Icon name="rotateCcw" size="sm" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsPreview() {
  return (
    <div className="mkSettings">
      <h3>AI bridge</h3>
      <div className="mkRow"><span>Auto-explain on dictionary miss</span><span className="mkToggle mkToggle--on" /></div>
      <div className="mkRow"><span>Translation engine</span>
        <span className="mkSeg"><b className="mkSegItem mkSegItem--on">Google</b><b className="mkSegItem">AI</b></span>
      </div>
      <div className="mkRow"><span>Default provider</span><span className="mkSelect">ChatGPT ▾</span></div>
      <div className="mkRow mkRow--stack"><span>Failover order</span>
        <span className="mkOrder">
          {PROVIDERS.map((p) => (
            <span key={p} className="mkProviderPill"><Icon name="chevronLeft" size="sm" />{p}<Icon name="chevronRight" size="sm" /></span>
          ))}
        </span>
      </div>
      <h3>Custom AI prompts</h3>
      <div className="mkRow"><span>Feature</span>
        <span className="mkSeg"><b className="mkSegItem mkSegItem--on">Word explain</b><b className="mkSegItem">Breakdown</b><b className="mkSegItem">Translate</b></span>
      </div>
      <div className="mkField"><label>System prompt</label><div className="mkArea">You are a language API that explains the specific nuance of specified word(s)…</div></div>
      <div className="mkField"><label>User prompt</label><div className="mkArea">{'[SENTENCE]\nWhat does “[WORD]” mean here?'}</div></div>
      <div className="mkRow mkRow--end">
        <button className="mkBtn mkBtn--outline">Reset to default</button>
        <button className="mkBtn mkBtn--primary">Save</button>
      </div>
    </div>
  );
}

function Popup({ panel, state }: { panel: Panel; state: AiState }) {
  const activeTab = panel === 'ai' || panel === 'breakdown' ? panel : panel === 'translate' ? 'translate' : 'ai';
  return (
    <div className="mkPopup">
      <Toolbar active={activeTab} />
      {panel === 'settings' ? (
        <SettingsPreview />
      ) : (
        <>
          <div className="mkContext">
            <b>“break a leg”</b> · You’re going to break a leg tonight at the audition.
          </div>
          {(panel === 'ai' || panel === 'breakdown') && <ProviderRow state={state} />}
          {panel === 'ai' && <AnswerView state={state} />}
          {panel === 'breakdown' && <BreakdownView />}
          {panel === 'translate' && <TranslateView />}
        </>
      )}
    </div>
  );
}

function App() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [width, setWidth] = useState<Width>('popup');
  const [panel, setPanel] = useState<Panel>('ai');
  const [state, setState] = useState<AiState>('answered');
  return (
    <div className="mkPage" data-theme={theme}>
      <div className="mkSwitchers">
        <select value={panel} onChange={(e) => setPanel(e.target.value as Panel)}>
          <option value="ai">AI tab — word explain</option>
          <option value="breakdown">Breakdown tab</option>
          <option value="translate">Translate — engine toggle</option>
          <option value="settings">Settings — AI section</option>
        </select>
        <select value={state} onChange={(e) => setState(e.target.value as AiState)}>
          <option value="answered">answered</option>
          <option value="loading">loading</option>
          <option value="error">error + retry</option>
          <option value="failover">failover mid-flight</option>
        </select>
        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>theme: {theme}</button>
        <button onClick={() => setWidth(width === 'popup' ? 'narrow' : 'popup')}>
          width: {width}
        </button>
      </div>
      <div className={`mkStage mkStage--${width}`}>
        <Popup panel={panel} state={state} />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
