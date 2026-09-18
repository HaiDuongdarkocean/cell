import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { StepEditor } from './StepEditor';
import type { StudyStep } from '@/entities/studyMode';

const step: StudyStep = {
  subtitle: 'adaptive',
  pause: 'none',
  repeat: 3,
  speed: 1,
  after: 'continue',
};

describe('StepEditor skip group', () => {
  it('renders the skip group only on the first step', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <StepEditor index={0} step={step} onChange={onChange} />,
    );
    expect(screen.getByRole('group', { name: 'Skip' })).toBeInTheDocument();

    rerender(<StepEditor index={1} step={step} onChange={onChange} />);
    expect(screen.queryByRole('group', { name: 'Skip' })).not.toBeInTheDocument();
  });

  it('maps never to undefined and non-i1 to the rule', () => {
    const onChange = jest.fn();
    render(
      <StepEditor index={0} step={{ ...step, skip: 'non-i1' }} onChange={onChange} />,
    );

    fireEvent.click(screen.getByTestId('step-0-skip-never'));
    expect(onChange).toHaveBeenLastCalledWith({ ...step, skip: undefined });

    fireEvent.click(screen.getByTestId('step-0-skip-non-i1'));
    expect(onChange).toHaveBeenLastCalledWith({ ...step, skip: 'non-i1' });
  });
});
