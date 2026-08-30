import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/shared/styles/document.css';
import { YouTubeWatchPage } from './YouTubeWatchPage';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <YouTubeWatchPage />
  </React.StrictMode>,
);
