import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
import { checkProfileData, wipeProfileData } from '../services/profileDataClient';

jest.mock('../services/profileDataClient', () => ({
  checkProfileData: jest.fn().mockResolvedValue({ vocab: 0, resources: 0, srs: false }),
  wipeProfileData: jest.fn().mockResolvedValue(undefined),
}));

const mockCheck = checkProfileData as jest.MockedFunction<typeof checkProfileData>;
const mockWipe = wipeProfileData as jest.MockedFunction<typeof wipeProfileData>;

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
    readingDisplay: 'off',
    glossDisplay: 'off',
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

describe('LanguageProfilePanel — retarget', () => {
  beforeEach(() => {
    mockCheck.mockReset().mockResolvedValue({ vocab: 0, resources: 0, srs: false });
    mockWipe.mockReset().mockResolvedValue(undefined);
  });

  const openEditForm = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Profile p1' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
  };

  const pickTarget = (value: string) => {
    fireEvent.click(screen.getByRole('button', { name: 'Select target language' }));
    fireEvent.click(screen.getByTestId(`profile-target-language-option-${value}`));
  };

  it('retargets on save when the profile has no data (no warning)', async () => {
    const onChange = jest.fn();
    render(<LanguageProfilePanel settings={makeSettings()} onChange={onChange} />);

    openEditForm();
    pickTarget('aa');
    await screen.findByRole('button', { name: 'Save' });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockWipe).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        languageProfiles: expect.arrayContaining([
          expect.objectContaining({ id: 'profile-aa', target: 'aa' }),
        ]),
        activeProfileId: 'profile-aa',
      }),
    );
  });

  it('warns, then wipes and retargets on confirm when data exists', async () => {
    mockCheck.mockResolvedValue({ vocab: 3, resources: 1, srs: true });
    const onChange = jest.fn();
    const settings = makeSettings({
      srs: { ...DEFAULT_SETTINGS.srs, activeLanguageProfileId: 'p1', activeCollectionId: 'col-1' },
    });
    render(<LanguageProfilePanel settings={settings} onChange={onChange} />);

    openEditForm();
    pickTarget('aa');
    const confirm = await screen.findByTestId('profile-retarget-confirm');
    fireEvent.click(confirm);
    await waitFor(() => expect(mockWipe).toHaveBeenCalled());

    expect(mockWipe).toHaveBeenCalledWith('en', 'p1');
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        languageProfiles: expect.arrayContaining([
          expect.objectContaining({ id: 'profile-aa', target: 'aa' }),
        ]),
        srs: expect.objectContaining({
          activeLanguageProfileId: 'profile-aa',
          activeCollectionId: null,
        }),
      }),
    );
  });

  it('blocks the pick when a profile for that target already exists', async () => {
    const onChange = jest.fn();
    const settings = makeSettings({
      languageProfiles: [makeProfile('p1', 'en', 1), makeProfile('profile-ja', 'ja', 2)],
    });
    render(<LanguageProfilePanel settings={settings} onChange={onChange} />);

    openEditForm();
    pickTarget('ja'); // profile-ja owns ja
    await screen.findByTestId('profile-retarget-notice');

    expect(mockCheck).not.toHaveBeenCalled();
    expect(mockWipe).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });
});
