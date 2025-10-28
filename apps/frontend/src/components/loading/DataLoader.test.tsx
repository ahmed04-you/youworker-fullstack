import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DataLoader } from './DataLoader';

describe('DataLoader', () => {
  const mockData = { id: 1, name: 'Test Data' };
  const mockSkeleton = <div>Loading skeleton...</div>;
  const mockEmpty = <div>No data available</div>;

  it('should render loading skeleton when isLoading is true', () => {
    render(
      <DataLoader
        isLoading={true}
        data={null}
        skeleton={mockSkeleton}
      >
        {() => <div>Content</div>}
      </DataLoader>
    );

    expect(screen.getByText('Loading skeleton...')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('should render error state when error exists', () => {
    const error = new Error('Failed to fetch data');

    render(
      <DataLoader
        isLoading={false}
        error={error}
        data={null}
        skeleton={mockSkeleton}
      >
        {() => <div>Content</div>}
      </DataLoader>
    );

    expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch data')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('should show error icon in error state', () => {
    const error = new Error('Test error');

    const { container } = render(
      <DataLoader
        isLoading={false}
        error={error}
        data={null}
        skeleton={mockSkeleton}
      >
        {() => <div>Content</div>}
      </DataLoader>
    );

    // Check for the AlertTriangle icon (by looking for the destructive bg class)
    const iconContainer = container.querySelector('.bg-destructive\\/10');
    expect(iconContainer).toBeInTheDocument();
  });

  it('should render retry button when onRetry is provided and error exists', () => {
    const error = new Error('Test error');
    const onRetry = vi.fn();

    render(
      <DataLoader
        isLoading={false}
        error={error}
        data={null}
        skeleton={mockSkeleton}
        onRetry={onRetry}
      >
        {() => <div>Content</div>}
      </DataLoader>
    );

    const retryButton = screen.getByRole('button', { name: /try again/i });
    expect(retryButton).toBeInTheDocument();
  });

  it('should call onRetry when retry button is clicked', () => {
    const error = new Error('Test error');
    const onRetry = vi.fn();

    render(
      <DataLoader
        isLoading={false}
        error={error}
        data={null}
        skeleton={mockSkeleton}
        onRetry={onRetry}
      >
        {() => <div>Content</div>}
      </DataLoader>
    );

    const retryButton = screen.getByRole('button', { name: /try again/i });
    retryButton.click();

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('should not render retry button when onRetry is not provided', () => {
    const error = new Error('Test error');

    render(
      <DataLoader
        isLoading={false}
        error={error}
        data={null}
        skeleton={mockSkeleton}
      >
        {() => <div>Content</div>}
      </DataLoader>
    );

    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('should render empty state when data is null and empty is provided', () => {
    render(
      <DataLoader
        isLoading={false}
        data={null}
        skeleton={mockSkeleton}
        empty={mockEmpty}
      >
        {() => <div>Content</div>}
      </DataLoader>
    );

    expect(screen.getByText('No data available')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('should render nothing when data is null and no empty state provided', () => {
    const { container } = render(
      <DataLoader
        isLoading={false}
        data={null}
        skeleton={mockSkeleton}
      >
        {() => <div>Content</div>}
      </DataLoader>
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render children with data when data exists', () => {
    render(
      <DataLoader
        isLoading={false}
        data={mockData}
        skeleton={mockSkeleton}
      >
        {(data) => <div>Content: {data.name}</div>}
      </DataLoader>
    );

    expect(screen.getByText('Content: Test Data')).toBeInTheDocument();
    expect(screen.queryByText('Loading skeleton...')).not.toBeInTheDocument();
  });

  it('should pass correct data to children render function', () => {
    const renderFn = vi.fn((data) => <div>{data.name}</div>);

    render(
      <DataLoader
        isLoading={false}
        data={mockData}
        skeleton={mockSkeleton}
      >
        {renderFn}
      </DataLoader>
    );

    expect(renderFn).toHaveBeenCalledWith(mockData);
  });

  it('should prioritize loading state over error state', () => {
    const error = new Error('Test error');

    render(
      <DataLoader
        isLoading={true}
        error={error}
        data={mockData}
        skeleton={mockSkeleton}
      >
        {(data) => <div>{data.name}</div>}
      </DataLoader>
    );

    // Should show loading, not error or content
    expect(screen.getByText('Loading skeleton...')).toBeInTheDocument();
    expect(screen.queryByText('Failed to load data')).not.toBeInTheDocument();
    expect(screen.queryByText('Test Data')).not.toBeInTheDocument();
  });

  it('should prioritize error state over empty/data states', () => {
    const error = new Error('Test error');

    render(
      <DataLoader
        isLoading={false}
        error={error}
        data={mockData}
        skeleton={mockSkeleton}
      >
        {(data) => <div>{data.name}</div>}
      </DataLoader>
    );

    // Should show error, not content
    expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    expect(screen.queryByText('Test Data')).not.toBeInTheDocument();
  });

  it('should handle complex data types', () => {
    const complexData = {
      users: [
        { id: 1, name: 'User 1' },
        { id: 2, name: 'User 2' },
      ],
    };

    render(
      <DataLoader
        isLoading={false}
        data={complexData}
        skeleton={mockSkeleton}
      >
        {(data) => (
          <div>
            {data.users.map((user) => (
              <div key={user.id}>{user.name}</div>
            ))}
          </div>
        )}
      </DataLoader>
    );

    expect(screen.getByText('User 1')).toBeInTheDocument();
    expect(screen.getByText('User 2')).toBeInTheDocument();
  });

  it('should display generic error message when error has no message', () => {
    const error = new Error();

    render(
      <DataLoader
        isLoading={false}
        error={error}
        data={null}
        skeleton={mockSkeleton}
      >
        {() => <div>Content</div>}
      </DataLoader>
    );

    expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument();
  });

  it('should handle undefined data correctly', () => {
    render(
      <DataLoader
        isLoading={false}
        data={undefined}
        skeleton={mockSkeleton}
        empty={mockEmpty}
      >
        {(data) => <div>{data}</div>}
      </DataLoader>
    );

    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('should maintain type safety with generic data type', () => {
    type User = { id: number; email: string };
    const userData: User = { id: 1, email: 'test@example.com' };

    render(
      <DataLoader<User>
        isLoading={false}
        data={userData}
        skeleton={mockSkeleton}
      >
        {(data) => <div>Email: {data.email}</div>}
      </DataLoader>
    );

    expect(screen.getByText('Email: test@example.com')).toBeInTheDocument();
  });

  it('should render correctly in all states sequentially', () => {
    // Start with loading
    const { rerender } = render(
      <DataLoader
        isLoading={true}
        data={null}
        skeleton={mockSkeleton}
      >
        {(data) => <div>{data.name}</div>}
      </DataLoader>
    );
    expect(screen.getByText('Loading skeleton...')).toBeInTheDocument();

    // Show error
    const error = new Error('Fetch failed');
    rerender(
      <DataLoader
        isLoading={false}
        error={error}
        data={null}
        skeleton={mockSkeleton}
        onRetry={vi.fn()}
      >
        {(data) => <div>{data.name}</div>}
      </DataLoader>
    );
    expect(screen.getByText('Failed to load data')).toBeInTheDocument();

    // Show data
    rerender(
      <DataLoader
        isLoading={false}
        data={mockData}
        skeleton={mockSkeleton}
      >
        {(data) => <div>{data.name}</div>}
      </DataLoader>
    );
    expect(screen.getByText('Test Data')).toBeInTheDocument();
  });
});
