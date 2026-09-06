import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

function pickFile(inputIndex: number, file: File): void {
  const inputs = screen.getAllByTestId('dropzone-input');
  fireEvent.change(inputs[inputIndex] as HTMLInputElement, { target: { files: [file] } });
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
    await waitFor(() => expect(screen.getByText('Từ điển')).toBeInTheDocument());
    expect(screen.getByText('Độ phổ biến')).toBeInTheDocument();
    expect(screen.getByText('Tra nghĩa, phiên âm, phát âm.')).toBeInTheDocument();
    expect(screen.getByText('Đánh dấu từ hay gặp.')).toBeInTheDocument();
  });

  it('shows empty state when no resources', async () => {
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Chưa có từ điển nào.')).toBeInTheDocument());
    expect(screen.getByText('Chưa có danh sách nào.')).toBeInTheDocument();
  });

  it('lists dictionary + frequency resources separately', async () => {
    listResources.mockResolvedValue([
      makeResource({ id: 1, name: 'dict.json', type: 'DICTIONARY', format: 'cambridge-json' }),
      makeResource({ id: 2, name: 'freq.txt', type: 'FREQUENCY', format: 'txt' }),
    ]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('dict.json')).toBeInTheDocument());
    expect(screen.getByText('freq.txt')).toBeInTheDocument();
  });

  it('imports file via dropzone (frequency)', async () => {
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Độ phổ biến')).toBeInTheDocument());
    pickFile(1, new File(['hello\nworld\n'], 'test.txt', { type: 'text/plain' }));
    await waitFor(() =>
      expect(importFile).toHaveBeenCalledWith(
        expect.anything(),
        'FREQUENCY',
        expect.objectContaining({ langCode: 'en', onDuplicate: expect.any(Function) }),
      ),
    );
  });

  it('shows success message after import', async () => {
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Độ phổ biến')).toBeInTheDocument());
    pickFile(1, new File(['hello\nworld\n'], 'test.txt', { type: 'text/plain' }));
    await waitFor(() => expect(screen.getByTestId('import-success-frequency')).toBeInTheDocument());
    expect(screen.getByTestId('import-success-frequency').textContent).toContain('Đã thêm "test.txt" — 2 từ.');
  });

  it('shows error message on import failure', async () => {
    importFile.mockRejectedValue(new Error('parse fail'));
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Độ phổ biến')).toBeInTheDocument());
    pickFile(1, new File(['bad'], 'test.txt', { type: 'text/plain' }));
    await waitFor(() => expect(screen.getByTestId('import-error-frequency')).toBeInTheDocument());
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
    await waitFor(() => expect(screen.getByText('Độ phổ biến')).toBeInTheDocument());

    pickFile(0, new File(['[]'], 'dict.json', { type: 'application/json' }));
    pickFile(1, new File(['a\nb\n'], 'freq.txt', { type: 'text/plain' }));

    await waitFor(() => expect(screen.getByTestId('import-success-frequency')).toBeInTheDocument());
    resolveDict({ resourceId: 1, wordCount: 3, format: 'cambridge-json' });
    await waitFor(() => expect(screen.getByTestId('import-success-dictionary')).toBeInTheDocument());
  });

  it('prompts on duplicate and resolves onDuplicate when "Bỏ qua" clicked', async () => {
    const existing = makeResource({ id: 5, name: 'existing.txt' });
    importFile.mockImplementation(async (_file, _type, options) => {
      const choice = await (options as { onDuplicate?: (e: ResourceInfo) => Promise<'skip' | 'replace'> })
        .onDuplicate?.(existing);
      if (choice === 'replace') return { resourceId: 9, wordCount: 5, format: 'txt' };
      return { resourceId: 0, wordCount: 0, format: 'txt', skippedAsDuplicate: true, existingResource: existing } as ImportResult;
    });

    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Độ phổ biến')).toBeInTheDocument());
    pickFile(1, new File(['a\nb\n'], 'test.txt', { type: 'text/plain' }));

    await waitFor(() => expect(screen.getByTestId('import-duplicate-frequency')).toBeInTheDocument());
    expect(screen.getByText(/Đã có sẵn "existing\.txt"/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('duplicate-skip'));
    await waitFor(() =>
      expect(screen.queryByTestId('import-duplicate-frequency')).not.toBeInTheDocument(),
    );
    // Skipped — no success banner, importFile ran once.
    expect(importFile).toHaveBeenCalledTimes(1);
  });

  it('resolves "Thay thế" so the import proceeds', async () => {
    const existing = makeResource({ id: 5, name: 'existing.txt' });
    importFile.mockImplementation(async (_file, _type, options) => {
      const choice = await (options as { onDuplicate?: (e: ResourceInfo) => Promise<'skip' | 'replace'> })
        .onDuplicate?.(existing);
      if (choice === 'replace') return { resourceId: 9, wordCount: 5, format: 'txt' };
      return { resourceId: 0, wordCount: 0, format: 'txt', skippedAsDuplicate: true, existingResource: existing } as ImportResult;
    });

    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Độ phổ biến')).toBeInTheDocument());
    pickFile(1, new File(['a\nb\n'], 'test.txt', { type: 'text/plain' }));

    await waitFor(() => expect(screen.getByTestId('import-duplicate-frequency')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('duplicate-replace'));

    await waitFor(() => expect(screen.getByTestId('import-success-frequency')).toBeInTheDocument());
  });

  it('reorders resources via up/down buttons', async () => {
    listResources.mockResolvedValue([
      makeResource({ id: 1, name: 'a.txt' }),
      makeResource({ id: 2, name: 'b.txt' }),
    ]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('b.txt')).toBeInTheDocument());

    // No priorities → id-desc order: [b(2), a(1)]. Moving a.txt up → [1, 2].
    fireEvent.click(screen.getByTestId('move-up-1'));
    await waitFor(() =>
      expect(reorderResourcesMock).toHaveBeenCalledWith('en', 'FREQUENCY', [1, 2]),
    );
  });

  it('opens delete confirm modal when delete clicked', async () => {
    listResources.mockResolvedValue([makeResource({ id: 1, name: 'words.txt' })]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('words.txt')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('delete-button-1'));
    expect(screen.getByTestId('delete-confirm-modal')).toBeInTheDocument();
    expect(screen.getByText('Xóa danh sách?')).toBeInTheDocument();
  });

  it('deletes resource on confirm', async () => {
    listResources.mockResolvedValue([makeResource({ id: 1, name: 'words.txt' })]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('words.txt')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('delete-button-1'));
    fireEvent.click(screen.getByTestId('confirm-delete'));
    await waitFor(() => expect(deleteResourceCascade).toHaveBeenCalledWith('en', 1));
  });

  it('delete-all cascades every resource of that section only', async () => {
    listResources.mockResolvedValue([
      makeResource({ id: 1, name: 'a.txt' }),
      makeResource({ id: 2, name: 'b.txt' }),
      makeResource({ id: 3, name: 'dict.json', type: 'DICTIONARY', format: 'cambridge-json' }),
    ]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByTestId('delete-all-frequency')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('delete-all-frequency'));
    expect(screen.getByText('Xóa tất cả 2 danh sách?')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('confirm-delete'));

    await waitFor(() => expect(deleteResourceCascade).toHaveBeenCalledTimes(2));
    expect(deleteResourceCascade).toHaveBeenCalledWith('en', 1);
    expect(deleteResourceCascade).toHaveBeenCalledWith('en', 2);
    expect(deleteResourceCascade).not.toHaveBeenCalledWith('en', 3);
  });
});
