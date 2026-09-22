import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ResourcesPanel } from '@/features/dictionary/ui/ResourcesPanel';
import * as client from '@/features/dictionary/services/resourceClient';
import type { ResourceInfo, ImportResult } from '@/entities/dictionary';

// Mock the resource client — all data ops are proxied to the background
// because IndexedDB is origin-isolated (in-page panel can't reach the
// extension's IDB directly).
jest.mock('@/features/dictionary/services/resourceClient', () => ({
  listResources: jest.fn(),
  importResourceFile: jest.fn(),
  deleteResource: jest.fn(),
  reorderResources: jest.fn().mockResolvedValue(undefined),
  setResourceEnabled: jest.fn().mockResolvedValue(undefined),
  setResourceProfiles: jest.fn().mockResolvedValue(undefined),
  sampleDictionaryEntries: jest.fn().mockResolvedValue([]),
  findDictionaryEntry: jest.fn().mockResolvedValue(undefined),
  sampleFrequencyEntries: jest.fn().mockResolvedValue([]),
  findFrequencyEntry: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/dictionary/logic/signatureGenerator', () => ({
  computeSignature: jest.fn().mockImplementation(async (file: File) => `sig-${file.name}`),
}));

jest.mock('@/shared/lib/storage/settingsStore', () => ({
  loadSettings: jest.fn().mockResolvedValue({ languageProfiles: [] }),
  saveSettings: jest.fn().mockResolvedValue(undefined),
}));

import { reorderResources } from '@/features/dictionary/services/resourceClient';

const listResources = client.listResources as jest.MockedFunction<typeof client.listResources>;
const importFile = client.importResourceFile as jest.MockedFunction<typeof client.importResourceFile>;
const deleteResourceCascade = client.deleteResource as jest.MockedFunction<typeof client.deleteResource>;
const reorderResourcesMock = reorderResources as jest.MockedFunction<typeof reorderResources>;

