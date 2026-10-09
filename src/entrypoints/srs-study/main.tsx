import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { SrsStudyProvider } from '@/features/srs/ui/SrsStudyProvider';
import { ThemeProvider } from '@/features/theme/ui/ThemeProvider';
import { ErrorBoundary } from '@/shared/ui';
import { installRippleDelegation } from '@/shared/lib/dom/ripple';
import { t } from '@/shared/i18n';
import '@/shared/styles/document.css';

installRippleDelegation(document);
document.title = t('srs.title');

// Set initial theme before React renders to avoid flash of unstyled content.
document.documentElement.setAttribute('data-theme', 'dark');
document.documentElement.setAttribute('data-preset', 'dawn');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ErrorBoundary>
        <SrsStudyProvider>
          <App />
        </SrsStudyProvider>
      </ErrorBoundary>
    </ThemeProvider>
  </React.StrictMode>,
);
