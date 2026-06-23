import styles from './TabBar.module.css';

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function TabBar({ tabs, activeTab, onTabChange }: TabBarProps): React.JSX.Element {
  return (
    <nav className={styles.tabBar} role="tablist" aria-label="Media sections">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`panel-${tab.id}`}
          data-testid={`tab-${tab.id}`}
          onClick={() => onTabChange(tab.id)}
        >
          <span className={styles.tabLabel}>{tab.label}</span>
          {tab.count !== undefined && tab.count > 0 && (
            <span className={styles.tabCount}>{tab.count}</span>
          )}
        </button>
      ))}
    </nav>
  );
}