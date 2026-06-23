import { render, screen, fireEvent } from '@testing-library/react';
import { DownloadButton } from '@/popup/components/DownloadButton';

describe('DownloadButton', () => {
  it('renders with default label "Download" for single variant', () => {
    render(<DownloadButton onClick={jest.fn()} />);
    expect(screen.getByTestId('download-button')).toHaveTextContent('Download');
  });

  it('renders with label "Download All" when variant="all"', () => {
    render(<DownloadButton onClick={jest.fn()} variant="all" />);
    expect(screen.getByTestId('download-button')).toHaveTextContent('Download All');
  });

  it('calls onClick when clicked', () => {
    const onClick = jest.fn();
    render(<DownloadButton onClick={onClick} />);
    fireEvent.click(screen.getByTestId('download-button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', () => {
    const onClick = jest.fn();
    render(<DownloadButton onClick={onClick} disabled />);
    const button = screen.getByTestId('download-button');
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders a custom label when provided', () => {
    render(<DownloadButton onClick={jest.fn()} label="Grab Video" />);
    expect(screen.getByTestId('download-button')).toHaveTextContent('Grab Video');
  });
});
