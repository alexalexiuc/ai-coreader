import { render } from '@testing-library/react';
import { Spinner } from './Spinner';

describe('Spinner', () => {
  it('defaults to 20x20 size', () => {
    const { container } = render(<Spinner />);
    const svg = container.querySelector('svg');

    expect(svg).toHaveAttribute('height', '20');
    expect(svg).toHaveAttribute('width', '20');
  });
});
