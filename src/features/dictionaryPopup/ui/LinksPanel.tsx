import { Icon } from '@/shared/icons/Icon';
import { Button } from '@/shared/ui/Button';
import styles from './DictionaryPanelView.module.css';
import type { ExternalDictLink } from '../types';

export interface LinksPanelProps {
  readonly links: readonly ExternalDictLink[];
}

export function LinksPanel({ links }: LinksPanelProps): React.JSX.Element {
  return (
    <div className={styles.cellLinks} data-testid="dictionary-links-panel">
      {links.length === 0 ? (
        <div className={styles.cellLinksEmpty}>
          <span className={styles.cellLinksEmptyIcon}><Icon name="link" size={24} /></span>
          <span className={styles.cellLinksEmptyTitle}>No external links</span>
          <Button variant="outline" size="sm" onClick={() => { /* open settings */ }}>
            Open settings
          </Button>
        </div>
      ) : (
        links.map((link) => (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.cellLinksItem}
            data-testid={`dictionary-link-${link.id}`}
          >
            <Icon name="link" size={16} />
            <span>{link.name}</span>
          </a>
        ))
      )}
    </div>
  );
}
