import { render, screen, act } from '@testing-library/react';
import { SubtitleToast, type ToastItem } from './SubtitleToast';

jest.useFakeTimers();

const toasts: ToastItem[] = [
  { id: '1', message: 'Imported', variant: 'success' },
  { id: '2', message: 'Error', variant: 'error' },
];

describe('SubtitleToast', () => {
  it('renders toast items', () => {
    render(<SubtitleToast toasts={toasts} />);
    expect(screen.getByText('Imported')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getAllByTestId('subtitle-toast')).toHaveLength(2);
  });

  it('calls onRemove after duration', () => {
    const onRemove = jest.fn();
    render(<SubtitleToast toasts={toasts} onRemove={onRemove} />);

    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(onRemove).toHaveBeenCalledWith('1');
    expect(onRemove).toHaveBeenCalledWith('2');
  });
});
