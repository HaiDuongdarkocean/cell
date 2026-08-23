import React from 'react';
import ReactDOM from 'react-dom/client';
import { MockStreamingIframePage } from './MockStreamingIframePage';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MockStreamingIframePage />
  </React.StrictMode>,
);
