import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ResourcesPanel } from '@/features/dictionary/ui/ResourcesPanel';
import * as orchestrator from '@/features/dictionary/logic/importOrchestrator';
import type { ResourceInfo, ImportResult } from '@/entities/dictionary';

// Mock importOrchestrator
jest.mock('@/features/dictionary/logic/importOrchestrator', () => ({
  listResources: jest.fn(),
  importFile: jest.fn(),
  deleteResourceCascade: jest.fn(),
}));

const listResources = orchestrator.listResources as jest.MockedFunction<typeof orchestrator.listResources>;
const importFile = orchestrator.importFile as jest.MockedFunction<typeof orchestrator.importFile>;
const deleteResourceCascade = orchestrator.deleteResourceCascade as jest.MockedFunction<typeof orchestrator.deleteResourceCascade>;

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

beforeEach(() => {
  jest.clearAllMocks();
  listResources.mockResolvedValue([]);
  importFile.mockResolvedValue({ resourceId: 1, wordCount: 2, format: 'txt' });
  deleteResourceCascade.mockResolvedValue(undefined);
});

describe('ResourcesPanel', () => {
  it('renders dictionary + frequency sections', async () => {
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Từ điển')).toBeInTheDocument());
    expect(screen.getByText('Danh sách tần suất')).toBeInTheDocument();
  });

  it('shows empty state when no resources', async () => {
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getAllByText(/Chưa có/)).toHaveLength(2));
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
    await waitFor(() => expect(screen.getByText('Danh sách tần suất')).toBeInTheDocument());
    const inputs = screen.getAllByTestId('dropzone-input');
    const freqInput = inputs[1] as HTMLInputElement; // frequency dropzone is 2nd
    const file = new File(['hello\nworld\n'], 'test.txt', { type: 'text/plain' });
    fireEvent.change(freqInput, { target: { files: [file] } });
    await waitFor(() => expect(importFile).toHaveBeenCalledWith(file, 'FREQUENCY', expect.any(Object)));
  });

  it('shows success message after import', async () => {
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Danh sách tần suất')).toBeInTheDocument());
    const inputs = screen.getAllByTestId('dropzone-input');
    const freqInput = inputs[1] as HTMLInputElement;
    const file = new File(['hello\nworld\n'], 'test.txt', { type: 'text/plain' });
    fireEvent.change(freqInput, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByTestId('import-success-frequency')).toBeInTheDocument());
    expect(screen.getByTestId('import-success-frequency').textContent).toContain('test.txt');
  });

  it('shows error message on import failure', async () => {
    importFile.mockRejectedValue(new Error('parse fail'));
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Danh sách tần suất')).toBeInTheDocument());
    const inputs = screen.getAllByTestId('dropzone-input');
    const freqInput = inputs[1] as HTMLInputElement;
    const file = new File(['bad'], 'test.txt', { type: 'text/plain' });
    fireEvent.change(freqInput, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByTestId('import-error-frequency')).toBeInTheDocument());
  });

  it('allows concurrent dictionary + frequency import (independent dropzones)', async () => {
    // Dictionary import hangs (never resolves) while frequency import completes.
    let resolveDict: (v: ImportResult) => void = () => {};
    const dictPromise = new Promise<ImportResult>((r) => {
      resolveDict = r;
    });
    importFile.mockImplementation((_file, type) => {
      if (type === 'DICTIONARY') return dictPromise;
      return Promise.resolve({ resourceId: 2, wordCount: 5, format: 'txt' });
    });

    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Danh sách tần suất')).toBeInTheDocument());
    const inputs = screen.getAllByTestId('dropzone-input');
    const dictInput = inputs[0] as HTMLInputElement;
    const freqInput = inputs[1] as HTMLInputElement;

    // Start dictionary import (will hang)
    fireEvent.change(dictInput, { target: { files: [new File(['[]'], 'dict.json', { type: 'application/json' })] } });
    // Start frequency import while dictionary is still running
    fireEvent.change(freqInput, { target: { files: [new File(['a\nb\n'], 'freq.txt', { type: 'text/plain' })] } });

    // Frequency import should complete even though dictionary is still running
    await waitFor(() => expect(screen.getByTestId('import-success-frequency')).toBeInTheDocument());
    // Dictionary dropzone should still be disabled (importing), frequency dropzone enabled
    // Resolve dictionary import to clean up
    resolveDict({ resourceId: 1, wordCount: 3, format: 'cambridge-json' });
    await waitFor(() => expect(screen.getByTestId('import-success-dictionary')).toBeInTheDocument());
  });

  it('opens delete confirm modal when delete clicked', async () => {
    listResources.mockResolvedValue([makeResource({ id: 1, name: 'words.txt' })]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('words.txt')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('delete-button-1'));
    expect(screen.getByTestId('delete-confirm-modal')).toBeInTheDocument();
  });

  it('deletes resource on confirm', async () => {
    listResources.mockResolvedValue([makeResource({ id: 1, name: 'words.txt' })]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('words.txt')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('delete-button-1'));
    fireEvent.click(screen.getByTestId('confirm-delete'));
    await waitFor(() => expect(deleteResourceCascade).toHaveBeenCalledWith('en', 1));
  });
});