function makeResource(overrides: Partial<ResourceInfo> = {}): ResourceInfo {
  return {
    id: 1,
    name: 'words.txt',
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

function pickFiles(inputIndex: number, files: File[]): void {
  const inputs = screen.getAllByTestId('dropzone-input');
  fireEvent.change(inputs[inputIndex] as HTMLInputElement, { target: { files } });
}

function pickFile(inputIndex: number, file: File): void {
  pickFiles(inputIndex, [file]);
}

beforeEach(() => {
  jest.clearAllMocks();
  listResources.mockResolvedValue([]);
  importFile.mockResolvedValue({ resourceId: 1, wordCount: 2, format: 'txt' });
  deleteResourceCascade.mockResolvedValue(undefined);
});

describe('ResourcesPanel', () => {
  it('renders dictionary + frequency sections with subtitles', async () => {
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Dictionaries')).toBeInTheDocument());
    expect(screen.getByText('Frequency lists')).toBeInTheDocument();
    expect(screen.getByText('Meanings, transcriptions, audio.')).toBeInTheDocument();
    expect(screen.getByText('Highlights common words.')).toBeInTheDocument();
  });

  it('shows empty state when no resources', async () => {
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('No dictionaries yet.')).toBeInTheDocument());
    expect(screen.getByText('No lists yet.')).toBeInTheDocument();
  });

  it('lists dictionary + frequency resources separately', async () => {
    listResources.mockResolvedValue([
      makeResource({ id: 1, name: 'dict.json', type: 'DICTIONARY', format: 'json-entries' }),
      makeResource({ id: 2, name: 'freq.txt', type: 'FREQUENCY', format: 'txt' }),
    ]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('dict')).toBeInTheDocument());
    expect(screen.getByText('freq')).toBeInTheDocument();
  });

  it('imports file via dropzone (frequency)', async () => {
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Frequency lists')).toBeInTheDocument());
    pickFile(1, new File(['hello\nworld\n'], 'test.txt', { type: 'text/plain' }));
    await waitFor(() =>
      expect(importFile).toHaveBeenCalledWith(
        expect.anything(),
        'FREQUENCY',
        expect.objectContaining({ langCode: 'en', onDuplicate: expect.any(Function), jobId: expect.any(String) }),
      ),
    );
  });

  it('dropping N files creates N independent job rows', async () => {
    importFile.mockImplementation(() => new Promise<ImportResult>(() => {}));
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Frequency lists')).toBeInTheDocument());
    pickFiles(1, [
      new File(['a\n'], 'one.txt', { type: 'text/plain' }),
      new File(['b\n'], 'two.txt', { type: 'text/plain' }),
      new File(['c\n'], 'three.txt', { type: 'text/plain' }),
    ]);
    await waitFor(() => {
      expect(screen.getByText('one.txt')).toBeInTheDocument();
      expect(screen.getByText('two.txt')).toBeInTheDocument();
      expect(screen.getByText('three.txt')).toBeInTheDocument();
    });
  });

  it('runs at most MAX_CONCURRENT_IMPORTS jobs at once, rest stay queued', async () => {
    const started: string[] = [];
    importFile.mockImplementation((file) => {
      started.push((file as File).name);
      return new Promise<ImportResult>(() => {});
    });
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Frequency lists')).toBeInTheDocument());
    pickFiles(1, [
      new File(['a\n'], 'one.txt', { type: 'text/plain' }),
      new File(['b\n'], 'two.txt', { type: 'text/plain' }),
      new File(['c\n'], 'three.txt', { type: 'text/plain' }),
    ]);
    await waitFor(() => expect(started).toHaveLength(2));
    expect(screen.getByText('Waiting')).toBeInTheDocument();
  });

  it('shows per-job success with the file word count', async () => {
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Frequency lists')).toBeInTheDocument());
    pickFile(1, new File(['hello\nworld\n'], 'test.txt', { type: 'text/plain' }));
    await waitFor(() => expect(screen.getByText('Added 2 words')).toBeInTheDocument());
  });

  it('shows the error on the failing job row only', async () => {
    let call = 0;
    importFile.mockImplementation(() => {
      call += 1;
      return call === 1
        ? Promise.reject(new Error('parse fail'))
        : Promise.resolve({ resourceId: 2, wordCount: 5, format: 'txt' });
    });
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Frequency lists')).toBeInTheDocument());
    pickFiles(1, [
      new File(['bad'], 'bad.txt', { type: 'text/plain' }),
      new File(['ok'], 'good.txt', { type: 'text/plain' }),
    ]);
    await waitFor(() => expect(screen.getByText(/parse fail/)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Added 5 words')).toBeInTheDocument());
  });

  it('import progress shows exact entry totals via onProgress', async () => {
    importFile.mockImplementation(async (_f, _t, options) => {
      const opts = options as { onProgress?: (p: number, t: number) => void };
      opts.onProgress?.(5000, 73643);
      return { resourceId: 1, wordCount: 73643, format: 'txt' };
    });
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Frequency lists')).toBeInTheDocument());
    pickFile(1, new File(['a\n'], 'big.txt', { type: 'text/plain' }));
    await waitFor(() => expect(screen.getByText(/5,000 \/ 73,643 items|Added/)).toBeInTheDocument());
  });

  it('allows concurrent dictionary + frequency import (independent dropzones)', async () => {
    let resolveDict: (v: ImportResult) => void = () => {};
    const dictPromise = new Promise<ImportResult>((r) => {
      resolveDict = r;
    });
    importFile.mockImplementation((_file, type) => {
      if (type === 'DICTIONARY') return dictPromise;
      return Promise.resolve({ resourceId: 2, wordCount: 5, format: 'txt' });
    });

    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Frequency lists')).toBeInTheDocument());

    pickFile(0, new File(['[]'], 'dict.json', { type: 'application/json' }));
    pickFile(1, new File(['a\nb\n'], 'freq.txt', { type: 'text/plain' }));

    await waitFor(() => expect(screen.getByText('Added 5 words')).toBeInTheDocument());
    resolveDict({ resourceId: 1, wordCount: 3, format: 'json-entries' });
    await waitFor(() => expect(screen.getByText('Added 3 words')).toBeInTheDocument());
  });

  it('prompts on duplicate and resolves onDuplicate when "Skip" clicked', async () => {
    const existing = makeResource({ id: 5, name: 'existing.txt' });
    importFile.mockImplementation(async (_file, _type, options) => {
      const choice = await (options as { onDuplicate?: (e: ResourceInfo) => Promise<'skip' | 'replace'> })
        .onDuplicate?.(existing);
      if (choice === 'replace') return { resourceId: 9, wordCount: 5, format: 'txt' };
      return { resourceId: 0, wordCount: 0, format: 'txt', skippedAsDuplicate: true, existingResource: existing } as ImportResult;
    });

    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Frequency lists')).toBeInTheDocument());
    pickFile(1, new File(['a\nb\n'], 'test.txt', { type: 'text/plain' }));

    await waitFor(() => expect(screen.getByText(/"existing\.txt" already exists/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    await waitFor(() => expect(screen.getByText(/Skipped/)).toBeInTheDocument());
    expect(importFile).toHaveBeenCalledTimes(1);
  });

  it('resolves "Replace" so the import proceeds', async () => {
    const existing = makeResource({ id: 5, name: 'existing.txt' });
    importFile.mockImplementation(async (_file, _type, options) => {
      const choice = await (options as { onDuplicate?: (e: ResourceInfo) => Promise<'skip' | 'replace'> })
        .onDuplicate?.(existing);
      if (choice === 'replace') return { resourceId: 9, wordCount: 5, format: 'txt' };
      return { resourceId: 0, wordCount: 0, format: 'txt', skippedAsDuplicate: true, existingResource: existing } as ImportResult;
    });

    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Frequency lists')).toBeInTheDocument());
    pickFile(1, new File(['a\nb\n'], 'test.txt', { type: 'text/plain' }));

    await waitFor(() => expect(screen.getByText(/"existing\.txt" already exists/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));

    await waitFor(() => expect(screen.getByText('Added 5 words')).toBeInTheDocument());
  });

  it('reorders via the drag handle keyboard fallback', async () => {
    listResources.mockResolvedValue([
      makeResource({ id: 1, name: 'a.txt' }),
      makeResource({ id: 2, name: 'b.txt' }),
    ]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('b')).toBeInTheDocument());

    // No priorities → id-desc order: [b(2), a(1)]. ArrowUp on a.txt's grip → [1, 2].
    fireEvent.keyDown(screen.getByTestId('drag-1'), { key: 'ArrowUp' });
    await waitFor(() =>
      expect(reorderResourcesMock).toHaveBeenCalledWith('en', 'FREQUENCY', [1, 2]),
    );
  });

  it('hides every delete affordance outside edit mode', async () => {
    listResources.mockResolvedValue([makeResource({ id: 1, name: 'words.txt' })]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('words')).toBeInTheDocument());
    expect(screen.queryByTestId('delete-button-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-all-frequency')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-selected-frequency')).not.toBeInTheDocument();
  });

  it('opens delete confirm modal when delete clicked inside edit mode', async () => {
    listResources.mockResolvedValue([makeResource({ id: 1, name: 'words.txt' })]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('words')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('edit-frequency'));
    fireEvent.click(screen.getByTestId('delete-button-1'));
    expect(screen.getByTestId('delete-confirm-modal')).toBeInTheDocument();
    expect(screen.getByText('Delete list?')).toBeInTheDocument();
  });

  it('deletes resource on confirm', async () => {
    listResources.mockResolvedValue([makeResource({ id: 1, name: 'words.txt' })]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('words')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('edit-frequency'));
    fireEvent.click(screen.getByTestId('delete-button-1'));
    fireEvent.click(screen.getByTestId('confirm-delete'));
    await waitFor(() => expect(deleteResourceCascade).toHaveBeenCalledWith('en', 1));
  });

  it('shows every resource regardless of profileIds (profile scoping removed)', async () => {
    listResources.mockResolvedValue([
      makeResource({ id: 1, name: 'global.txt' }),
      makeResource({ id: 2, name: 'mine.txt', profileIds: ['p1'] }),
      makeResource({ id: 3, name: 'other.txt', profileIds: ['p2'] }),
    ]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('mine')).toBeInTheDocument());
    expect(screen.getByText('global')).toBeInTheDocument();
    expect(screen.getByText('other')).toBeInTheDocument();
  });

  it('never scopes imports to a profile', async () => {
    const setProfiles = client.setResourceProfiles as jest.MockedFunction<typeof client.setResourceProfiles>;
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Frequency lists')).toBeInTheDocument());
    pickFile(1, new File(['hello\n'], 'test.txt', { type: 'text/plain' }));
    await waitFor(() => expect(screen.getByText('Added 2 words')).toBeInTheDocument());
    expect(setProfiles).not.toHaveBeenCalled();
  });

  it('edit mode toggles selection and deletes only selected resources', async () => {
    listResources.mockResolvedValue([
      makeResource({ id: 1, name: 'a.txt' }),
      makeResource({ id: 2, name: 'b.txt' }),
      makeResource({ id: 3, name: 'c.txt' }),
    ]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('c')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('edit-frequency'));
    expect(screen.getByTestId('delete-button-1')).toBeInTheDocument();
    expect(screen.queryByTestId('delete-all-frequency')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('select-1'));
    fireEvent.click(screen.getByTestId('select-3'));

    const deleteButton = screen.getByTestId('delete-selected-frequency');
    expect(deleteButton).toHaveTextContent('Delete 2 selected');
    fireEvent.click(deleteButton);
    expect(screen.getByText('Delete 2 selected lists?')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('confirm-delete'));

    await waitFor(() => expect(deleteResourceCascade).toHaveBeenCalledTimes(2));
    expect(deleteResourceCascade).toHaveBeenCalledWith('en', 1);
    expect(deleteResourceCascade).toHaveBeenCalledWith('en', 3);
    expect(deleteResourceCascade).not.toHaveBeenCalledWith('en', 2);
  });

  it('edit mode with no selection deletes everything in the section', async () => {
    listResources.mockResolvedValue([
      makeResource({ id: 1, name: 'a.txt' }),
      makeResource({ id: 2, name: 'b.txt' }),
    ]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('b')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('edit-frequency'));
    const deleteButton = screen.getByTestId('delete-selected-frequency');
    expect(deleteButton).toHaveTextContent('Delete all');
    fireEvent.click(deleteButton);
    expect(screen.getByText('Delete all 2 lists?')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('confirm-delete'));

    await waitFor(() => expect(deleteResourceCascade).toHaveBeenCalledTimes(2));
  });

  it('pressing the edit button again exits edit mode', async () => {
    listResources.mockResolvedValue([makeResource({ id: 1, name: 'a.txt' })]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('a')).toBeInTheDocument());

    const editButton = screen.getByTestId('edit-frequency');
    expect(editButton).toHaveAttribute('aria-label', 'Edit Frequency lists');
    fireEvent.click(editButton);
    expect(editButton).toHaveAttribute('aria-label', 'Finish editing Frequency lists');
    fireEvent.click(editButton);
    expect(screen.queryByTestId('delete-button-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-selected-frequency')).not.toBeInTheDocument();
  });

  it('delete-all cascades every resource of that section only', async () => {
    listResources.mockResolvedValue([
      makeResource({ id: 1, name: 'a.txt' }),
      makeResource({ id: 2, name: 'b.txt' }),
      makeResource({ id: 3, name: 'dict.json', type: 'DICTIONARY', format: 'json-entries' }),
    ]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('b')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('edit-frequency'));
    fireEvent.click(screen.getByTestId('delete-selected-frequency'));
    expect(screen.getByText('Delete all 2 lists?')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('confirm-delete'));

    await waitFor(() => expect(deleteResourceCascade).toHaveBeenCalledTimes(2));
    expect(deleteResourceCascade).toHaveBeenCalledWith('en', 1);
    expect(deleteResourceCascade).toHaveBeenCalledWith('en', 2);
    expect(deleteResourceCascade).not.toHaveBeenCalledWith('en', 3);
  });
});

// === Drag session (useSectionDrag) — ghost + placeholder + sibling shift ===
// jsdom has no layout, so slot geometry is stubbed with POST-COLLAPSE values:
// once the dragged slot leaves the flow its siblings' offsetTop already
// reflect the collapsed list, which is exactly what the hook reads live.

const realMatchMedia = window.matchMedia;

function mockReducedMotion(): void {
  Object.defineProperty(window, 'matchMedia', {
    value: () => ({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() }),
    configurable: true,
    writable: true,
  });
}

function mockFullMotion(): void {
  Object.defineProperty(window, 'matchMedia', {
    value: () => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() }),
    configurable: true,
    writable: true,
  });
}

