import { ShowcaseGallery } from './ShowcaseGallery';
import { installMockDictionarySendMessage } from './mockDictionary';
import styles from './App.module.css';

installMockDictionarySendMessage();

export function App() {
  return (
    <div className={styles.app}>
      <ShowcaseGallery />
    </div>
  );
}
