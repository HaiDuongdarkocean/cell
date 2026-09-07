import { useEffect, type ReactElement } from 'react';
import { StudyModesTab } from '@/features/studyModes/ui/StudyModesTab';
import { loadStudyModeState, useStudyModeStore } from '@/features/studyModes/studyModeStore';
import { getMockStudyModeState } from '../showcaseFixtures';
import styles from './StudyModesPanelPage.module.css';

export function Showcase(): ReactElement {
  useEffect(() => {
    // Seed the store with the data-state variant first so the first paint is
    // immediate, then let loadStudyModeState reconcile against the mock chrome
    // storage installed by App.tsx.
    useStudyModeStore.setState({ ...getMockStudyModeState(), isLoaded: true });
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
