import { render, screen, fireEvent } from '@testing-library/react';
import { FieldRow, FieldInput } from './FieldRow';

describe('FieldRow', () => {
  it('renders the label and input', () => {
    render(
      <FieldRow label="Target word" testId="target">
        <FieldInput />
      </FieldRow>
    );
    expect(screen.getByText('Target word')).toBeInTheDocument();
    expect(screen.getByTestId('target-row')).toBeInTheDocument();
  });

  it('does not render map select when mappedField is omitted', () => {
    render(
      <FieldRow label="Tags" testId="tags">
        <FieldInput />
      </FieldRow>
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders map select with selected field and options including None', () => {
    render(
      <FieldRow
        label="Target word"
        mappedField="TargetWord"
        availableFields={['TargetWord', 'Sentence']}
        onMapChange={jest.fn()}
        testId="target"
      >
        <FieldInput />
      </FieldRow>
    );
    expect(screen.getByRole('button', { name: 'TargetWord' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('option', { name: 'None' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'TargetWord' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Sentence' })).toBeInTheDocument();
  });

  it('calls onMapChange with the selected field', () => {
    const onMapChange = jest.fn();
    render(
      <FieldRow
        label="Target word"
        mappedField="TargetWord"
        availableFields={['TargetWord', 'Sentence']}
        onMapChange={onMapChange}
      >
        <FieldInput />
      </FieldRow>
    );
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('option', { name: 'Sentence' }));
    expect(onMapChange).toHaveBeenCalledWith('Sentence');
  });

  it('calls onMapChange with empty string when None is selected', () => {
    const onMapChange = jest.fn();
    render(
      <FieldRow
        label="Target word"
        mappedField="TargetWord"
        availableFields={['TargetWord', 'Sentence']}
        onMapChange={onMapChange}
      >
        <FieldInput />
      </FieldRow>
    );
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('option', { name: 'None' }));
    expect(onMapChange).toHaveBeenCalledWith('');
  });
});
