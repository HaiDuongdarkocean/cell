import { render, screen } from '@testing-library/react';
import { Portal } from './Portal';

describe('Portal', () => {
  it('renders children into document.body by default', () => {
    render(<Portal>Portaled content</Portal>);
    expect(screen.getByText('Portaled content')).toBeInTheDocument();
    // The portal content lives in document.body, not the render container.
    expect(document.body.lastElementChild?.textContent).toContain('Portaled content');
  });

  it('renders into a custom container when provided', () => {
    const custom = document.createElement('div');
    document.body.appendChild(custom);
    render(<Portal container={custom}>Custom target</Portal>);
    expect(custom.textContent).toContain('Custom target');
    document.body.removeChild(custom);
  });

  it('renders nothing when container is null', () => {
    const { container } = render(<Portal container={null}>Hidden</Portal>);
    expect(container.textContent).not.toContain('Hidden');
  });
});
