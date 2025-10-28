import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingButton } from './LoadingButton';

describe('LoadingButton', () => {
  it('should render button with children text', () => {
    render(<LoadingButton>Click me</LoadingButton>);

    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('should not show spinner when not loading', () => {
    render(<LoadingButton isLoading={false}>Submit</LoadingButton>);

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button.querySelector('.animate-spin')).not.toBeInTheDocument();
  });

  it('should show spinner when loading', () => {
    render(<LoadingButton isLoading={true}>Submit</LoadingButton>);

    const button = screen.getByRole('button');
    const spinner = button.querySelector('.animate-spin');

    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass('animate-spin');
  });

  it('should be disabled when loading', () => {
    render(<LoadingButton isLoading={true}>Submit</LoadingButton>);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should not be disabled when not loading', () => {
    render(<LoadingButton isLoading={false}>Submit</LoadingButton>);

    const button = screen.getByRole('button');
    expect(button).not.toBeDisabled();
  });

  it('should show loading text when provided and loading', () => {
    render(
      <LoadingButton isLoading={true} loadingText="Saving...">
        Save
      </LoadingButton>
    );

    expect(screen.getByText('Saving...')).toBeInTheDocument();
    expect(screen.queryByText('Save')).not.toBeInTheDocument();
  });

  it('should show children when not loading even with loadingText', () => {
    render(
      <LoadingButton isLoading={false} loadingText="Saving...">
        Save
      </LoadingButton>
    );

    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.queryByText('Saving...')).not.toBeInTheDocument();
  });

  it('should respect disabled prop when not loading', () => {
    render(<LoadingButton disabled={true}>Submit</LoadingButton>);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should be disabled when both loading and disabled props are true', () => {
    render(<LoadingButton isLoading={true} disabled={true}>Submit</LoadingButton>);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should call onClick when clicked and not loading', () => {
    const handleClick = vi.fn();

    render(<LoadingButton onClick={handleClick}>Click me</LoadingButton>);

    const button = screen.getByRole('button');
    button.click();

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should not call onClick when disabled by loading', () => {
    const handleClick = vi.fn();

    render(
      <LoadingButton isLoading={true} onClick={handleClick}>
        Click me
      </LoadingButton>
    );

    const button = screen.getByRole('button');
    button.click();

    // Button is disabled, so onClick should not fire
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should forward additional button props', () => {
    render(
      <LoadingButton
        type="submit"
        className="custom-class"
        data-testid="custom-button"
      >
        Submit
      </LoadingButton>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toHaveAttribute('data-testid', 'custom-button');
    expect(button).toHaveClass('custom-class');
  });

  it('should support different button variants', () => {
    render(
      <LoadingButton variant="destructive">Delete</LoadingButton>
    );

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('should support different button sizes', () => {
    render(
      <LoadingButton size="lg">Large Button</LoadingButton>
    );

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('should render spinner with correct size', () => {
    render(<LoadingButton isLoading={true}>Submit</LoadingButton>);

    const button = screen.getByRole('button');
    const spinner = button.querySelector('.animate-spin');

    expect(spinner).toHaveClass('h-4', 'w-4');
  });

  it('should have correct margin on spinner', () => {
    render(<LoadingButton isLoading={true}>Submit</LoadingButton>);

    const button = screen.getByRole('button');
    const spinner = button.querySelector('.animate-spin');

    expect(spinner).toHaveClass('mr-2');
  });

  it('should maintain button structure with spinner and text', () => {
    const { container } = render(
      <LoadingButton isLoading={true} loadingText="Processing">
        Submit
      </LoadingButton>
    );

    const button = container.querySelector('button');
    expect(button?.querySelector('.animate-spin')).toBeInTheDocument();
    expect(button?.textContent).toContain('Processing');
  });
});
