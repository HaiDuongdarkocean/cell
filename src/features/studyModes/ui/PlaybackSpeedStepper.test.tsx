import { describe, it, expect, jest } from '@jest/globals';
import { render, fireEvent } from '@testing-library/react';
import type { PlaybackSpeed } from '@/entities/studyMode/types';
import { PlaybackSpeedStepper } from './PlaybackSpeedStepper';

const renderStepper = (value: PlaybackSpeed = 1) => {
  const onChange = jest.fn();
  const utils = render(
    <PlaybackSpeedStepper value={value} onChange={onChange} idPrefix="speed" />,
  );
  return { onChange, ...utils };
};

describe('PlaybackSpeedStepper', () => {
  it('steps through PLAYBACK_SPEEDS and prefixes Tihoka ids', () => {
    const { onChange, container } = renderStepper(1);
    expect(container.querySelector('[data-tihoka-id="speed-stepper"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tihoka-id="speed-value"]')).toHaveTextContent('1×');

    fireEvent.click(container.querySelector('[data-tihoka-id="speed-inc"]')!);
    expect(onChange).toHaveBeenLastCalledWith(1.25);
    fireEvent.click(container.querySelector('[data-tihoka-id="speed-dec"]')!);
    expect(onChange).toHaveBeenLastCalledWith(0.75);
  });

  it('disables the bounds of the speed list', () => {
    const { container, rerender } = renderStepper(0.25);
    expect(container.querySelector('[data-tihoka-id="speed-dec"]')).toBeDisabled();

    rerender(
      <PlaybackSpeedStepper value={10} onChange={jest.fn()} idPrefix="speed" />,
    );
    expect(container.querySelector('[data-tihoka-id="speed-inc"]')).toBeDisabled();
  });

  it('resets to 1× and disables reset while already at 1×', () => {
    const { onChange, container, rerender } = renderStepper(1.5);
    const reset = container.querySelector('[data-tihoka-id="speed-reset"]')!;
    expect(reset).not.toBeDisabled();

    fireEvent.click(reset);
    expect(onChange).toHaveBeenCalledWith(1);

    rerender(
      <PlaybackSpeedStepper value={1} onChange={onChange} idPrefix="speed" />,
    );
    expect(container.querySelector('[data-tihoka-id="speed-reset"]')).toBeDisabled();
  });
});
