// OptionsApp — options page shell with responsive sidebar nav (BEM + design-system tokens).

import { useState, useCallback, useRef, useEffect, type ReactElement, type KeyboardEvent } from 'react';
import { ResourcesPanel } from '@/features/dictionary/ui/ResourcesPanel';
import { ThemePanel } from '@/features/theme/ui/ThemePanel';
import { TtsVoiceManagerPanel, DEFAULT_TTS_SETTINGS } from '@/features/tts/ui/TtsVoiceManagerPanel';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import { IconButton } from '@/shared/ui/IconButton';
import { useFocusTrap } from '@/shared/ui';
import { Icon } from '@/shared/icons/Icon';
import { DEFAULT_DICTIONARY_POPUP_SETTINGS } from '@/shared/config/config';
import { seedDevDataIfEmpty, setDevSeedEnabled } from '@/features/dictionary/logic/devSeed';
import { isDevMode } from '@/shared/lib/env/devMode';
import type { TtsSettings, DictionaryPopupSettings } from '@/entities/settings/types';
import { SidebarItem } from './SidebarItem';
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
  const [ttsSettings, setTtsSettings] = useState<TtsSettings>(DEFAULT_TTS_SETTINGS);
  const [ttsReady, setTtsReady] = useState(false);
  const mobileShellRef = useRef<HTMLDivElement>(null);

  useFocusTrap(mobileShellRef, drawerOpen);

  // Dev-only auto-seed: if DB is empty, import test dictionary + frequency
  // data in parallel. Fire-and-forget — never blocks render. No-op in prod.
  useEffect(() => {
    setDevSeedEnabled(isDevMode);
    void seedDevDataIfEmpty('en');
  }, []);

  // Load TTS settings only when the TTS tab is active to avoid unnecessary
  // storage reads and React act warnings in tests for other tabs.
  useEffect(() => {
    if (activeTab !== 'tts' || ttsReady) return;
    let cancelled = false;
    void loadSettings().then((s) => {
      if (cancelled) return;
      setTtsSettings(s.dictionaryPopup?.tts ?? DEFAULT_TTS_SETTINGS);
      setTtsReady(true);
    }).catch((err) => {
      if (!cancelled) console.warn('[options] Failed to load TTS settings:', err);
    });
    return () => {
      cancelled = true;
    };
  }, [activeTab, ttsReady]);

  const handleSaveTts = useCallback(async (tts: TtsSettings) => {
    setTtsSettings(tts);
    const current = await loadSettings();
    const dictionaryPopup: DictionaryPopupSettings = {
      ...(current.dictionaryPopup ?? DEFAULT_DICTIONARY_POPUP_SETTINGS),
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
    const tabs = mobileShellRef.current?.querySelectorAll<HTMLButtonElement>('button[role=tab]');
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
    const nextId = SIDEBAR_ITEMS[nextIndex]?.id;
    if (nextId) handleTabChange(nextId);
  }, [handleTabChange]);

  const rootClass = styles['options-app'];
  const sidebarClass = [styles['options-app__sidebar'], drawerOpen ? styles['options-app__sidebar--open'] : ''].filter(Boolean).join(' ');

  return (
    <div className={rootClass} data-testid="options-app">
      <a href="#panel-resources" className={styles['options-app__skip-link']}>Bỏ qua tới nội dung</a>
      <header className={styles['options-app__header']}>
        <h1 className={styles['options-app__title']}>Cell — Tùy chọn</h1>
        <IconButton
          className={styles['options-app__menu-btn']}
          onClick={toggleDrawer}
          aria-label="Mở menu điều hướng"
          aria-expanded={drawerOpen}
          aria-controls="options-menu"
          data-testid="hamburger"
          size="md"
          variant="ghost"
        >
          <Icon name="menu" size={20} />
        </IconButton>
      </header>
      <div className={styles['options-app__layout']}>
        <div
          id="options-menu"
          ref={mobileShellRef}
          className={styles['options-app__mobile-shell']}
          role={drawerOpen ? 'dialog' : undefined}
          aria-modal={drawerOpen ? 'true' : undefined}
          aria-label={drawerOpen ? 'Menu điều hướng' : undefined}
        >
          {drawerOpen && (
            <div className={styles['options-app__overlay']} onClick={() => setDrawerOpen(false)} aria-hidden="true" />
          )}
          <IconButton
            className={styles['options-app__close']}
            onClick={() => setDrawerOpen(false)}
            aria-label="Đóng menu"
            size="md"
            variant="ghost"
          >
            <Icon name="x" size={20} />
          </IconButton>
          <nav
            className={sidebarClass}
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
        </div>
        <main className={styles['options-app__main']}>
          <section
            className={styles['options-app__panel']}
            role="tabpanel"
            id="panel-resources"
            aria-labelledby="nav-resources"
            hidden={activeTab !== 'resources'}
          >
            <ResourcesPanel langCode="en" />
          </section>
          <section
            className={styles['options-app__panel']}
            role="tabpanel"
            id="panel-theme"
            aria-labelledby="nav-theme"
            hidden={activeTab !== 'theme'}
          >
            <ThemePanel />
          </section>
          <section
            className={styles['options-app__panel']}
            role="tabpanel"
            id="panel-settings"
            aria-labelledby="nav-settings"
            hidden={activeTab !== 'settings'}
          >
            <SettingsPlaceholder />
          </section>
          <section
            className={styles['options-app__panel']}
            role="tabpanel"
            id="panel-tts"
            aria-labelledby="nav-tts"
            hidden={activeTab !== 'tts'}
          >
            {activeTab === 'tts' && !ttsReady && (
              <p className={styles['options-app__panel-loading']}>Đang tải cài đặt TTS…</p>
            )}
            {activeTab === 'tts' && ttsReady && (
              <TtsVoiceManagerPanel settings={ttsSettings} onSave={(tts) => void handleSaveTts(tts)} />
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

function SettingsPlaceholder(): ReactElement {
  return (
    <div className={styles['options-app__placeholder']} data-testid="settings-placeholder">
      <p>Cài đặt — chuyển từ SettingsDialog sang đây (M11 ponytail).</p>
    </div>
  );
}
