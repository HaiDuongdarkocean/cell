import { Icon } from '@/shared/icons/Icon';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import styles from './DictionaryPanelView.module.css';
import type { ExternalDictLink } from '../types';

export interface LinksPanelProps {
  readonly links: readonly ExternalDictLink[];
}

export function LinksPanel({ links }: LinksPanelProps): React.JSX.Element {
  return (
    <div className={styles.cellLinks} data-cell-id="dictionary-links-panel">
      {links.length === 0 ? (
        <EmptyState
          size="sm"
          icon={<Icon name="link" size={24} />}
          title="No external links"
          action={
            <Button variant="outline" size="sm" onClick={() => { /* open settings */ }}>
              Open settings
            </Button>
          }
          data-cell-id="dictionary-links-empty"
        />
      ) : (
        links.map((link) => (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.cellLinksItem}
            data-cell-id={`dictionary-link-${link.id}`}
          >
            <Icon name="link" size={24} />
            <span>{link.name}</span>
          </a>
        ))
      )}
    </div>
  );
}
