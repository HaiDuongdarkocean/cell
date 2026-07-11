import { render, screen } from '@testing-library/react';
import { Header } from './Header';

describe('Header', () => {
  it('renders title', () => {
    render(<Header title="Settings" />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders leading and trailing actions', () => {
    render(<Header leading={<button>Back</button>} trailing={<button>Done</button>} title="Title" />);
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });
});
