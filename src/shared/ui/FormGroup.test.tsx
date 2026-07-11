import { render, screen } from '@testing-library/react';
import { FormGroup } from './FormGroup';

describe('FormGroup', () => {
  it('renders label and children', () => {
    render(
      <FormGroup label="Group" htmlFor="input">
        <input id="input" />
      </FormGroup>,
    );
    expect(screen.getByText('Group')).toBeInTheDocument();
    expect(screen.getByLabelText('Group')).toBeInTheDocument();
  });

  it('renders children without label', () => {
    render(
      <FormGroup>
        <span>Content</span>
      </FormGroup>,
    );
    expect(screen.getByText('Content')).toBeInTheDocument();
  });
});
