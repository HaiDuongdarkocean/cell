import { render, screen } from '@testing-library/react';
import { ImportProgress } from '@/features/dictionary/ui/ImportProgress';
import type { ImportJob } from '@/features/dictionary/ui/importJobTypes';
import type { ResourceInfo } from '@/entities/dictionary';

function existingResource(installationFinished = true): ResourceInfo {
  return {
    id: 1,
    name: 'Old dict',
    langCode: 'en',
    type: 'DICTIONARY',
    format: 'term-bank',
    signature: 'sig',
    wordCount: 10,
    installationFinished,
    importedAt: 0,
  };
}

function makeJob(overrides: Partial<ImportJob>): ImportJob {
  return {
    jobId: 'job-1',
    file: new File(['x'], 'dict.zip', { type: 'application/zip' }),
    resourceType: 'DICTIONARY',
    signature: 'sig',
    forceReplace: false,
    status: 'queued',
    processed: 0,
    total: 0,
    uploadSent: 0,
    uploadTotal: 0,
    error: null,
    wordCount: null,
    resourceId: null,
    duplicate: null,
    ...overrides,
  };
}

const noop = jest.fn();

describe('ImportProgress', () => {
  it('shows the file name for every state', () => {
    render(<ImportProgress job={makeJob({ status: 'queued' })} onResolveDuplicate={noop} onRerunReplace={noop} />);
    expect(screen.getByText('dict.zip')).toBeInTheDocument();
  });

  it('queued row shows a waiting state', () => {
    render(<ImportProgress job={makeJob({ status: 'queued' })} onResolveDuplicate={noop} onRerunReplace={noop} />);
    expect(screen.getByText('Waiting')).toBeInTheDocument();
  });

  it('uploading row shows upload percent', () => {
    render(<ImportProgress
      job={makeJob({ status: 'uploading', uploadSent: 5, uploadTotal: 10 })}
      onResolveDuplicate={noop}
      onRerunReplace={noop}
    />);
    expect(screen.getAllByText(/50%/).length).toBeGreaterThan(0);
  });

  it('importing row shows exact processed / total entries', () => {
    render(<ImportProgress
      job={makeJob({ status: 'importing', processed: 5000, total: 73643 })}
      onResolveDuplicate={noop}
      onRerunReplace={noop}
    />);
    expect(screen.getByText(/5,000 \/ 73,643 items/)).toBeInTheDocument();
  });

  it('importing row without a known total stays indeterminate', () => {
    render(<ImportProgress
      job={makeJob({ status: 'importing', processed: 42, total: 0 })}
      onResolveDuplicate={noop}
      onRerunReplace={noop}
    />);
    expect(screen.getByText(/42 items/)).toBeInTheDocument();
    expect(screen.queryByText(/\/.*items/)).not.toBeInTheDocument();
  });

  it('success row reports its own word count', () => {
    render(<ImportProgress
      job={makeJob({ status: 'success', wordCount: 73643 })}
      onResolveDuplicate={noop}
      onRerunReplace={noop}
    />);
    expect(screen.getByText(/Added 73,643 words/)).toBeInTheDocument();
  });

  it('error row shows its own message', () => {
    render(<ImportProgress
      job={makeJob({ status: 'error', error: 'File hỏng' })}
      onResolveDuplicate={noop}
      onRerunReplace={noop}
    />);
    expect(screen.getByText('File hỏng')).toBeInTheDocument();
  });

  it('duplicate row offers replace + skip and wires both callbacks', () => {
    const onResolve = jest.fn();
    const job = makeJob({
      status: 'duplicate',
      duplicate: { existing: existingResource() },
    });
    render(<ImportProgress job={job} onResolveDuplicate={onResolve} onRerunReplace={noop} />);
    screen.getByText('Replace').click();
    expect(onResolve).toHaveBeenCalledWith('job-1', 'replace');
    screen.getByText('Skip').click();
    expect(onResolve).toHaveBeenCalledWith('job-1', 'skip');
  });

  it('duplicate row disables replace while the existing resource still imports', () => {
    const job = makeJob({
      status: 'duplicate',
      duplicate: { existing: existingResource(false) },
    });
    render(<ImportProgress job={job} onResolveDuplicate={noop} onRerunReplace={noop} />);
    expect(screen.getByRole('button', { name: 'Replace' })).toBeDisabled();
  });

  it('skipped row offers a "Replace" rerun', () => {
    const onRerun = jest.fn();
    render(<ImportProgress job={makeJob({ status: 'skipped' })} onResolveDuplicate={noop} onRerunReplace={onRerun} />);
    screen.getByText('Replace').click();
    expect(onRerun).toHaveBeenCalledWith('job-1');
  });
});
