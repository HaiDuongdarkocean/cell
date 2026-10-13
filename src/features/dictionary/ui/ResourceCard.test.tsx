import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ResourceCard } from '@/features/dictionary/ui/ResourceCard';
import { pushEscapeLayer } from '@/shared/ui/escapeLayerStack';
import type { ResourceInfo } from '@/entities/dictionary';

jest.mock('@/features/dictionary/services/resourceClient', () => ({
  setResourceEnabled: jest.fn().mockResolvedValue(undefined),
  setResourceProfiles: jest.fn().mockResolvedValue(undefined),
  setResourceComponents: jest.fn().mockResolvedValue(undefined),
  getResourceComponents: jest.fn().mockResolvedValue([]),
  renameResource: jest.fn().mockResolvedValue(undefined),
  reorderResources: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/shared/lib/storage/settingsStore', () => ({
  loadSettings: jest.fn().mockResolvedValue({ languageProfiles: [] }),
  saveSettings: jest.fn().mockResolvedValue(undefined),
}));

import {
  getResourceComponents,
  renameResource,
  setResourceComponents,
  setResourceEnabled,
} from '@/features/dictionary/services/resourceClient';

const setResourceEnabledMock = setResourceEnabled as jest.MockedFunction<typeof setResourceEnabled>;
const getResourceComponentsMock = getResourceComponents as jest.MockedFunction<typeof getResourceComponents>;
const setResourceComponentsMock = setResourceComponents as jest.MockedFunction<typeof setResourceComponents>;
const renameResourceMock = renameResource as jest.MockedFunction<typeof renameResource>;

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

