import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageProfilePanel } from './LanguageProfilePanel';

// jsdom lacks matchMedia — the panel's FLIP animation effect queries it.
beforeAll(() => {
  window.matchMedia = window.matchMedia ?? ((q: string) => ({
    matches: false, media: q, addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, onchange: null,
    dispatchEvent: () => false,
  }) as MediaQueryList);
});
import { DEFAULT_SETTINGS } from '@/shared/config/config';
import type { LanguageProfile, Settings } from '@/entities/settings';

function makeProfile(id: string, target: string, order: number): LanguageProfile {
  return {
    id,
    target,
    native: '',
    name: `Profile ${id}`,
    order,
    subtitleOverlayTargetStyle: DEFAULT_SETTINGS.subtitleOverlayTargetStyle!,
    subtitleOverlayNativeStyle: DEFAULT_SETTINGS.subtitleOverlayNativeStyle!,
    subtitleOverlayAutoLoad: true,
    subtitleOverlayAutoLoadAsr: false,
    subtitleOverlayAutoTranslate: false,
    showReadings: false,
    showWordTranslations: false,
    dictionaryPopup: DEFAULT_SETTINGS.dictionaryPopup!,
  };
}

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    ...DEFAULT_SETTINGS,
    languageProfiles: [makeProfile('p1', 'en', 1), makeProfile('p2', 'ja', 2)],
    activeProfileId: 'p1',
    ...overrides,
  } as Settings;
}

describe('LanguageProfilePanel — delete cleanup', () => {
  it('clears SRS active pointers when deleting the profile they reference', () => {
    const onChange = jest.fn();
    const settings = makeSettings({
      srs: {
        ...DEFAULT_SETTINGS.srs,
        activeLanguageProfileId: 'p1',
        activeCollectionId: 'col-1',
        activeDeckId: 'deck-1',
        activeNotetypeId: 'nt-1',
        defaultStudyConfigId: 'sc-1',
      },
    });
    render(<LanguageProfilePanel settings={settings} onChange={onChange} />);

    // Open the ⋮ menu on the first card and choose Delete.
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Profile p1' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    fireEvent.click(screen.getByTestId('profile-delete-confirm'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        languageProfiles: [expect.objectContaining({ id: 'p2' })],
        activeProfileId: 'p2',
        srs: expect.objectContaining({
          activeLanguageProfileId: 'p2',
          activeCollectionId: null,
          activeDeckId: null,
          activeNotetypeId: null,
          defaultStudyConfigId: null,
        }),
      }),
    );
  });

  it('leaves the SRS slice untouched when deleting a non-SRS profile', () => {
    const onChange = jest.fn();
    const settings = makeSettings({
      activeProfileId: 'p1',
      srs: { ...DEFAULT_SETTINGS.srs, activeLanguageProfileId: 'p2', activeCollectionId: 'col-2' },
    });
    render(<LanguageProfilePanel settings={settings} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Actions for Profile p1' })); // p1 — active but not the SRS pointer
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    fireEvent.click(screen.getByTestId('profile-delete-confirm'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        srs: expect.objectContaining({
          activeLanguageProfileId: 'p2',
          activeCollectionId: 'col-2',
        }),
      }),
    );
  });
});
