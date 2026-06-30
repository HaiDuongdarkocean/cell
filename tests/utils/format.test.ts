import { describe, it, expect } from '@jest/globals';
import { formatBytes, formatFileSize, formatDuration, phaseToLabel } from '@/entrypoints/popup/utils/format';

describe('formatBytes', () => {
  it('formats 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1048576)).toBe('1.0 MB');
    expect(formatBytes(424 * 1024 * 1024)).toBe('424.0 MB');
  });

  it('formats gigabytes', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB');
  });

  it('handles negative as 0', () => {
    expect(formatBytes(-100)).toBe('0 B');
  });
});

describe('formatFileSize', () => {
  it('returns empty string for undefined', () => {
    expect(formatFileSize(undefined)).toBe('');
  });

  it('returns empty string for 0', () => {
    expect(formatFileSize(0)).toBe('');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(1048576)).toBe('1.0 MB');
  });

  it('formats gigabytes', () => {
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB');
  });
});

describe('formatDuration', () => {
  it('returns empty string for undefined', () => {
    expect(formatDuration(undefined)).toBe('');
  });

  it('returns empty string for 0', () => {
    expect(formatDuration(0)).toBe('');
  });

  it('returns empty string for negative', () => {
    expect(formatDuration(-100)).toBe('');
  });

  it('formats milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms');
  });

  it('formats seconds', () => {
    expect(formatDuration(2500)).toBe('2.5s');
  });
});

describe('phaseToLabel', () => {
  it('returns human-readable labels for known phases', () => {
    expect(phaseToLabel('planning')).toBe('Planning');
    expect(phaseToLabel('transmuxing')).toBe('Converting');
    expect(phaseToLabel('merging')).toBe('Merging');
    expect(phaseToLabel('validating')).toBe('Validating');
    expect(phaseToLabel('done')).toBe('Done');
  });

  it('returns the raw string for unknown phases', () => {
    expect(phaseToLabel('unknown')).toBe('unknown');
  });
});
