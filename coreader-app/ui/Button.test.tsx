import { render, screen } from '@testing-library/react';
import { Button } from '@/ui/Button';

describe('Button', () => {
  it('renders a button with its label', () => {
    render(<Button>Upload</Button>);

    expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument();
  });

  it('renders a link when href is provided', () => {
    render(
      <Button href="/library" disabled>
        Library
      </Button>,
    );

    const link = screen.getByRole('link', { name: 'Library' });
    expect(link).toHaveAttribute('href', '/library');
    expect(link).toHaveAttribute('aria-disabled', 'true');
    expect(link).toHaveAttribute('tabIndex', '-1');
  });

  it('shows a spinner when loading', () => {
    const { container } = render(<Button isLoading>Processing</Button>);

    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(screen.queryByText('Processing')).not.toBeInTheDocument();
  });
});
