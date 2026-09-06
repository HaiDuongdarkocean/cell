import { Icon } from '@/shared/ui/Icon';
import { EmptyState } from '@/shared/ui/EmptyState';
import styles from './LinksPanel.module.css';
import type { ExternalDictLink } from '../types';
import { t } from '@/shared/i18n';

export interface LinksPanelProps {
  readonly links: readonly ExternalDictLink[];
}

export function LinksPanel({ links }: LinksPanelProps): React.JSX.Element {
  return (
    <div className={styles.cellLinks} data-cell-id="dictionary-links-panel">
      {links.length === 0 ? (
        <EmptyState
          size="md"
          icon={<Icon name="link"  />}
          title={t('dict.links.empty')}
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
            <Icon name="link"  />
            <span>{link.name}</span>
          </a>
        ))
      )}
    </div>
  );
}
