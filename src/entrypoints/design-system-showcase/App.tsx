import { ShowcaseGallery } from './ShowcaseGallery';
import { installMockDictionarySendMessage } from './mockDictionary';
import { installMockChrome } from './mockChrome';
import { useThemeStore } from '@/stores/themeStore';
import styles from './App.module.css';

installMockChrome();
installMockDictionarySendMessage();
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
