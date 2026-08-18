import type { ReactElement } from 'react';
import { ResourcesPanel } from '@/features/dictionary/ui/ResourcesPanel';
import styles from './ResourcesPanel.showcase.module.css';

export function Showcase(): ReactElement {
  return (
    <div className={styles.wrapper}>
      <div className={styles.panelFrame}>
        <ResourcesPanel langCode="en" />
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Dictionary Resources Panel',
  description: 'Dictionary + frequency resource management: 2 sections (dictionary + frequency) with independent import state. Dropzone for file import, ResourceCard list with delete confirm, ImportProgress bar, skeleton loading state.',
  level: 'organisms' as const,
  category: 'Dictionary',
  order: 30,
};
