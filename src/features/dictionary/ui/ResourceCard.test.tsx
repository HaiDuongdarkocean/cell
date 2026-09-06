import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ResourceCard } from '@/features/dictionary/ui/ResourceCard';
import type { ResourceInfo } from '@/entities/dictionary';

jest.mock('@/features/dictionary/repositories', () => ({
  setResourceEnabled: jest.fn().mockResolvedValue(undefined),
  setResourceProfiles: jest.fn().mockResolvedValue(undefined),
  reorderResources: jest.fn().mockResolvedValue(undefined),
  sampleDictionaryEntries: jest.fn().mockResolvedValue([]),
  findDictionaryEntry: jest.fn().mockResolvedValue(undefined),
  sampleFrequencyEntries: jest.fn().mockResolvedValue([]),
  findFrequencyEntry: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/shared/lib/storage/settingsStore', () => ({
  loadSettings: jest.fn().mockResolvedValue({ languageProfiles: [] }),
  saveSettings: jest.fn().mockResolvedValue(undefined),
}));

import { setResourceEnabled, sampleFrequencyEntries } from '@/features/dictionary/repositories';

const setResourceEnabledMock = setResourceEnabled as jest.MockedFunction<typeof setResourceEnabled>;
const sampleFrequencyEntriesMock = sampleFrequencyEntries as jest.MockedFunction<typeof sampleFrequencyEntries>;

function makeResource(overrides: Partial<ResourceInfo> = {}): ResourceInfo {
  return {
    id: 1,
    name: 'test.txt',
    langCode: 'en',
    type: 'FREQUENCY',
    format: 'txt',
    signature: 'sig',
    wordCount: 100,
    installationFinished: true,
    importedAt: Date.now(),
    ...overrides,
  };
}

function renderCard(resource: ResourceInfo, extra: Partial<Parameters<typeof ResourceCard>[0]> = {}) {
  return render(
    <ResourceCard
      resource={resource}
      index={0}
      sectionSize={1}
      onDelete={jest.fn()}
      {...extra}
    />,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ResourceCard', () => {
  it('renders name + meta "{wordCount} từ · format · relative time"', () => {
    renderCard(makeResource({ name: 'words.txt', wordCount: 42, format: 'txt' }));
    expect(screen.getByText('words.txt')).toBeInTheDocument();
    expect(screen.getByText(/42 từ · txt · hôm nay/)).toBeInTheDocument();
  });

  it('shows "đang thêm" when installationFinished is false', () => {
    renderCard(makeResource({ installationFinished: false }));
    expect(screen.getByText(/đang thêm/)).toBeInTheDocument();
  });

  it('calls onDelete when the icon-only delete button is clicked', () => {
    const onDelete = jest.fn();
    renderCard(makeResource({ name: 'words.txt' }), { onDelete });
    fireEvent.click(screen.getByTestId('delete-button-1'));
    expect(onDelete).toHaveBeenCalled();
  });

  it('has accessible aria-label for delete button', () => {
    renderCard(makeResource({ name: 'words.txt' }));
    expect(screen.getByLabelText('Xóa words.txt')).toBeInTheDocument();
  });

  it('toggle calls setResourceEnabled then onChanged', async () => {
    const onChanged = jest.fn();
    renderCard(makeResource({ id: 7 }), { onChanged });
    fireEvent.click(screen.getByTestId('enable-toggle-7'));
    await waitFor(() => expect(setResourceEnabledMock).toHaveBeenCalledWith('en', 7, false));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('re-enables a disabled resource (enabled === false)', async () => {
    renderCard(makeResource({ id: 8, enabled: false }));
    fireEvent.click(screen.getByTestId('enable-toggle-8'));
    await waitFor(() => expect(setResourceEnabledMock).toHaveBeenCalledWith('en', 8, true));
  });

  it('dims the card when disabled (visual only)', () => {
    renderCard(makeResource({ id: 9, enabled: false }));
    expect(screen.getByTestId('resource-card-9').className).toContain('cardDisabled');
  });

  it('shows reorder buttons + priority hint when section has >1 resource', () => {
    const onMove = jest.fn();
    renderCard(makeResource({ id: 2 }), { index: 0, sectionSize: 2, onMove });
    expect(screen.getByText('Ưu tiên 1')).toBeInTheDocument();
    const up = screen.getByTestId('move-up-2');
    const down = screen.getByTestId('move-down-2');
    expect(up).toBeDisabled(); // first item can't go up
    fireEvent.click(down);
    expect(onMove).toHaveBeenCalledWith(1);
  });

  it('hides reorder controls for a single-resource section', () => {
    renderCard(makeResource({ id: 3 }), { sectionSize: 1, onMove: jest.fn() });
    expect(screen.queryByTestId('move-up-3')).not.toBeInTheDocument();
    expect(screen.queryByTestId('move-down-3')).not.toBeInTheDocument();
  });

  it('lazy-loads sample entries only when expanded', async () => {
    renderCard(makeResource({ id: 4 }));
    expect(sampleFrequencyEntriesMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('expand-4'));
    await waitFor(() => expect(sampleFrequencyEntriesMock).toHaveBeenCalledWith('en', 4, 10));
  });
});