function openDetail(id: number): void {
  fireEvent.click(screen.getByTestId(`menu-trigger-${id}`));
  fireEvent.click(screen.getByTestId(`menu-detail-${id}`));
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ResourceCard', () => {
  it('renders the filename stem without the word-count meta', () => {
    renderCard(makeResource({ name: 'words.txt', wordCount: 42, format: 'txt' }));
    expect(screen.getByText('words')).toBeInTheDocument();
    expect(screen.queryByText('words.txt')).not.toBeInTheDocument();
    expect(screen.queryByText('42 words')).not.toBeInTheDocument();
    expect(screen.queryByText(/txt ·|hôm nay/)).not.toBeInTheDocument();
  });

  it('strips compound extensions like .db.gz and .normalized.json', () => {
    renderCard(makeResource({ name: 'JMdict.normalized.json' }));
    expect(screen.getByText('JMdict')).toBeInTheDocument();
  });

  it('the ⋮ button opens the options menu in every state', () => {
    renderCard(makeResource({ id: 2 }), { sectionSize: 2, onGripPointerDown: jest.fn() });
    fireEvent.click(screen.getByTestId('menu-trigger-2'));
    expect(screen.getByTestId('menu-detail-2')).toBeInTheDocument();
    expect(screen.getByTestId('menu-rename-2')).toBeInTheDocument();
    expect(screen.getByTestId('menu-delete-2')).toBeInTheDocument();
  });

  it('the ⋮ button renders while the resource is still importing', () => {
    renderCard(makeResource({ id: 2, installationFinished: false }), {
      importProgress: { phase: 'import', done: 5, total: 10 },
    });
    fireEvent.click(screen.getByTestId('menu-trigger-2'));
    expect(screen.getByTestId('menu-detail-2')).toBeInTheDocument();
    expect(screen.getByTestId('menu-rename-2')).toBeDisabled();
    expect(screen.getByTestId('menu-delete-2')).toBeDisabled();
  });

  it('tapping the grip does not open the menu', () => {
    renderCard(makeResource({ id: 2 }), { sectionSize: 2, onGripPointerDown: jest.fn() });
    const grip = screen.getByTestId('drag-2');
    fireEvent(grip, new MouseEvent('pointerdown', { bubbles: true, clientY: 10 }));
    fireEvent(grip, new MouseEvent('pointerup', { bubbles: true, clientY: 10 }));
    expect(screen.queryByTestId('menu-detail-2')).not.toBeInTheDocument();
  });

  it('menu "Details" opens the detail dialog with the resource info', () => {
    renderCard(makeResource({ id: 2, name: 'words.txt', wordCount: 42, format: 'txt' }), {
      sectionSize: 2,
      onGripPointerDown: jest.fn(),
    });
    openDetail(2);
    const dialog = screen.getByTestId('resource-detail-2');
    expect(dialog).toHaveTextContent('words.txt');
    expect(dialog).toHaveTextContent('txt');
    expect(dialog).toHaveTextContent('42');
  });

  it('menu "Rename" starts inline rename', () => {
    renderCard(makeResource({ id: 2, name: 'words.txt' }));
    fireEvent.click(screen.getByTestId('menu-trigger-2'));
    fireEvent.click(screen.getByTestId('menu-rename-2'));
    expect(screen.getByTestId('rename-input-2')).toBeInTheDocument();
  });

  it('menu "Delete" calls onDelete', () => {
    const onDelete = jest.fn();
    renderCard(makeResource({ id: 2, name: 'words.txt' }), { onDelete });
    fireEvent.click(screen.getByTestId('menu-trigger-2'));
    fireEvent.click(screen.getByTestId('menu-delete-2'));
    expect(onDelete).toHaveBeenCalled();
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

  it('edit mode selects via the name button', () => {
    const onSelect = jest.fn();
    renderCard(makeResource({ id: 4 }), { editing: true, onSelect });
    fireEvent.click(screen.getByTestId('select-4'));
    expect(onSelect).toHaveBeenCalled();
  });

  it('clicking the name opens the inline rename input', () => {
    renderCard(makeResource({ id: 4, name: 'words.txt' }));
    fireEvent.click(screen.getByTestId('name-4'));
    const input = screen.getByTestId('rename-input-4');
    expect(input).toHaveValue('words');
  });

  it('commits the rename on Enter', async () => {
    const onChanged = jest.fn();
    renderCard(makeResource({ id: 4, name: 'words.txt' }), { onChanged });
    fireEvent.click(screen.getByTestId('name-4'));
    const input = screen.getByTestId('rename-input-4');
    fireEvent.change(input, { target: { value: 'My dictionary' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(renameResourceMock).toHaveBeenCalledWith('en', 4, 'My dictionary'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('Escape cancels the rename without persisting or popping the panel layer', () => {
    const panelLayer = jest.fn();
    const unregisterPanelLayer = pushEscapeLayer(panelLayer);
    renderCard(makeResource({ id: 4, name: 'words.txt' }));
    fireEvent.click(screen.getByTestId('name-4'));
    const input = screen.getByTestId('rename-input-4');
    fireEvent.change(input, { target: { value: 'something else' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(renameResourceMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('name-4')).toBeInTheDocument();
    expect(panelLayer).not.toHaveBeenCalled();
    unregisterPanelLayer();
  });

  it('ignores an unchanged or empty rename', () => {
    renderCard(makeResource({ id: 4, name: 'words.txt' }));
    fireEvent.click(screen.getByTestId('name-4'));
    const input = screen.getByTestId('rename-input-4');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(renameResourceMock).not.toHaveBeenCalled();
  });

  it('renders component chips inside the detail dialog', async () => {
    renderCard(makeResource({
      id: 5,
      type: 'DICTIONARY',
      components: ['definitions', 'examples'],
    }), { sectionSize: 2, onGripPointerDown: jest.fn() });
    openDetail(5);
    expect(screen.getByTestId('resource-components-5')).toBeInTheDocument();
    expect(screen.getByTestId('component-definitions-5')).toBeInTheDocument();
    expect(screen.getByTestId('component-examples-5')).toBeInTheDocument();
  });

  it('toggles a component chip via setResourceComponents', async () => {
    const onChanged = jest.fn();
    renderCard(makeResource({
      id: 5,
      type: 'DICTIONARY',
      components: ['definitions', 'examples'],
      disabledComponents: ['examples'],
    }), { sectionSize: 2, onGripPointerDown: jest.fn(), onChanged });
    openDetail(5);
    const chip = screen.getByTestId('component-examples-5');
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(chip);
    await waitFor(() => expect(setResourceComponentsMock).toHaveBeenCalledWith('en', 5, []));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('lazily loads components for pre-existing dictionary imports', async () => {
    getResourceComponentsMock.mockResolvedValue(['definitions']);
    renderCard(makeResource({ id: 6, type: 'DICTIONARY' }), { sectionSize: 2, onGripPointerDown: jest.fn() });
    await waitFor(() => expect(getResourceComponentsMock).toHaveBeenCalledWith('en', 6));
    openDetail(6);
    await waitFor(() => expect(screen.getByTestId('component-definitions-6')).toBeInTheDocument());
  });

  it('loads components for frequency resources too', async () => {
    getResourceComponentsMock.mockResolvedValue(['frequency']);
    renderCard(makeResource({ id: 6 }), { sectionSize: 2, onGripPointerDown: jest.fn() });
    await waitFor(() => expect(getResourceComponentsMock).toHaveBeenCalledWith('en', 6));
    openDetail(6);
    await waitFor(() => expect(screen.getByTestId('component-frequency-6')).toBeInTheDocument());
  });
});
