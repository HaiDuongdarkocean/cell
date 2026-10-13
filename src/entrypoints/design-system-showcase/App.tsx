import { ShowcaseGallery } from './ShowcaseGallery';
import { installMockDictionarySendMessage } from './mockDictionary';
import { installMockSyncBackend } from './mockSyncBackend';
import { installMockChrome } from './mockChrome';
import { useThemeStore } from '@/features/theme/logic/themeStore';
import styles from './App.module.css';

installMockChrome();
installMockDictionarySendMessage();
installMockSyncBackend();
// Showcase has no ThemeProvider, so themeStore.init() never runs and the
// Theme section would always show the 'dark' default regardless of ?mode=.
void useThemeStore.getState().init();

export function App() {
  return (
    <div className={styles.app}>
      <ShowcaseGallery />
    </div>
  );
}
