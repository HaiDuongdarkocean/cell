import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { OptionsApp } from './OptionsApp';
import { ThemeProvider } from '@/features/theme/ui/ThemeProvider';
import { ErrorBoundary } from '@/shared/ui';
import '@/shared/styles/tokens.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root not found');

createRoot(rootEl).render(
  <StrictMode>
    <ThemeProvider>
      <ErrorBoundary>
        <OptionsApp />
      </ErrorBoundary>
    </ThemeProvider>
  </StrictMode>,
);
