import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppRedesigned } from './App.redesigned';
import { ThemeProvider } from '@/features/theme/ui/ThemeProvider';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AppRedesigned />
    </ThemeProvider>
  </React.StrictMode>,
);
