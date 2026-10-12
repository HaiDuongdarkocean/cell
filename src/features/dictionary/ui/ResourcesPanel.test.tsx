import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ResourcesPanel } from '@/features/dictionary/ui/ResourcesPanel';
import { pushEscapeLayer } from '@/shared/ui/escapeLayerStack';
import * as client from '@/features/dictionary/services/resourceClient';
import type { ResourceInfo } from '@/entities/dictionary';
import type { Job } from '@/entities/job/types';

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
  setResourceComponents: jest.fn().mockResolvedValue(undefined),
  getResourceComponents: jest.fn().mockResolvedValue([]),
  renameResource: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/dictionary/logic/signatureGenerator', () => ({
  computeSignature: jest.fn().mockImplementation(async (file: File) => `sig-${file.name}`),
}));

jest.mock('@/features/dictionary/logic/formatDetector', () => {
  const actual = jest.requireActual<typeof import('@/features/dictionary/logic/formatDetector')>('@/features/dictionary/logic/formatDetector');
  return {
    ...actual,
    detectComponents: jest.fn().mockResolvedValue(['frequency']),
  };
});

jest.mock('@/features/dictionary/logic/fileDetector', () => {
  const actual = jest.requireActual<typeof import('@/features/dictionary/logic/fileDetector')>('@/features/dictionary/logic/fileDetector');
  return {
    ...actual,
    readFileHead: jest.fn().mockResolvedValue(new Uint8Array(0)),
  };
});

jest.mock('@/features/jobs/jobClient', () => ({
  listJobs: jest.fn().mockResolvedValue([]),
  subscribeJobEvents: jest.fn(() => () => {}),
  dismissJob: jest.fn().mockResolvedValue(true),
  retryJob: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/features/jobs', () => {
  const actual = jest.requireActual<typeof import('@/features/jobs')>('@/features/jobs');
  let jobs: Job[] = [];
  return {
    __setJobs: (next: Job[]): void => { jobs = next; },
    useJobs: () => jobs,
    useJobTerminalWatcher: actual.useJobTerminalWatcher,
    JobRow: actual.JobRow,
    dismissJob: actual.dismissJob,
    retryJob: actual.retryJob,
    subscribeJobEvents: actual.subscribeJobEvents,
    listJobs: actual.listJobs,
    waitForJobTerminal: actual.waitForJobTerminal,
  };
});

jest.mock('@/shared/lib/storage/settingsStore', () => ({
  loadSettings: jest.fn().mockResolvedValue({ languageProfiles: [] }),
  saveSettings: jest.fn().mockResolvedValue(undefined),
}));

import { reorderResources } from '@/features/dictionary/services/resourceClient';

const jobsMock = jest.requireMock<{ __setJobs: (next: Job[]) => void }>('@/features/jobs');
const setRegistryJobs = (next: Job[]): void => jobsMock.__setJobs(next);

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    kind: 'resource-delete',
    label: 'a.txt',
    status: 'running',
    progress: { done: 0, total: 0 },
    params: { langCode: 'en' },
    retryable: true,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

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
  setRegistryJobs([]);
  listResources.mockResolvedValue([]);
  importFile.mockResolvedValue({ jobId: 'job-1' });
  deleteResourceCascade.mockResolvedValue({ jobId: 'del-1' });
});

