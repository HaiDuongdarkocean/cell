import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ResourcesPanel } from '@/features/dictionary/ui/ResourcesPanel';
import * as orchestrator from '@/features/dictionary/logic/importOrchestrator';
import type { ResourceInfo } from '@/entities/dictionary';

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
    await waitFor(() => expect(screen.getByTestId('import-success')).toBeInTheDocument());
    expect(screen.getByTestId('import-success').textContent).toContain('test.txt');
  });

  it('shows error message on import failure', async () => {
    importFile.mockRejectedValue(new Error('parse fail'));
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Danh sách tần suất')).toBeInTheDocument());
    const inputs = screen.getAllByTestId('dropzone-input');
    const freqInput = inputs[1] as HTMLInputElement;
    const file = new File(['bad'], 'test.txt', { type: 'text/plain' });
    fireEvent.change(freqInput, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByTestId('import-error')).toBeInTheDocument());
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
