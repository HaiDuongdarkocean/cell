import { useEffect, useState, type ReactElement } from 'react';
import { SettingsDialog } from '@/features/settings/ui/SettingsDialog';
import { SettingsDialogContent } from '@/features/settings/ui/SettingsDialogContent';
import { DEFAULT_SETTINGS } from '@/shared/config/config';
import type { Settings } from '@/entities/media';
import { ViewportFrame, type ViewportWidth } from '../ViewportFrame';
import { Icon } from '@/shared/icons/Icon';
import styles from './SettingsPage.module.css';

interface ViewportOption {
  label: string;
  value: ViewportWidth;
  sub: string;
}

const VIEWPORT_OPTIONS: ViewportOption[] = [
  { label: '320', value: 320, sub: 'Mobile S' },
  { label: '375', value: 375, sub: 'Mobile M' },
  { label: '430', value: 430, sub: 'Mobile L' },
  { label: '600', value: 600, sub: 'Tablet SM' },
  { label: '768', value: 768, sub: 'Tablet' },
  { label: '840', value: 840, sub: 'Desktop MD' },
  { label: '1200', value: 1200, sub: 'Desktop LG' },
  { label: '100%', value: 'full', sub: 'Fit' },
];

const HEIGHT_OPTIONS = [580, 720, 850];

