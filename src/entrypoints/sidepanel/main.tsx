import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ThemeProvider } from '@/features/theme/ui/ThemeProvider';
import { ErrorBoundary } from '@/shared/ui';
import { installRippleDelegation } from '@/shared/lib/dom/ripple';
import './styles/global.css';

installRippleDelegation(document);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </ThemeProvider>
  </React.StrictMode>,
);
