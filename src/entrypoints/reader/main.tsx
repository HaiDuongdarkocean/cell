import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@/features/theme/ui/ThemeProvider';
import { ReaderApp } from './App';
import { installRippleDelegation } from '@/shared/lib/dom/ripple';
import './styles/global.css';

installRippleDelegation(document);

const root = document.getElementById('root');
if (!root) {
  throw new Error('Reader root element not found');
}

createRoot(root).render(
  <ThemeProvider>
    <ReaderApp />
  </ThemeProvider>
);
