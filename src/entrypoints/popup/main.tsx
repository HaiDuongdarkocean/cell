import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppRedesigned } from './App.redesigned';
import { ThemeProvider } from '@/features/theme/ui/ThemeProvider';
import { ErrorBoundary } from '@/shared/ui';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ErrorBoundary>
        <AppRedesigned />
      </ErrorBoundary>
    </ThemeProvider>
  </React.StrictMode>,
);
