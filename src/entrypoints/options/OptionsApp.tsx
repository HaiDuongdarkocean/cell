// OptionsApp — shell with sidebar nav (UI-UX-Contract, Gate 2 approved).
// Sidebar 3 items: Tài nguyên / Giao diện / Cài đặt.
// Responsive: desktop 200px full, tablet 56px icon-only, mobile drawer.

import { useState, useCallback, useRef, type ReactElement, type KeyboardEvent } from 'react';
import { ResourcesPanel } from '@/features/dictionary/ui/ResourcesPanel';
import { ThemePanel } from '@/features/theme/ui/ThemePanel';
import { SidebarItem } from './SidebarItem';
import type { Tab, SidebarItem as SidebarItemType } from './types';
import styles from './OptionsApp.module.css';

const SIDEBAR_ITEMS: readonly SidebarItemType[] = [
  { id: 'resources', label: 'Tài nguyên', icon: '▣' },
  { id: 'theme', label: 'Giao diện', icon: '▢' },
  { id: 'settings', label: 'Cài đặt', icon: '▢' },
];

export function OptionsApp(): ReactElement {
  const [activeTab, setActiveTab] = useState<Tab>('resources');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
    setDrawerOpen(false);
  }, []);

  const toggleDrawer = useCallback(() => {
    setDrawerOpen((open) => !open);
  }, []);

  const handleSidebarKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const tabs = sidebarRef.current?.querySelectorAll<HTMLButtonElement>('button[role=tab]');
    if (!tabs || tabs.length === 0) return;
    const tabList = Array.from(tabs);
    const currentIndex = tabList.findIndex((t) => t.getAttribute('aria-selected') === 'true');
    let nextIndex: number;
    if (e.key === 'ArrowDown') {
      nextIndex = currentIndex < 0 || currentIndex === tabList.length - 1 ? 0 : currentIndex + 1;
    } else {
      nextIndex = currentIndex <= 0 ? tabList.length - 1 : currentIndex - 1;
    }
    tabList[nextIndex]?.focus();
    const nextId = tabList[nextIndex]?.id.replace('nav-', '') as Tab;
    if (nextId) setActiveTab(nextId);
  }, []);

  return (
    <div className={styles.container} data-testid="options-app">
      <a href="#panel-resources" className={styles.skipLink}>Bỏ qua tới nội dung</a>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>Cell — Tùy chọn</h1>
        <button
          type="button"
          className={styles.hamburger}
          onClick={toggleDrawer}
          aria-label="Mở menu điều hướng"
          aria-expanded={drawerOpen}
          data-testid="hamburger"
        >
          ☰
        </button>
      </div>
      <div className={styles.layout}>
        {drawerOpen && <div className={styles.drawerOverlay} onClick={() => setDrawerOpen(false)} aria-hidden="true" />}
        <nav
          ref={sidebarRef}
          className={`${styles.sidebar} ${drawerOpen ? styles.sidebarOpen : ''}`}
          role="navigation"
          aria-label="Tùy chọn sections"
          onKeyDown={handleSidebarKeyDown}
        >
          {SIDEBAR_ITEMS.map((item) => (
            <SidebarItem
              key={item.id}
              id={item.id}
              label={item.label}
              icon={item.icon}
              active={activeTab === item.id}
              onClick={handleTabChange}
            />
          ))}
          <div className={styles.sidebarDivider} role="separator" />
          <div className={styles.sidebarRoom} aria-hidden="true">
            <span className={styles.roomLabel}>(room sau)</span>
          </div>
        </nav>
        <div className={styles.panels}>
          <section
            className={styles.content}
            role="tabpanel"
            id="panel-resources"
            aria-labelledby="nav-resources"
            hidden={activeTab !== 'resources'}
          >
            <ResourcesPanel langCode="en" />
          </section>
          <section
            className={styles.content}
            role="tabpanel"
            id="panel-theme"
            aria-labelledby="nav-theme"
            hidden={activeTab !== 'theme'}
          >
            <ThemePanel />
          </section>
          <section
            className={styles.content}
            role="tabpanel"
            id="panel-settings"
            aria-labelledby="nav-settings"
            hidden={activeTab !== 'settings'}
          >
            <SettingsPlaceholder />
          </section>
        </div>
      </div>
    </div>
  );
}

function SettingsPlaceholder(): ReactElement {
  return (
    <div className={styles.placeholder} data-testid="settings-placeholder">
      <p>Cài đặt — chuyển từ SettingsDialog sang đây (M11 ponytail).</p>
    </div>
  );
}
