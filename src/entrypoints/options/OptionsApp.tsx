// OptionsApp — shell with sidebar nav (UI-UX-Contract, Gate 2 approved).
// Sidebar 3 items: Tài nguyên / Giao diện / Cài đặt.
// Responsive: desktop 200px full, tablet 56px icon-only, mobile drawer.

import { useState, useCallback, useRef, useEffect, type ReactElement, type KeyboardEvent } from 'react';
import { ResourcesPanel } from '@/features/dictionary/ui/ResourcesPanel';
import { ThemePanel } from '@/features/theme/ui/ThemePanel';
import { TtsVoiceManagerPanel, DEFAULT_TTS_SETTINGS } from '@/features/tts/ui/TtsVoiceManagerPanel';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import type { TtsSettings, DictionaryPopupSettings } from '@/entities/settings/types';
import { SidebarItem } from './SidebarItem';
import { Icon } from '@/shared/icons/Icon';
import type { Tab, SidebarItem as SidebarItemType } from './types';
import styles from './OptionsApp.module.css';

const SIDEBAR_ITEMS: readonly SidebarItemType[] = [
  { id: 'resources', label: 'Tài nguyên', icon: 'download' },
  { id: 'theme', label: 'Giao diện', icon: 'moon' },
  { id: 'settings', label: 'Cài đặt', icon: 'settings' },
  { id: 'tts', label: 'TTS Voices', icon: 'audioWave' },
];

export function OptionsApp(): ReactElement {
  const [activeTab, setActiveTab] = useState<Tab>('resources');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const [ttsSettings, setTtsSettings] = useState<TtsSettings>(DEFAULT_TTS_SETTINGS);

  // Load TTS settings on mount (settings.dictionaryPopup.tts ?? defaults).
  useEffect(() => {
    let cancelled = false;
    void loadSettings().then((s) => {
      if (cancelled) return;
      setTtsSettings(s.dictionaryPopup?.tts ?? DEFAULT_TTS_SETTINGS);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaveTts = useCallback(async (tts: TtsSettings) => {
    setTtsSettings(tts);
    const current = await loadSettings();
    const dictionaryPopup: DictionaryPopupSettings = {
      ...(current.dictionaryPopup ?? {
        enabled: false,
        triggerMode: 'click',
        defaultActiveTab: null,
        srsDestination: 'anki',
        popupWidthPx: 560,
        popupMaxHeightPx: 480,
        externalDictLinks: [],
      }),
      tts,
    };
    await saveSettings({ dictionaryPopup });
  }, []);

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
        {drawerOpen && (
          <>
            <div className={styles.drawerOverlay} onClick={() => setDrawerOpen(false)} aria-hidden="true" />
            <button
              type="button"
              className={styles.drawerClose}
              onClick={() => setDrawerOpen(false)}
              aria-label="Đóng menu"
            >
              <Icon name="x" size={20} />
            </button>
          </>
        )}
        <nav
          ref={sidebarRef}
          className={`${styles.sidebar} ${drawerOpen ? styles.sidebarOpen : ''}`}
          role="tablist"
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
        </nav>
        <div className={`${styles.panels} ${styles.contentMeasure}`}>
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
          <section
            className={styles.content}
            role="tabpanel"
            id="panel-tts"
            aria-labelledby="nav-tts"
            hidden={activeTab !== 'tts'}
          >
            <TtsVoiceManagerPanel settings={ttsSettings} onSave={(tts) => void handleSaveTts(tts)} />
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
