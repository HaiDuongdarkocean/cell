import { render, screen, fireEvent } from '@testing-library/react';
import { SubtitleHint } from './SubtitleHint';

describe('SubtitleHint', () => {
  it('renders title and message', () => {
    render(<SubtitleHint title="Drop here" message="SRT / VTT" />);
    expect(screen.getByTestId('subtitle-hint')).toBeInTheDocument();
    expect(screen.getByText('Drop here')).toBeInTheDocument();
    expect(screen.getByText('SRT / VTT')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = jest.fn();
    render(<SubtitleHint onClick={onClick} />);
    fireEvent.click(screen.getByTestId('subtitle-hint'));
    expect(onClick).toHaveBeenCalled();
  });
});
