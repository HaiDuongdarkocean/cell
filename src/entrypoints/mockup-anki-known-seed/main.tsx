import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import '@/shared/styles/tokens.css';
import './mockup.css';
import { SettingsRow } from '@/shared/ui/SettingsRow';
import { Toggle } from '@/shared/ui/Toggle';
import { StatusDot } from '@/shared/ui/StatusDot';
import { Button } from '@/shared/ui/Button';
import { Alert } from '@/shared/ui/Alert';
import { InputField } from '@/shared/ui/InputField';
import { Icon } from '@/shared/ui/Icon';
import { Kbd } from '@/shared/ui/Kbd';

function SyncSection({ addon }: { addon: 'connected' | 'absent' }) {
  const [enabled, setEnabled] = useState(true);
  const [writeBack, setWriteBack] = useState(false);
  const [port, setPort] = useState('8766');
  return (
    <div className="card" data-mk="anki-sync-section">
      <div className="cardTitle">Anki status sync</div>
      <SettingsRow dense>
        <span className="rowLabel">Enabled</span>
        <Toggle checked={enabled} onChange={setEnabled} ariaLabel="Enable Anki status sync" />
      </SettingsRow>
      <SettingsRow dense divider>
        <div>
          <div className="rowLabel">Write back &lsquo;known&rsquo; to Anki</div>
          <div className="rowHint">
            Marks matching Anki cards mature (ivl≥21). Modifies your Anki collection.
          </div>
        </div>
        <Toggle
          checked={writeBack}
          onChange={setWriteBack}
          disabled={!enabled}
          ariaLabel="Write back known status to Anki"
        />
      </SettingsRow>
      <SettingsRow dense divider>
        <InputField
          label="Addon port"
          value={port}
          onChange={(e) => setPort(e.target.value)}
          inputMode="numeric"
          helperText="Bridge addon listens on 127.0.0.1"
        />
      </SettingsRow>
      <div className="syncFoot">
        <span className="dotWrap">
          <StatusDot
            status={addon === 'connected' ? 'success' : 'neutral'}
            size="sm"
            aria-label={addon === 'connected' ? 'Addon connected' : 'Addon not installed'}
          />
          Addon {addon === 'connected' ? 'connected' : 'not installed'}
        </span>
        <Button size="sm" variant="primary" leadingIcon={<Icon name="rotateCcw" size="sm" />} disabled={!enabled}>
          Sync now
        </Button>
      </div>
      <div className="syncFoot">Last sync 12:34 · 12 updated · 0 errors</div>
      {addon === 'absent' && (
        <Alert
          variant="default"
          role="status"
          icon={<Icon name="info" size="sm" />}
          description="Addon not installed — sync runs via 5-minute poll. Install the bridge addon for near-realtime updates."
        />
      )}
    </div>
  );
}

function StatusSurfaces() {
  const statuses = ['unknown', 'tracking', 'learning', 'known', 'ignore'] as const;
  return (
    <>
      <div className="card">
        <div className="cardTitle">Status chips (vocabulary browser)</div>
        <div className="chips">
          {statuses.map((s) => (
            <span key={s} className={`statusChip ${s}`}>
              {s === 'unknown' ? 'Unknown 12' : s === 'tracking' ? 'Tracking 8' : s === 'learning' ? 'Learning 5' : s === 'known' ? 'Known 240' : 'Ignore 3'}
            </span>
          ))}
        </div>
        <div className="cardTitle" style={{ fontSize: 13 }}>Token underline colors</div>
        <div className="legendRow">
          {statuses.map((s) => (
            <span key={s} className="legendItem">
              <i style={{ background: `var(--color-token-status-${s})` }} />
              {s}
            </span>
          ))}
        </div>
        <div className="cardTitle" style={{ fontSize: 13 }}>Status keys</div>
        <div className="kbdRow">
          <span><Kbd>1</Kbd> unknown</span>
          <span><Kbd>2</Kbd> tracking</span>
          <span><Kbd>3</Kbd> known</span>
          <span><Kbd>4</Kbd> ignore</span>
          <span><Kbd>5</Kbd> learning</span>
        </div>
      </div>
    </>
  );
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [addon, setAddon] = useState<'connected' | 'absent'>('absent');
  React.useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return (
    <div className="page">
      <h1>anki-known-seed — design mockup</h1>
      <p className="note">
        Variant: sync controls live inside Settings → Sync section card; `learning` is a 5th
        status color (blue) added to chip/underline/keymap surfaces.
      </p>
      <div className="toolbar">
        <button className={theme === 'light' ? 'on' : ''} onClick={() => setTheme('light')}>Light</button>
        <button className={theme === 'dark' ? 'on' : ''} onClick={() => setTheme('dark')}>Dark</button>
        <button className={addon === 'connected' ? 'on' : ''} onClick={() => setAddon('connected')}>Addon connected</button>
        <button className={addon === 'absent' ? 'on' : ''} onClick={() => setAddon('absent')}>Addon absent</button>
      </div>
      <h2>Settings → Sync section</h2>
      <SyncSection addon={addon} />
      <h2>Status surfaces</h2>
      <StatusSurfaces />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