export function Showcase(): ReactElement {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [viewportWidth, setViewportWidth] = useState<ViewportWidth>(840);
  const [canvasHeight, setCanvasHeight] = useState<number>(720);
  const [viewMode, setViewMode] = useState<'direct' | 'dialog'>('direct');
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Sync from URL search params if provided (e.g. ?viewport=320&view=direct&mode=dark)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const vpParam = params.get('viewport');
    if (vpParam) {
      if (vpParam === 'full') setViewportWidth('full');
      else {
        const num = Number(vpParam);
        if (!isNaN(num) && [320, 360, 375, 390, 430, 600, 768, 840, 1024, 1200, 1280, 1920].includes(num)) {
          setViewportWidth(num as ViewportWidth);
        }
      }
    }
    const viewParam = params.get('view');
    if (viewParam === 'dialog' || viewParam === 'direct') {
      setViewMode(viewParam);
    }
    const modeParam = params.get('mode');
    if (modeParam === 'dark' || modeParam === 'light') {
      setThemeMode(modeParam);
    } else {
      const currentDocTheme = document.documentElement.getAttribute('data-theme');
      if (currentDocTheme === 'dark' || currentDocTheme === 'light') {
        setThemeMode(currentDocTheme);
      }
    }
  }, []);

  // Keyboard shortcut Esc to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const openStandaloneWindow = (): void => {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const targetUrl = `${origin}${pathname}?showcase=Settings+Dialog+Page&mode=${themeMode}&viewport=${viewportWidth}&view=${viewMode}`;
    window.open(targetUrl, '_blank');
  };

  const renderContent = (): ReactElement => {
    if (viewMode === 'direct') {
      return (
        <div style={{ padding: 'var(--space-4)', height: '100%', boxSizing: 'border-box' }}>
          <SettingsDialogContent settings={settings} onChange={setSettings} />
        </div>
      );
    }

    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #f0f4f8 0%, #d9e2ec 100%)',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-base)',
          }}
        >
          <span>Web Page (Behind Dialog)</span>
        </div>
        <SettingsDialog
          isOpen={isDialogOpen}
          settings={settings}
          onChange={setSettings}
          onClose={() => setIsDialogOpen(false)}
        />
      </div>
    );
  };

  return (
    <div className={styles.wrapper}>
      {/* ─── Control Bar ─── */}
      <div className={styles.toolbar}>
        {/* Viewport Width Breakpoint Switcher */}
        <div className={styles.toolbarGroup}>
          <span className={styles.groupLabel}>Width:</span>
          <div className={styles.pills}>
            {VIEWPORT_OPTIONS.map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                className={[
                  styles.pillBtn,
                  viewportWidth === opt.value ? styles.pillBtnActive : '',
                ].filter(Boolean).join(' ')}
                onClick={() => setViewportWidth(opt.value)}
                title={`${opt.label}px (${opt.sub})`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Canvas Height Switcher */}
        <div className={styles.toolbarGroup}>
          <span className={styles.groupLabel}>Height:</span>
          <div className={styles.pills}>
            {HEIGHT_OPTIONS.map((h) => (
              <button
                key={h}
                type="button"
                className={[
                  styles.pillBtn,
                  canvasHeight === h ? styles.pillBtnActive : '',
                ].filter(Boolean).join(' ')}
                onClick={() => setCanvasHeight(h)}
              >
                {h}px
              </button>
            ))}
          </div>
        </div>

        {/* View Mode (Direct vs Dialog Modal) */}
        <div className={styles.toolbarGroup}>
          <button
            type="button"
            className={[
              styles.actionBtn,
              viewMode === 'direct' ? styles.primaryAction : '',
            ].filter(Boolean).join(' ')}
            onClick={() => setViewMode('direct')}
          >
            <Icon name="wireframe" size={14} />
            Direct Canvas
          </button>
          <button
            type="button"
            className={[
              styles.actionBtn,
              viewMode === 'dialog' ? styles.primaryAction : '',
            ].filter(Boolean).join(' ')}
            onClick={() => {
              setViewMode('dialog');
              setIsDialogOpen(true);
            }}
          >
            <Icon name="windowPage" size={14} />
            Modal Dialog
          </button>
        </div>

        {/* Theme Mode Toggle */}
        <div className={styles.toolbarGroup}>
          <button
            type="button"
            className={[
              styles.actionBtn,
              themeMode === 'dark' ? styles.primaryAction : '',
            ].filter(Boolean).join(' ')}
            onClick={() => setThemeMode((m) => (m === 'light' ? 'dark' : 'light'))}
            title={`Chuyển sang giao diện ${themeMode === 'light' ? 'Dark' : 'Light'}`}
          >
            <Icon name={themeMode === 'light' ? 'moon' : 'sun'} size={14} />
            {themeMode === 'light' ? 'Dark Mode' : 'Light Mode'}
          </button>
        </div>

        {/* Standalone & Fullscreen Actions */}
        <div className={styles.toolbarGroup}>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={openStandaloneWindow}
            title="Mở tab riêng kèm parameter (?viewport=...&mode=...)"
          >
            <Icon name="externalLink" size={14} />
            Tab riêng (URL)
          </button>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => setIsFullscreen(true)}
            title="Phóng to toàn màn hình"
          >
            <Icon name="maximize" size={14} />
            Phóng to
          </button>
        </div>
      </div>

      {/* ─── Preview Canvas Frame ─── */}
      <div className={styles.canvasArea}>
        <div
          className={styles.deviceBezel}
          style={{
            width: viewportWidth === 'full' ? '100%' : `${viewportWidth}px`,
            maxWidth: '100%',
          }}
        >
          <div className={styles.bezelHeader}>
            <span>
              Viewport: <strong>{viewportWidth === 'full' ? '100% Fit' : `${viewportWidth}px`}</strong> × {canvasHeight}px · Theme: <strong>{themeMode.toUpperCase()}</strong>
            </span>
            <span>{viewMode === 'direct' ? 'SettingsDialogContent' : 'SettingsDialog (Modal)'}</span>
          </div>
          <div className={styles.bezelContent} style={{ height: `${canvasHeight}px` }}>
            <ViewportFrame width={viewportWidth} height={canvasHeight} theme={themeMode}>
              {renderContent()}
            </ViewportFrame>
          </div>
        </div>
      </div>

      {/* ─── Fullscreen Modal Overlay (Phóng to) ─── */}
      {isFullscreen && (
        <div className={styles.fullscreenModal}>
          <div className={styles.fullscreenHeader}>
            <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
              Settings Showcase — Fullscreen Mode ({viewportWidth === 'full' ? '100%' : `${viewportWidth}px`} × 100vh · {themeMode.toUpperCase()})
            </span>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => setThemeMode((m) => (m === 'light' ? 'dark' : 'light'))}
              >
                <Icon name={themeMode === 'light' ? 'moon' : 'sun'} size={14} />
                {themeMode === 'light' ? 'Dark' : 'Light'}
              </button>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => setIsFullscreen(false)}
              >
                <Icon name="minimize" size={14} />
                Thu nhỏ (Esc)
              </button>
            </div>
          </div>
          <div className={styles.fullscreenBody}>
            <ViewportFrame width={viewportWidth} theme={themeMode}>
              {renderContent()}
            </ViewportFrame>
          </div>
        </div>
      )}
    </div>
  );
}

export const showcaseMeta = {
  title: 'Settings Dialog Page',
  description: 'Full settings dialog with 12 sections: Download (quality, format, concurrency, conversion), Subtitle (languages, overlay, auto-load, auto-translate), Theme (mode, colors, contrast, backup), TTS (voice selection, tester), Dictionary Resources (import, delete), Card Creator, Dictionary Popup, Nav Cluster, Shortcuts. Hỗ trợ điều chỉnh kích thước responsive từ 320px đến màn hình lớn, phóng to toàn màn hình và mở standalone URL.',
  level: 'pages' as const,
  category: 'Settings',
  order: 50,
};
