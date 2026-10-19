import { render, fireEvent } from '@testing-library/react';
import { UniversalPanelHeader } from './UniversalPanelHeader';
import { DEFAULT_SETTINGS } from '@/shared/config/config';
import type { LanguageProfile } from '@/entities/settings';

const tokenizeState = {
  enabled: false,
  showStatus: false,
  showFrequency: false,
  subtitleEnabled: false,
};

function mockProfile(overrides: Partial<LanguageProfile> = {}): LanguageProfile {
  return {
    id: 'p1',
    target: 'en',
    native: 'vi',
    name: 'Tiếng Việt → English',
    order: 1,
    subtitleOverlayTargetStyle: DEFAULT_SETTINGS.subtitleOverlayTargetStyle!,
    subtitleOverlayNativeStyle: DEFAULT_SETTINGS.subtitleOverlayNativeStyle!,
    subtitleOverlayAutoLoad: true,
    subtitleOverlayAutoLoadAsr: false,
    subtitleOverlayAutoTranslate: false,
    dictionaryPopup: DEFAULT_SETTINGS.dictionaryPopup!,
    readingDisplay: 'off',
    glossDisplay: 'off',
    ...overrides,
  };
}

function renderHeader(props: Partial<Parameters<typeof UniversalPanelHeader>[0]> = {}) {
  return render(
    <UniversalPanelHeader
      tokenizeState={tokenizeState}
      onToggleTokenize={() => {}}
      onClose={() => {}}
      languageProfiles={[mockProfile()]}
      universalNativeLanguage="vi"
      activeProfileId="p1"
      onProfileChange={() => {}}
      {...props}
    />,
  );
}

describe('UniversalPanelHeader profile badge', () => {
  it('shows a "?" badge (not a flag) when no profile is active', () => {
    const { container } = renderHeader({ activeProfileId: null, languageProfiles: [] });
    const btn = container.querySelector('[data-tihoka-id="universal-panel-profile-button"]');
    expect(btn).not.toBeNull();
    expect(btn!.textContent).toContain('?');
    expect(btn!.querySelector('[class*="flag"]')).toBeNull();
  });

  it('keeps the button visible with zero profiles so setup stays reachable', () => {
    const { container } = renderHeader({ languageProfiles: [], activeProfileId: null });
    expect(container.querySelector('[data-tihoka-id="universal-panel-profile-button"]')).not.toBeNull();
  });

  it('quick menu renders the shared profile cards + a settings gear', () => {
    const { container } = renderHeader();
    fireEvent.click(container.querySelector('[data-tihoka-id="universal-panel-profile-button"]')!);
    const menu = document.body.querySelector('[data-tihoka-id="universal-panel-profile-menu"]');
    expect(menu).not.toBeNull();
    expect(menu!.querySelector('[role="radiogroup"]')).not.toBeNull();
    expect(menu!.querySelector('[data-tihoka-id="universal-panel-profile-option-p1"]')).not.toBeNull();
    expect(menu!.querySelector('[data-tihoka-id="universal-panel-profile-settings"]')).not.toBeNull();
  });
});
