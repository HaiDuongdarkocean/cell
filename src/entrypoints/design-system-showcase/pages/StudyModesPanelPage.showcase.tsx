import { useEffect, type ReactElement } from 'react';
import { StudyModesTab } from '@/features/studyModes/ui/StudyModesTab';
import { loadStudyModeState, useStudyModeStore } from '@/features/studyModes/studyModeStore';
import { INITIAL_STUDY_MODE_STATE } from '@/features/studyModes/lib/migrateStudyModeState';
import styles from './StudyModesPanelPage.module.css';

export function Showcase(): ReactElement {
  useEffect(() => {
    // In a real browser without chrome.*, loadStudyModeState falls back to defaults.
    // For the showcase, ensure defaults are present synchronously so the first paint is immediate.
    useStudyModeStore.setState({ ...INITIAL_STUDY_MODE_STATE, isLoaded: true });
    void loadStudyModeState();
  }, []);

  return (
    <div className={styles.page}>
      <StudyModesTab />
    </div>
  );
}

export const showcaseMeta = {
  title: 'Study Modes Panel',
  description:
    'Universal Panel tab for selecting study/playback modes. Card grid layout with custom mode builder and advanced settings.',
  level: 'pages' as const,
  category: 'Side Panel',
  order: 35,
};
