import React from 'react';
import ReactDOM from 'react-dom/client';
import { MockIframePlayer } from './MockIframePlayer';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MockIframePlayer />
  </React.StrictMode>,
);