function stubSlot(id: number, offsetTop: number, height: number): void {
  const slot = screen.getByTestId(`slot-${id}`);
  Object.defineProperty(slot, 'offsetTop', { value: offsetTop, configurable: true });
  Object.defineProperty(slot, 'offsetHeight', { value: height, configurable: true });
  Object.defineProperty(slot, 'getBoundingClientRect', {
    value: () => ({
      top: offsetTop, bottom: offsetTop + height, height,
      left: 0, right: 100, width: 100, x: 0, y: offsetTop, toJSON: () => ({}),
    }),
    configurable: true,
  });
}

function pointer(el: Element, type: string, clientY = 0): void {
  fireEvent(el, new MouseEvent(type, { bubbles: true, clientY }));
}

describe('pointer drag reorder', () => {
  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', { value: realMatchMedia, configurable: true, writable: true });
  });

  it('lifts a ghost, follows the pointer with a dashed placeholder, shifts siblings, and commits on drop', async () => {
    mockReducedMotion();
    listResources.mockResolvedValue([
      makeResource({ id: 1, name: 'a.txt' }),
      makeResource({ id: 2, name: 'b.txt' }),
      makeResource({ id: 3, name: 'c.txt' }),
    ]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('c')).toBeInTheDocument());

    // Order is id-desc: [c(3), b(2), a(1)]. Grab slot-3 → b collapses to 0,
    // a collapses to 70 (60px card + 10px gap is not modeled; gap reads 0).
    stubSlot(3, 0, 60);
    stubSlot(2, 0, 60);
    stubSlot(1, 70, 60);

    pointer(screen.getByTestId('drag-3'), 'pointerdown', 15);
    expect(screen.getByTestId('slot-3')).toHaveAttribute('data-dragging', 'true');
    expect(screen.getByTestId('drag-placeholder')).toBeInTheDocument();

    // clientY 45 > b's collapsed midpoint (30) → target slot 1 = a's position.
    pointer(document.body, 'pointermove', 45);
    const placeholder = screen.getByTestId('drag-placeholder');
    expect(placeholder.style.top).toBe('70px');
    expect(placeholder.style.height).toBe('60px');
    expect(screen.getByTestId('slot-1').style.transform).toBe('translateY(60px)');
    expect(screen.getByTestId('slot-2').style.transform).toBe('translateY(0px)');
    expect(screen.getByTestId('slot-3').style.transform).toBe('translateY(30px)');

    pointer(document.body, 'pointerup');
    await waitFor(() =>
      expect(reorderResourcesMock).toHaveBeenCalledWith('en', 'FREQUENCY', [2, 3, 1]),
    );
    expect(screen.queryByTestId('drag-placeholder')).not.toBeInTheDocument();
  });

  it('pointercancel restores the list without reordering', async () => {
    mockReducedMotion();
    listResources.mockResolvedValue([
      makeResource({ id: 1, name: 'a.txt' }),
      makeResource({ id: 2, name: 'b.txt' }),
    ]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('b')).toBeInTheDocument());

    stubSlot(2, 0, 60);
    stubSlot(1, 0, 60);

    pointer(screen.getByTestId('drag-2'), 'pointerdown', 15);
    pointer(document.body, 'pointermove', 100);
    expect(screen.getByTestId('drag-placeholder')).toBeInTheDocument();

    pointer(document.body, 'pointercancel');
    await waitFor(() => expect(screen.queryByTestId('drag-placeholder')).not.toBeInTheDocument());
    expect(reorderResourcesMock).not.toHaveBeenCalled();
  });

  it('Escape cancels the drag session', async () => {
    mockReducedMotion();
    listResources.mockResolvedValue([
      makeResource({ id: 1, name: 'a.txt' }),
      makeResource({ id: 2, name: 'b.txt' }),
    ]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('b')).toBeInTheDocument());

    stubSlot(2, 0, 60);
    stubSlot(1, 0, 60);

    pointer(screen.getByTestId('drag-2'), 'pointerdown', 15);
    expect(screen.getByTestId('drag-placeholder')).toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('drag-placeholder')).not.toBeInTheDocument());
    expect(reorderResourcesMock).not.toHaveBeenCalled();
  });

  it('settles the ghost over ~200ms then commits (non-reduced-motion path)', async () => {
    jest.useFakeTimers();
    try {
      mockFullMotion();
      listResources.mockResolvedValue([
        makeResource({ id: 1, name: 'a.txt' }),
        makeResource({ id: 2, name: 'b.txt' }),
      ]);
      render(<ResourcesPanel langCode="en" />);
      await waitFor(() => expect(screen.getByText('b')).toBeInTheDocument());

      stubSlot(2, 0, 60);
      stubSlot(1, 0, 60);

      pointer(screen.getByTestId('drag-2'), 'pointerdown', 15);
      pointer(document.body, 'pointermove', 100);
      pointer(document.body, 'pointerup');

      expect(reorderResourcesMock).not.toHaveBeenCalled();
      expect(screen.getByTestId('drag-placeholder')).toBeInTheDocument();

      act(() => { jest.advanceTimersByTime(250); });
      expect(reorderResourcesMock).toHaveBeenCalledWith('en', 'FREQUENCY', [1, 2]);
      expect(screen.queryByTestId('drag-placeholder')).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('ignores non-primary-button pointerdown on the grip', async () => {
    mockReducedMotion();
    listResources.mockResolvedValue([
      makeResource({ id: 1, name: 'a.txt' }),
      makeResource({ id: 2, name: 'b.txt' }),
    ]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('b')).toBeInTheDocument());

    fireEvent(screen.getByTestId('drag-2'), new MouseEvent('pointerdown', { bubbles: true, clientY: 15, button: 2 }));
    expect(screen.queryByTestId('drag-placeholder')).not.toBeInTheDocument();
  });

  it('hides the grip while the section is in edit mode', async () => {
    listResources.mockResolvedValue([
      makeResource({ id: 1, name: 'a.txt' }),
      makeResource({ id: 2, name: 'b.txt' }),
    ]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('b')).toBeInTheDocument());

    expect(screen.getByTestId('drag-1')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('edit-frequency'));
    expect(screen.queryByTestId('drag-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('drag-2')).not.toBeInTheDocument();
  });
});
