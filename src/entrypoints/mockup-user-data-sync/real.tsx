import { useState, type ReactElement } from 'react';
import type { Settings } from '@/entities/settings';
import { SettingsDialogContent } from '@/features/settings/ui/SettingsDialogContent';
import { installMockChrome } from '../design-system-showcase/mockChrome';
import { getMockSettings } from '../design-system-showcase/showcaseFixtures';

installMockChrome();

export function RealBaseline(): ReactElement {
  const [settings, setSettings] = useState<Settings>(() => getMockSettings());
  return (
    <div className="ms-real">
      <SettingsDialogContent settings={settings} onChange={setSettings} />
    </div>
  );
}
