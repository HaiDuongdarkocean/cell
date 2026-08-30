import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { LanguageProfilePanel } from '@/features/settings/ui/LanguageProfilePanel';
import { ThemeProvider } from '@/features/theme/ui/ThemeProvider';
import { ErrorBoundary } from '@/shared/ui';
import { DEFAULT_SETTINGS } from '@/shared/config/config';
import type { Settings } from '@/entities/settings';
import '@/shared/styles/document.css';

document.documentElement.setAttribute('data-theme', 'light');

const initial: Settings = {
  ...DEFAULT_SETTINGS,
  languageProfiles: [],
  activeProfileId: null,
};

function App(): React.ReactElement {
  const [settings, setSettings] = useState<Settings>(initial);
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <div style={{ padding: '24px', maxWidth: '720px', margin: '0 auto' }}>
          <LanguageProfilePanel settings={settings} onChange={setSettings} />
        </div>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
