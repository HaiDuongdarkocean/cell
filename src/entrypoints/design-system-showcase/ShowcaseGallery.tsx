import { useMemo, type ReactElement } from 'react';
import { discoverShowcases, groupShowcases } from './autoDiscovery';
import appStyles from './App.module.css';
import styles from './ShowcaseGallery.module.css';

export function ShowcaseGallery(): ReactElement | null {
  const grouped = useMemo(() => groupShowcases(discoverShowcases()), []);
  const groupEntries = Object.entries(grouped);
  if (groupEntries.length === 0) return null;

  return (
    <>
      {groupEntries.map(([group, showcases]) => (
        <section className={appStyles.section} key={group}>
          <h2 className={appStyles.sectionTitle}>{group}</h2>
          <div className={styles.gallery}>
            {showcases.map((showcase) => (
              <div className={styles.card} key={showcase.id}>
                <h3 className={styles.cardTitle}>{showcase.meta.title}</h3>
                <div className={styles.cardBody}>
                  <showcase.Component />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
