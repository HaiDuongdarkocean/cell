import { render, screen } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';
import { StatusBadge } from '@/popup/components/StatusBadge';
import type { DownloadStatus } from '@/types/media';

describe('StatusBadge', () => {
  it("renders with 'downloading' status", () => {
    render(<StatusBadge status="downloading" />);
    const badge = screen.getByTestId('status-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toMatch(/downloading/);
  });

  it("renders with 'done' status", () => {
    render(<StatusBadge status="done" />);
    const badge = screen.getByTestId('status-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toMatch(/done/);
  });

  it("renders with 'error' status", () => {
    render(<StatusBadge status="error" />);
    const badge = screen.getByTestId('status-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toMatch(/error/);
  });

  it('displays capitalized status text', () => {
    render(<StatusBadge status="downloading" />);
    const badge = screen.getByTestId('status-badge');
    expect(badge).toHaveTextContent('Downloading');
  });

  it('capitalizes all status variants', () => {
    const cases: Array<[DownloadStatus, string]> = [
      ['queued', 'Queued'],
      ['converting', 'Converting'],
      ['done', 'Done'],
      ['error', 'Error'],
      ['cancelled', 'Cancelled'],
      ['paused', 'Paused'],
    ];
    for (const [status, expected] of cases) {
      const { unmount } = render(<StatusBadge status={status} />);
      expect(screen.getByTestId('status-badge')).toHaveTextContent(expected);
      unmount();
    }
  });
});
