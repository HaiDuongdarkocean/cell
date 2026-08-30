import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ThemeProvider } from '@/features/theme/ui/ThemeProvider';
import { ErrorBoundary } from '@/shared/ui';
import '@/shared/styles/document.css';

// Set initial theme before React renders to avoid flash of unstyled content.
// Defaults mirror DEFAULT_THEME_MODE and DEFAULT_THEME_CONFIG.preset.
document.documentElement.setAttribute('data-theme', 'dark');
document.documentElement.setAttribute('data-preset', 'dawn');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </ThemeProvider>
  </React.StrictMode>,
);
