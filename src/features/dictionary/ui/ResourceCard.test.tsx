import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ResourceCard } from '@/features/dictionary/ui/ResourceCard';
import type { ResourceInfo } from '@/entities/dictionary';

jest.mock('@/features/dictionary/services/resourceClient', () => ({
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

import { setResourceEnabled, sampleFrequencyEntries } from '@/features/dictionary/services/resourceClient';

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
  it('renders the filename stem + "{wordCount} từ" meta only', () => {
    renderCard(makeResource({ name: 'words.txt', wordCount: 42, format: 'txt' }));
    expect(screen.getByText('words')).toBeInTheDocument();
    expect(screen.queryByText('words.txt')).not.toBeInTheDocument();
    expect(screen.getByText('42 words')).toBeInTheDocument();
    expect(screen.queryByText(/txt ·|hôm nay/)).not.toBeInTheDocument();
  });

  it('strips compound extensions like .db.gz and .normalized.json', () => {
    renderCard(makeResource({ name: 'JMdict.normalized.json' }));
    expect(screen.getByText('JMdict')).toBeInTheDocument();
  });

  it('shows "importing" when installationFinished is false', () => {
    renderCard(makeResource({ installationFinished: false }));
    expect(screen.getByText(/importing/)).toBeInTheDocument();
  });

  it('hides the delete button outside edit mode', () => {
    renderCard(makeResource({ id: 1 }));
    expect(screen.queryByTestId('delete-button-1')).not.toBeInTheDocument();
  });

  it('calls onDelete from the delete button inside edit mode', () => {
    const onDelete = jest.fn();
    renderCard(makeResource({ id: 1, name: 'words.txt' }), { editing: true, onDelete });
    const button = screen.getByTestId('delete-button-1');
    expect(screen.getByLabelText('Delete words')).toBe(button);
    fireEvent.click(button);
    expect(onDelete).toHaveBeenCalled();
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

  it('shows drag handle when section has >1 resource outside edit mode', () => {
    renderCard(makeResource({ id: 2 }), { sectionSize: 2, onGripPointerDown: jest.fn(), onMove: jest.fn() });
    expect(screen.getByTestId('drag-2')).toBeInTheDocument();
    expect(screen.queryByText(/Ưu tiên/)).not.toBeInTheDocument();
  });

  it('hides the grip inside edit mode (selection replaces reordering)', () => {
    renderCard(makeResource({ id: 2 }), { sectionSize: 2, editing: true, onGripPointerDown: jest.fn() });
    expect(screen.queryByTestId('drag-2')).not.toBeInTheDocument();
  });

  it('hides the drag handle for a single-resource section', () => {
    renderCard(makeResource({ id: 3 }), { sectionSize: 1, onGripPointerDown: jest.fn(), onMove: jest.fn() });
    expect(screen.queryByTestId('drag-3')).not.toBeInTheDocument();
  });

  it('grip pointerdown delegates to onGripPointerDown (section drag session)', () => {
    const onGripPointerDown = jest.fn();
    renderCard(makeResource({ id: 2 }), { sectionSize: 2, onGripPointerDown });
    fireEvent(screen.getByTestId('drag-2'), new MouseEvent('pointerdown', { bubbles: true, clientY: 10 }));
    expect(onGripPointerDown).toHaveBeenCalled();
  });

  it('keyboard reorder: ArrowUp/ArrowDown on the grip call onMove', () => {
    const onMove = jest.fn();
    renderCard(makeResource({ id: 2 }), { sectionSize: 2, onGripPointerDown: jest.fn(), onMove });
    const grip = screen.getByTestId('drag-2');
    fireEvent.keyDown(grip, { key: 'ArrowDown' });
    expect(onMove).toHaveBeenCalledWith(1);
    fireEvent.keyDown(grip, { key: 'ArrowUp' });
    expect(onMove).toHaveBeenCalledWith(-1);
  });

  it('edit mode selects via the name button and does not expand', async () => {
    const onSelect = jest.fn();
    renderCard(makeResource({ id: 4 }), { editing: true, onSelect });
    fireEvent.click(screen.getByTestId('select-4'));
    expect(onSelect).toHaveBeenCalled();
    await waitFor(() => expect(sampleFrequencyEntriesMock).not.toHaveBeenCalled());
  });

  it('lazy-loads sample entries only when expanded', async () => {
    renderCard(makeResource({ id: 4 }));
    expect(sampleFrequencyEntriesMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('expand-4'));
    await waitFor(() => expect(sampleFrequencyEntriesMock).toHaveBeenCalledWith('en', 4, 10));
  });
});