describe('ResourcesPanel', () => {
  it('renders the unified resources section', async () => {
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Add resource')).toBeInTheDocument());
    expect(screen.getByText('Drop or pick a file · .txt, .json, .zip, .db, .gz')).toBeInTheDocument();
  });

  it('shows empty state when no resources', async () => {
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('No resources yet.')).toBeInTheDocument());
  });

  it('lists dictionary + frequency resources in one flat list', async () => {
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
    await waitFor(() => expect(screen.getByText('Add resource')).toBeInTheDocument());
    pickFile(0, new File(['hello\nworld\n'], 'test.txt', { type: 'text/plain' }));
    await waitFor(() =>
      expect(importFile).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          langCode: 'en',
          onDuplicate: expect.any(Function),
          jobId: expect.any(String),
          getComponents: expect.any(Function),
        }),
      ),
    );
    const [, opts] = importFile.mock.calls[0] as unknown as [
      unknown,
      { getComponents: () => readonly string[] | undefined },
    ];
    expect(opts.getComponents()).toBeUndefined();
  });

  it('sends a components subset only after the user narrows detection', async () => {
    const { detectComponents } = jest.requireMock<typeof import('@/features/dictionary/logic/formatDetector')>(
      '@/features/dictionary/logic/formatDetector',
    );
    (detectComponents as jest.Mock).mockImplementation(async (name: string) =>
      name === 'mixed.zip' ? ['definitions', 'frequency'] : ['frequency']);
    let resolveFirst!: (v: { jobId: string }) => void;
    let resolveThird!: (v: { jobId: string }) => void;
    importFile
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r; }))
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockImplementationOnce(() => new Promise((r) => { resolveThird = r; }));

    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Add resource')).toBeInTheDocument());
    pickFiles(0, [
      new File(['a\n'], 'one.txt', { type: 'text/plain' }),
      new File(['b\n'], 'two.txt', { type: 'text/plain' }),
      new File(['zip'], 'mixed.zip'),
    ]);

    const freqChip = await screen.findByRole('button', { name: /frequency/i });
    act(() => { fireEvent.click(freqChip); });
    act(() => resolveFirst({ jobId: 'job-1' }));

    await waitFor(() => expect(importFile).toHaveBeenCalledTimes(3));
    const [, opts] = importFile.mock.calls[2] as unknown as [
      unknown,
      { getComponents: () => readonly string[] | undefined },
    ];
    expect(opts.getComponents()).toEqual(['definitions']);
    act(() => resolveThird({ jobId: 'job-3' }));
  });

  it('dropping N files creates N independent job rows', async () => {
    importFile.mockImplementation(() => new Promise<{ jobId: string }>(() => {}));
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Add resource')).toBeInTheDocument());
    pickFiles(0, [
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
      return new Promise<{ jobId: string }>(() => {});
    });
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Add resource')).toBeInTheDocument());
    pickFiles(0, [
      new File(['a\n'], 'one.txt', { type: 'text/plain' }),
      new File(['b\n'], 'two.txt', { type: 'text/plain' }),
      new File(['c\n'], 'three.txt', { type: 'text/plain' }),
    ]);
    await waitFor(() => expect(started).toHaveLength(2));
    expect(screen.getByText('Waiting')).toBeInTheDocument();
  });

  it('hands the row to the registry job after upload, then shows its done state', async () => {
    importFile.mockResolvedValue({ jobId: 'j-freq' });
    const view = render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Add resource')).toBeInTheDocument());
    pickFile(0, new File(['hello\nworld\n'], 'test.txt', { type: 'text/plain' }));
    await waitFor(() => expect(importFile).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('test.txt')).not.toBeInTheDocument());
    setRegistryJobs([makeJob({
      id: 'j-freq',
      kind: 'resource-import',
      label: 'test.txt',
      status: 'done',
      result: { wordCount: 2 },
    })]);
    view.rerender(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Done · 2')).toBeInTheDocument());
  });

  it('shows the error on the failing job row only', async () => {
    let call = 0;
    importFile.mockImplementation(() => {
      call += 1;
      return call === 1
        ? Promise.reject(new Error('parse fail'))
        : Promise.resolve({ jobId: 'j-ok' });
    });
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Add resource')).toBeInTheDocument());
    pickFiles(0, [
      new File(['bad'], 'bad.txt', { type: 'text/plain' }),
      new File(['ok'], 'good.txt', { type: 'text/plain' }),
    ]);
    await waitFor(() => expect(screen.getByText(/parse fail/)).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByText('good.txt')).not.toBeInTheDocument());
    expect(screen.getByText('bad.txt')).toBeInTheDocument();
  });

  it('upload progress shows the chunk percent while uploading', async () => {
    importFile.mockImplementation((_f, options) => {
      const opts = options as { onUploadProgress?: (sent: number, total: number) => void };
      opts.onUploadProgress?.(5, 10);
      return new Promise<{ jobId: string }>(() => {});
    });
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Add resource')).toBeInTheDocument());
    pickFile(0, new File(['a\n'], 'big.txt', { type: 'text/plain' }));
    await waitFor(() => expect(screen.getAllByText(/50%/).length).toBeGreaterThan(0));
  });

  it('runs concurrent imports through the single dropzone', async () => {
    let resolveDict: (v: { jobId: string }) => void = () => {};
    const dictPromise = new Promise<{ jobId: string }>((r) => {
      resolveDict = r;
    });
    importFile.mockImplementation((file) =>
      file.name === 'dict.json' ? dictPromise : Promise.resolve({ jobId: 'j-freq' }),
    );

    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Add resource')).toBeInTheDocument());

    pickFiles(0, [
      new File(['[]'], 'dict.json', { type: 'application/json' }),
      new File(['a\nb\n'], 'freq.txt', { type: 'text/plain' }),
    ]);

    await waitFor(() => expect(importFile).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText('freq.txt')).not.toBeInTheDocument());
    expect(screen.getByText('dict.json')).toBeInTheDocument();
    resolveDict({ jobId: 'j-dict' });
    await waitFor(() => expect(screen.queryByText('dict.json')).not.toBeInTheDocument());
  });

  it('prompts on duplicate and resolves onDuplicate when "Skip" clicked', async () => {
    const existing = makeResource({ id: 5, name: 'existing.txt' });
    importFile.mockImplementation(async (_file, options) => {
      const choice = await (options as { onDuplicate?: (e: ResourceInfo) => Promise<'skip' | 'replace'> })
        .onDuplicate?.(existing);
      if (choice === 'replace') return { jobId: 'j-replace' };
      return { skipped: true as const, existingResource: existing };
    });

    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Add resource')).toBeInTheDocument());
    pickFile(0, new File(['a\nb\n'], 'test.txt', { type: 'text/plain' }));

    await waitFor(() => expect(screen.getByText(/"existing\.txt" already exists/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    await waitFor(() => expect(screen.getByText(/Skipped/)).toBeInTheDocument());
    expect(importFile).toHaveBeenCalledTimes(1);
  });

  it('resolves "Replace" so the import proceeds', async () => {
    const existing = makeResource({ id: 5, name: 'existing.txt' });
    importFile.mockImplementation(async (_file, options) => {
      const choice = await (options as { onDuplicate?: (e: ResourceInfo) => Promise<'skip' | 'replace'> })
        .onDuplicate?.(existing);
      if (choice === 'replace') return { jobId: 'j-replace' };
      return { skipped: true as const, existingResource: existing };
    });

    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Add resource')).toBeInTheDocument());
    pickFile(0, new File(['a\nb\n'], 'test.txt', { type: 'text/plain' }));

    await waitFor(() => expect(screen.getByText(/"existing\.txt" already exists/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));

    await waitFor(() => expect(screen.queryByText('test.txt')).not.toBeInTheDocument());
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
      expect(reorderResourcesMock).toHaveBeenCalledWith('en', [1, 2]),
    );
  });

  it('hides every delete affordance outside edit mode', async () => {
    listResources.mockResolvedValue([makeResource({ id: 1, name: 'words.txt' })]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('words')).toBeInTheDocument());
    expect(screen.queryByTestId('delete-button-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-all-resources')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-selected-resources')).not.toBeInTheDocument();
  });

  it('opens delete confirm modal when delete clicked inside edit mode', async () => {
    listResources.mockResolvedValue([makeResource({ id: 1, name: 'words.txt' })]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('words')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('edit-resources'));
    fireEvent.click(screen.getByTestId('delete-button-1'));
    expect(screen.getByTestId('delete-confirm-modal')).toBeInTheDocument();
    expect(screen.getByText('Delete list')).toBeInTheDocument();
  });

  it('deletes resource on confirm', async () => {
    listResources.mockResolvedValue([makeResource({ id: 1, name: 'words.txt' })]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('words')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('edit-resources'));
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
    await waitFor(() => expect(screen.getByText('Add resource')).toBeInTheDocument());
    pickFile(0, new File(['hello\n'], 'test.txt', { type: 'text/plain' }));
    await waitFor(() => expect(importFile).toHaveBeenCalled());
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

    fireEvent.click(screen.getByTestId('edit-resources'));
    expect(screen.getByTestId('delete-button-1')).toBeInTheDocument();
    expect(screen.queryByTestId('delete-all-resources')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('select-1'));
    fireEvent.click(screen.getByTestId('select-3'));

    const deleteButton = screen.getByTestId('delete-selected-resources');
    expect(deleteButton).toHaveTextContent('Delete 2 selected');
    fireEvent.click(deleteButton);
    expect(screen.getByText('Delete 2 selected resources')).toBeInTheDocument();
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

    fireEvent.click(screen.getByTestId('edit-resources'));
    const deleteButton = screen.getByTestId('delete-selected-resources');
    expect(deleteButton).toHaveTextContent('Delete all');
    fireEvent.click(deleteButton);
    expect(screen.getByText('Delete all 2 resources')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('confirm-delete'));

    await waitFor(() => expect(deleteResourceCascade).toHaveBeenCalledTimes(2));
  });

  it('pressing the edit button again exits edit mode', async () => {
    listResources.mockResolvedValue([makeResource({ id: 1, name: 'a.txt' })]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('a')).toBeInTheDocument());

    const editButton = screen.getByTestId('edit-resources');
    expect(editButton).toHaveAttribute('aria-label', 'Edit Resources');
    fireEvent.click(editButton);
    expect(editButton).toHaveAttribute('aria-label', 'Finish editing Resources');
    fireEvent.click(editButton);
    expect(screen.queryByTestId('delete-button-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-selected-resources')).not.toBeInTheDocument();
  });

  it('delete-all cascades every resource across kinds', async () => {
    listResources.mockResolvedValue([
      makeResource({ id: 1, name: 'a.txt' }),
      makeResource({ id: 2, name: 'b.txt' }),
      makeResource({ id: 3, name: 'dict.json', type: 'DICTIONARY', format: 'json-entries' }),
    ]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('b')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('edit-resources'));
    fireEvent.click(screen.getByTestId('delete-selected-resources'));
    expect(screen.getByText('Delete all 3 resources')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('confirm-delete'));

    await waitFor(() => expect(deleteResourceCascade).toHaveBeenCalledTimes(3));
    expect(deleteResourceCascade).toHaveBeenCalledWith('en', 1);
    expect(deleteResourceCascade).toHaveBeenCalledWith('en', 2);
    expect(deleteResourceCascade).toHaveBeenCalledWith('en', 3);
  });

  it('select-all checkbox selects and deselects every row', async () => {
    listResources.mockResolvedValue([
      makeResource({ id: 1, name: 'a.txt' }),
      makeResource({ id: 2, name: 'b.txt' }),
    ]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('b')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('edit-resources'));
    const selectAllBox = screen.getByTestId('select-all-resources');
    expect(screen.getByText('0 of 2 selected')).toBeInTheDocument();

    fireEvent.click(selectAllBox);
    expect(screen.getByText('2 of 2 selected')).toBeInTheDocument();
    expect(screen.getByTestId('check-1')).toBeChecked();
    expect(screen.getByTestId('check-2')).toBeChecked();

    fireEvent.click(selectAllBox);
    expect(screen.getByText('0 of 2 selected')).toBeInTheDocument();
    expect(screen.getByTestId('check-1')).not.toBeChecked();
  });

  it('per-row checkbox selects a single resource', async () => {
    listResources.mockResolvedValue([
      makeResource({ id: 1, name: 'a.txt' }),
      makeResource({ id: 2, name: 'b.txt' }),
    ]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('b')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('edit-resources'));
    fireEvent.click(screen.getByTestId('check-2'));
    expect(screen.getByText('1 of 2 selected')).toBeInTheDocument();
    expect(screen.getByTestId('delete-selected-resources')).toHaveTextContent('Delete 1 selected');
  });

  it('bulk enable applies setResourceEnabled to selected rows', async () => {
    const setEnabled = client.setResourceEnabled as jest.MockedFunction<typeof client.setResourceEnabled>;
    listResources.mockResolvedValue([
      makeResource({ id: 1, name: 'a.txt' }),
      makeResource({ id: 2, name: 'b.txt' }),
    ]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('b')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('edit-resources'));
    expect(screen.getByTestId('enable-selected-resources')).toBeDisabled();

    fireEvent.click(screen.getByTestId('check-1'));
    fireEvent.click(screen.getByTestId('enable-selected-resources'));
    await waitFor(() => expect(setEnabled).toHaveBeenCalledWith('en', 1, true));
    expect(setEnabled).toHaveBeenCalledTimes(1);
  });

  it('drains the card in place while the delete job runs, then removes it', async () => {
    deleteResourceCascade.mockResolvedValueOnce({ jobId: 'del-1' });
    listResources.mockResolvedValue([makeResource({ id: 1, name: 'words.txt', signature: 'sig-words.txt' })]);
    const view = render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('words')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('edit-resources'));
    fireEvent.click(screen.getByTestId('delete-button-1'));
    fireEvent.click(screen.getByTestId('confirm-delete'));
    await waitFor(() => expect(deleteResourceCascade).toHaveBeenCalledWith('en', 1));

    // The card stays mounted — no optimistic vanish — and shows the drain.
    expect(screen.getByTestId('resource-card-1')).toBeInTheDocument();
    setRegistryJobs([makeJob({
      id: 'del-1',
      status: 'running',
      label: 'words.txt',
      progress: { done: 3000, total: 12000 },
      params: { langCode: 'en', resourceId: 1, signature: 'sig-words.txt' },
    })]);
    view.rerender(<ResourcesPanel langCode="en" />);

    await waitFor(() => expect(screen.getByTestId('deleting-1')).toBeInTheDocument());
    expect(screen.getByTestId('delete-meta-1')).toHaveTextContent('Removing… 3,000 / 12,000 items');
    expect(screen.queryByTestId('job-row-del-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('enable-toggle-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('resource-components-1')).not.toBeInTheDocument();

    listResources.mockResolvedValue([]);
    setRegistryJobs([makeJob({
      id: 'del-1',
      status: 'done',
      label: 'words.txt',
      params: { langCode: 'en', resourceId: 1, signature: 'sig-words.txt' },
    })]);
    view.rerender(<ResourcesPanel langCode="en" />);

    await waitFor(() => expect(screen.queryByTestId('resource-card-1')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('panel-alert')).toHaveTextContent('Deleted "words.txt"'));
    expect(screen.queryByTestId('job-row-del-1')).not.toBeInTheDocument();
  });

  it('holds a same-signature import until removal finishes', async () => {
    listResources.mockResolvedValue([makeResource({ id: 1, name: 'words.txt', signature: 'sig-words.txt' })]);
    setRegistryJobs([makeJob({
      id: 'del-1',
      status: 'running',
      label: 'words.txt',
      progress: { done: 4000, total: 12000 },
      params: { langCode: 'en', resourceId: 1, signature: 'sig-words.txt' },
    })]);
    const view = render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByTestId('deleting-1')).toBeInTheDocument());

    pickFile(0, new File(['hello\nworld\n'], 'words.txt', { type: 'text/plain' }));
    await waitFor(() => expect(screen.getByText('Waiting for removal…')).toBeInTheDocument());
    expect(importFile).not.toHaveBeenCalled();

    listResources.mockResolvedValue([]);
    setRegistryJobs([makeJob({
      id: 'del-1',
      status: 'done',
      label: 'words.txt',
      params: { langCode: 'en', resourceId: 1, signature: 'sig-words.txt' },
    })]);
    view.rerender(<ResourcesPanel langCode="en" />);

    await waitFor(() => expect(importFile).toHaveBeenCalled());
  });

  it('still imports a different file while an unrelated delete runs', async () => {
    listResources.mockResolvedValue([makeResource({ id: 1, name: 'words.txt', signature: 'sig-words.txt' })]);
    setRegistryJobs([makeJob({
      id: 'del-1',
      status: 'running',
      label: 'words.txt',
      params: { langCode: 'en', resourceId: 1, signature: 'sig-words.txt' },
    })]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByTestId('deleting-1')).toBeInTheDocument());

    pickFile(0, new File(['other\n'], 'other.txt', { type: 'text/plain' }));
    await waitFor(() => expect(importFile).toHaveBeenCalled());
  });

  it('queues delete jobs card-by-card during delete-all', async () => {
    const releases: Array<() => void> = [];
    deleteResourceCascade.mockImplementation(
      () => new Promise<{ jobId: string }>((r) => { releases.push(() => r({ jobId: 'd' })); }),
    );
    listResources.mockResolvedValue([
      makeResource({ id: 2, name: 'b.txt' }),
      makeResource({ id: 1, name: 'a.txt' }),
    ]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('b')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('edit-resources'));
    fireEvent.click(screen.getByTestId('delete-selected-resources'));
    fireEvent.click(screen.getByTestId('confirm-delete'));

    await waitFor(() => expect(deleteResourceCascade).toHaveBeenCalledWith('en', 2));
    await act(async () => { releases[0]?.(); });
    // Cards persist through the run — the registry drives their removal.
    expect(screen.getByTestId('resource-card-2')).toBeInTheDocument();
    await waitFor(() => expect(deleteResourceCascade).toHaveBeenCalledWith('en', 1));

    await act(async () => { releases[1]?.(); });
    await waitFor(() => expect(deleteResourceCascade).toHaveBeenCalledTimes(2));
  });

  it('ignores further delete triggers while a delete run is in progress', async () => {
    let release: () => void = () => {};
    deleteResourceCascade.mockImplementationOnce(
      () => new Promise<{ jobId: string }>((r) => { release = () => r({ jobId: 'del-1' }); }),
    );
    listResources.mockResolvedValue([
      makeResource({ id: 1, name: 'a.txt' }),
      makeResource({ id: 2, name: 'b.txt' }),
    ]);
    const view = render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('b')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('edit-resources'));
    fireEvent.click(screen.getByTestId('delete-button-1'));
    fireEvent.click(screen.getByTestId('confirm-delete'));
    await waitFor(() => expect(deleteResourceCascade).toHaveBeenCalledWith('en', 1));

    setRegistryJobs([makeJob({ id: 'del-1', status: 'running', params: { langCode: 'en', resourceId: 1 } })]);
    view.rerender(<ResourcesPanel langCode="en" />);
    fireEvent.click(screen.getByTestId('delete-button-2'));
    expect(screen.queryByTestId('delete-confirm-modal')).toBeNull();
    expect(screen.getByTestId('delete-selected-resources')).toBeDisabled();

    await act(async () => { release(); });
    await waitFor(() => expect(deleteResourceCascade).toHaveBeenCalledTimes(1));
  });

  it('continues the run after a per-item failure and reports the first error', async () => {
    deleteResourceCascade
      .mockImplementationOnce(() => Promise.reject(new Error('boom')))
      .mockResolvedValueOnce({ jobId: 'del-2' });
    listResources.mockResolvedValue([
      makeResource({ id: 1, name: 'a.txt' }),
      makeResource({ id: 2, name: 'b.txt' }),
    ]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('b')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('edit-resources'));
    fireEvent.click(screen.getByTestId('delete-selected-resources'));
    fireEvent.click(screen.getByTestId('confirm-delete'));

    await waitFor(() => expect(deleteResourceCascade).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId('panel-alert')).toHaveTextContent("Couldn't delete: Error: boom"));
    expect(listResources.mock.calls.length).toBeGreaterThan(1);
  });

  it('renders an unfinished resource as an importing card inside the list, without toggle or chips', async () => {
    const getComponents = client.getResourceComponents as jest.MockedFunction<typeof client.getResourceComponents>;
    listResources.mockResolvedValue([
      makeResource({ id: 1, name: 'done.json', type: 'DICTIONARY', format: 'json-entries' }),
      makeResource({ id: 9, name: 'OALD10.normalized.json', type: 'DICTIONARY', format: 'json-entries', installationFinished: false }),
    ]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByTestId('resource-card-9')).toBeInTheDocument());
    expect(screen.getByText('OALD10')).toBeInTheDocument();
    expect(screen.queryByTestId('enable-toggle-9')).not.toBeInTheDocument();
    expect(screen.queryByTestId('resource-components-9')).not.toBeInTheDocument();
    expect(screen.queryByTestId('drag-9')).not.toBeInTheDocument();
    expect(getComponents).not.toHaveBeenCalledWith('en', 9);
    expect(screen.getByTestId('enable-toggle-1')).toBeInTheDocument();
  });

  it('shows live progress on the card and suppresses the registry row once the resource exists', async () => {
    listResources.mockResolvedValue([
      makeResource({ id: 7, name: 'big.json', type: 'DICTIONARY', format: 'json-entries', installationFinished: false }),
    ]);
    setRegistryJobs([makeJob({
      id: 'imp-1',
      kind: 'resource-import',
      status: 'running',
      label: 'big.json',
      resourceId: 7,
      progress: { done: 12, total: 100 },
      params: { langCode: 'en', signature: 'sig' },
    })]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByTestId('resource-card-7')).toBeInTheDocument());
    expect(screen.queryByTestId('job-row-imp-1')).not.toBeInTheDocument();
    expect(screen.getByText('Adding… 12 / 100 items')).toBeInTheDocument();
  });

  it('suppresses the done job row once its resource card is in the list', async () => {
    listResources.mockResolvedValue([makeResource({ id: 5, name: 'new.txt' })]);
    setRegistryJobs([makeJob({
      id: 'imp-9',
      kind: 'resource-import',
      status: 'done',
      label: 'new.txt',
      resourceId: 5,
      result: { resourceId: 5, wordCount: 10 },
      params: { langCode: 'en' },
    })]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByTestId('resource-card-5')).toBeInTheDocument());
    expect(screen.queryByTestId('job-row-imp-9')).not.toBeInTheDocument();
  });

  it('keeps a failed import row in the list for retry/dismiss', async () => {
    listResources.mockResolvedValue([makeResource({ id: 1, name: 'words.txt' })]);
    setRegistryJobs([makeJob({
      id: 'imp-bad',
      kind: 'resource-import',
      status: 'failed',
      label: 'bad.txt',
      resourceId: 55,
      error: 'parse fail',
      retryable: true,
      params: { langCode: 'en' },
    })]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByTestId('job-row-imp-bad')).toBeInTheDocument());
    expect(screen.queryByTestId('resource-card-55')).not.toBeInTheDocument();
  });

  it('places the uploading row inside the list at the spot the new card will land', async () => {
    importFile.mockImplementation(() => new Promise<{ jobId: string }>(() => {}));
    listResources.mockResolvedValue([
      makeResource({ id: 1, name: 'pinned.txt', priority: 0 }),
      makeResource({ id: 2, name: 'free.txt' }),
    ]);
    const { container } = render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByTestId('resource-card-2')).toBeInTheDocument());
    pickFile(0, new File(['a\n'], 'fresh.txt', { type: 'text/plain' }));
    await waitFor(() => expect(container.querySelector('[data-cell-id^="import-job-"]')).not.toBeNull());
    const jobRow = container.querySelector('[data-cell-id^="import-job-"]')!;
    const card1 = screen.getByTestId('resource-card-1');
    const card2 = screen.getByTestId('resource-card-2');
    // New resource lands first among no-priority rows — the pending row sits
    // between the prioritized card and the first unprioritized card.
    expect(card1.compareDocumentPosition(jobRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(jobRow.compareDocumentPosition(card2) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('refreshes the list when an import job gains a resourceId', async () => {
    listResources.mockResolvedValue([]);
    const view = render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('No resources yet.')).toBeInTheDocument());
    const callsAfterMount = listResources.mock.calls.length;

    setRegistryJobs([makeJob({
      id: 'imp-1',
      kind: 'resource-import',
      status: 'running',
      label: 'big.json',
      resourceId: 42,
      params: { langCode: 'en' },
    })]);
    view.rerender(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(listResources.mock.calls.length).toBeGreaterThan(callsAfterMount));
  });

  it('excludes unfinished resources from select-all and bulk edit', async () => {
    listResources.mockResolvedValue([
      makeResource({ id: 1, name: 'a.txt' }),
      makeResource({ id: 2, name: 'importing.txt', installationFinished: false }),
    ]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByTestId('resource-card-2')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('edit-resources'));
    expect(screen.getByText('0 of 1 selected')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('select-all-resources'));
    expect(screen.getByText('1 of 1 selected')).toBeInTheDocument();
    expect(screen.queryByTestId('check-2')).not.toBeInTheDocument();
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
      expect(reorderResourcesMock).toHaveBeenCalledWith('en', [2, 3, 1]),
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

  it('Escape cancels the drag session without popping the panel layer', async () => {
    mockReducedMotion();
    const panelLayer = jest.fn();
    const unregisterPanelLayer = pushEscapeLayer(panelLayer);
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
    expect(panelLayer).not.toHaveBeenCalled();
    unregisterPanelLayer();
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
      expect(reorderResourcesMock).toHaveBeenCalledWith('en', [1, 2]);
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
    fireEvent.click(screen.getByTestId('edit-resources'));
    expect(screen.queryByTestId('drag-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('drag-2')).not.toBeInTheDocument();
  });
});

describe('ResourcesPanel — import flow hardening', () => {
  it('starts a lone file larger than the in-flight byte bound', async () => {
    const big = new File(['x'], 'huge.db');
    Object.defineProperty(big, 'size', { value: 300 * 1024 * 1024 });
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Add resource')).toBeInTheDocument());
    pickFile(0, big);
    await waitFor(() => expect(importFile).toHaveBeenCalledTimes(1));
  });

  it('shows an error row when signature computation fails instead of silently dropping', async () => {
    const { computeSignature } = jest.requireMock<typeof import('@/features/dictionary/logic/signatureGenerator')>(
      '@/features/dictionary/logic/signatureGenerator',
    );
    (computeSignature as jest.Mock).mockRejectedValueOnce(new Error('no subtle crypto'));
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Add resource')).toBeInTheDocument());
    pickFile(0, new File(['a\n'], 'plain.txt', { type: 'text/plain' }));
    await waitFor(() => expect(screen.getByText(/no subtle crypto/)).toBeInTheDocument());
    expect(importFile).not.toHaveBeenCalled();
  });

  it('a queued job keeps its drop-time language after a profile switch', async () => {
    let resolveFirst!: (v: { jobId: string }) => void;
    importFile
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r; }))
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockImplementationOnce(() => new Promise(() => {}));
    const { rerender } = render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Add resource')).toBeInTheDocument());
    pickFiles(0, [
      new File(['a\n'], 'one.txt', { type: 'text/plain' }),
      new File(['b\n'], 'two.txt', { type: 'text/plain' }),
      new File(['c\n'], 'three.txt', { type: 'text/plain' }),
    ]);
    await waitFor(() => expect(importFile).toHaveBeenCalledTimes(2));

    rerender(<ResourcesPanel langCode="ja" />);
    act(() => resolveFirst({ jobId: 'job-1' }));

    await waitFor(() => expect(importFile).toHaveBeenCalledTimes(3));
    const [, opts] = importFile.mock.calls[2] as unknown as [unknown, { langCode: string }];
    expect(opts.langCode).toBe('en');
  });

  it('skips a file already importing in the registry', async () => {
    setRegistryJobs([
      makeJob({
        id: 'imp-existing',
        kind: 'resource-import',
        status: 'running',
        params: { langCode: 'en', signature: 'sig-dup.txt' },
      }),
    ]);
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Add resource')).toBeInTheDocument());
    pickFile(0, new File(['x\n'], 'dup.txt', { type: 'text/plain' }));
    await waitFor(() => expect(screen.getByText(/skipped/i)).toBeInTheDocument());
    expect(importFile).not.toHaveBeenCalled();
  });

  it('dismissing a local error row also dismisses its registry twin', async () => {
    const { dismissJob } = jest.requireMock<typeof import('@/features/jobs')>('@/features/jobs');
    importFile.mockRejectedValueOnce(new Error('boom'));
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Add resource')).toBeInTheDocument());
    pickFile(0, new File(['a\n'], 'bad.txt', { type: 'text/plain' }));
    const dismiss = await screen.findByTestId(/^job-dismiss-/);
    const jobId = dismiss.getAttribute('data-cell-id')!.slice('job-dismiss-'.length);
    fireEvent.click(dismiss);
    await waitFor(() => expect(dismissJob).toHaveBeenCalledWith(jobId));
    expect(screen.queryByText('bad.txt')).not.toBeInTheDocument();
  });

  it('shows one row per dropped file immediately, before detection resolves', async () => {
    const { detectComponents } = jest.requireMock<typeof import('@/features/dictionary/logic/formatDetector')>(
      '@/features/dictionary/logic/formatDetector',
    );
    let resolveDetect!: (v: readonly string[]) => void;
    (detectComponents as jest.Mock).mockImplementation(
      () => new Promise<readonly string[]>((r) => { resolveDetect = r; }),
    );
    importFile.mockImplementation(() => new Promise<{ jobId: string }>(() => {}));
    render(<ResourcesPanel langCode="en" />);
    await waitFor(() => expect(screen.getByText('Add resource')).toBeInTheDocument());
    pickFile(0, new File(['a\n'], 'slow.txt', { type: 'text/plain' }));
    await waitFor(() => expect(screen.getByText('slow.txt')).toBeInTheDocument());
    act(() => resolveDetect(['frequency']));
    await waitFor(() => expect(importFile).toHaveBeenCalledTimes(1));
  });
});
