import { render, screen } from '@testing-library/react';
import { Badge } from '@/ui/Badge';

describe('Badge', () => {
  it('renders default styles and content', () => {
    render(<Badge>New</Badge>);

    const badge = screen.getByText('New');
    expect(badge).toHaveClass('rounded-full', 'border', 'text-xs');
    expect(badge).toHaveClass('border-slate-700', 'bg-slate-800', 'text-slate-300');
  });

  it('accepts custom classes', () => {
    render(
      <Badge className="text-pink-500" colorClass="bg-yellow-500" sizeClass="px-6">
        Hot
      </Badge>,
    );

    const badge = screen.getByText('Hot');
    expect(badge).toHaveClass('text-pink-500', 'bg-yellow-500', 'px-6');
  });
});
