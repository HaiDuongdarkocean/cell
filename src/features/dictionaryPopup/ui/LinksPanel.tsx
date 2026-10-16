import { Icon } from '@/shared/ui/Icon';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Panel, PanelList } from './PopupPanel';
import styles from './LinksPanel.module.css';
import type { ExternalDictLink } from '@/entities/dictionary';
import { t } from '@/shared/i18n';

export interface LinksPanelProps {
  readonly links: readonly ExternalDictLink[];
}

export function LinksPanel({ links }: LinksPanelProps): React.JSX.Element {
  return (
    <Panel id="dictionary-links-panel">
      {links.length === 0 ? (
        <EmptyState
          size="md"
          icon={<Icon name="link"  />}
          title={t('dict.links.empty')}
          data-tihoka-id="dictionary-links-empty"
        />
      ) : (
        <PanelList gap="sm" wrap>
          {links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.TihokaLinksItem}
              data-tihoka-id={`dictionary-link-${link.id}`}
            >
              <Icon name="link"  />
              <span>{link.name}</span>
            </a>
          ))}
        </PanelList>
      )}
    </Panel>
  );
}
