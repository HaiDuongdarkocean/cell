import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import '@/shared/styles/tokens.css';
import '@/shared/styles/scrollbars-document.css';

// Set initial theme before React renders to avoid flash of unstyled content
document.documentElement.setAttribute('data-theme', 'light');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
