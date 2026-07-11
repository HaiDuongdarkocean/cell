import { render } from '@testing-library/react';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('renders with width and height', () => {
    const { container } = render(<Skeleton width={100} height={20} />);
    expect(container.firstChild).toHaveStyle({ width: '100px', height: '20px' });
  });

  it('renders all shapes', () => {
    const shapes = ['circle', 'rounded', 'rect'] as const;
    for (const shape of shapes) {
      const { container, unmount } = render(<Skeleton shape={shape} width={40} height={40} />);
      expect(container.firstChild).toBeInTheDocument();
      unmount();
    }
  });
});
