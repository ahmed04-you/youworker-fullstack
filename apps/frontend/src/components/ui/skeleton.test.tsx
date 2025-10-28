import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton } from './skeleton';

describe('Skeleton', () => {
  it('should render a div element', () => {
    const { container } = render(<Skeleton />);
    const skeleton = container.firstChild;

    expect(skeleton).toBeInTheDocument();
    expect(skeleton?.nodeName).toBe('DIV');
  });

  it('should apply default skeleton classes', () => {
    const { container } = render(<Skeleton />);
    const skeleton = container.firstChild as HTMLElement;

    expect(skeleton).toHaveClass('animate-pulse');
    expect(skeleton).toHaveClass('rounded-md');
    expect(skeleton).toHaveClass('bg-muted');
  });

  it('should merge custom className with default classes', () => {
    const { container } = render(<Skeleton className="h-4 w-full" />);
    const skeleton = container.firstChild as HTMLElement;

    // Should have both default and custom classes
    expect(skeleton).toHaveClass('animate-pulse');
    expect(skeleton).toHaveClass('rounded-md');
    expect(skeleton).toHaveClass('bg-muted');
    expect(skeleton).toHaveClass('h-4');
    expect(skeleton).toHaveClass('w-full');
  });

  it('should forward HTML div props', () => {
    const { container } = render(
      <Skeleton data-testid="custom-skeleton" aria-label="Loading content" />
    );
    const skeleton = container.firstChild as HTMLElement;

    expect(skeleton).toHaveAttribute('data-testid', 'custom-skeleton');
    expect(skeleton).toHaveAttribute('aria-label', 'Loading content');
  });

  it('should apply custom styles', () => {
    const { container } = render(
      <Skeleton style={{ width: '200px', height: '50px' }} />
    );
    const skeleton = container.firstChild as HTMLElement;

    expect(skeleton.style.width).toBe('200px');
    expect(skeleton.style.height).toBe('50px');
  });

  it('should handle custom data attributes', () => {
    const { container } = render(<Skeleton data-variant="card" data-size="large" />);
    const skeleton = container.firstChild as HTMLElement;

    expect(skeleton).toHaveAttribute('data-variant', 'card');
    expect(skeleton).toHaveAttribute('data-size', 'large');
  });

  it('should render multiple skeletons with different sizes', () => {
    const { container } = render(
      <div>
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4 mb-2" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );

    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons).toHaveLength(3);

    // Check each has unique width classes
    expect(skeletons[0]).toHaveClass('w-full');
    expect(skeletons[1]).toHaveClass('w-3/4');
    expect(skeletons[2]).toHaveClass('w-1/2');
  });

  it('should support circular skeleton variant', () => {
    const { container } = render(<Skeleton className="h-12 w-12 rounded-full" />);
    const skeleton = container.firstChild as HTMLElement;

    expect(skeleton).toHaveClass('h-12');
    expect(skeleton).toHaveClass('w-12');
    expect(skeleton).toHaveClass('rounded-full');
  });

  it('should handle onClick and other event handlers', () => {
    const handleClick = vi.fn();
    const { container } = render(<Skeleton onClick={handleClick} />);
    const skeleton = container.firstChild as HTMLElement;

    skeleton.click();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should render without console warnings', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn');

    render(<Skeleton />);

    expect(consoleWarnSpy).not.toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });

  it('should support ref forwarding', () => {
    const ref = vi.fn();

    render(<Skeleton ref={ref} />);

    // ref should be called with the DOM node
    expect(ref).toHaveBeenCalled();
  });
});
