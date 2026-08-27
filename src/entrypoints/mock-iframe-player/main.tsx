import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/shared/styles/tokens.css';
import { StreamFlixPage } from '../mock-streaming-page/StreamFlixPage';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StreamFlixPage mode="iframe-child" />
  </React.StrictMode>,
);
