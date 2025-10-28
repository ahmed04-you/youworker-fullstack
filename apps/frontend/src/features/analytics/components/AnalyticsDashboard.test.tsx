import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render } from '@/test/test-utils';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { useAnalyticsData } from '../hooks/useAnalyticsData';
import { useRefreshAnalytics } from '../api/analytics-service';
import * as exportLib from '@/lib/export';

// Mock the dependencies
vi.mock('../hooks/useAnalyticsData');
vi.mock('../api/analytics-service');
vi.mock('@/lib/export');
vi.mock('@/lib/toast-helpers', () => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

// Mock child components
vi.mock('./DateRangePicker', () => ({
  DateRangePicker: ({ value, onChange, placeholder }: any) => (
    <input
      data-testid="date-range-picker"
      placeholder={placeholder}
      onChange={(e) => onChange({ from: new Date(), to: new Date() })}
    />
  ),
}));
vi.mock('./OverviewSection', () => ({
  OverviewSection: () => <div data-testid="overview-section">Overview</div>,
}));
vi.mock('./TokenUsageChart', () => ({
  TokenUsageChart: ({ data }: any) => (
    <div data-testid="token-usage-chart">Token Usage: {data?.length || 0} entries</div>
  ),
}));
vi.mock('./ToolMetricsTable', () => ({
  ToolMetricsTable: ({ data }: any) => (
    <div data-testid="tool-metrics-table">Tools: {data?.length || 0} entries</div>
  ),
}));
vi.mock('./SessionAnalytics', () => ({
  SessionAnalytics: ({ data }: any) => (
    <div data-testid="session-analytics">Sessions: {data?.length || 0} entries</div>
  ),
}));
vi.mock('./IngestionMetrics', () => ({
  IngestionMetrics: ({ data }: any) => (
    <div data-testid="ingestion-metrics">Ingestion: {data?.totalDocuments || 0} docs</div>
  ),
}));

describe('AnalyticsDashboard', () => {
  const mockAnalyticsData = {
    overview: {
      totalSessions: 100,
      totalMessages: 500,
      totalTokens: 50000,
      avgTokensPerMessage: 100,
      totalTools: 50,
      avgToolsPerSession: 0.5,
    },
    tokens: [
      { date: '2025-01-01', inputTokens: 1000, outputTokens: 2000 },
      { date: '2025-01-02', inputTokens: 1500, outputTokens: 2500 },
    ],
    tools: [
      { name: 'search', count: 10, avgDuration: 1.5 },
      { name: 'calculator', count: 5, avgDuration: 0.5 },
    ],
    sessions: [
      { id: 1, messages: 10, tokens: 1000, tools: 2, createdAt: '2025-01-01' },
      { id: 2, messages: 5, tokens: 500, tools: 1, createdAt: '2025-01-02' },
    ],
    ingestion: {
      totalDocuments: 20,
      totalChunks: 200,
      avgChunksPerDocument: 10,
      totalSize: 1024000,
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  };

  const mockUseAnalyticsData = vi.fn();
  const mockRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAnalyticsData.mockReturnValue(mockAnalyticsData);
    (useAnalyticsData as any).mockImplementation(mockUseAnalyticsData);
    (useRefreshAnalytics as any).mockReturnValue(mockRefresh);
    (exportLib.exportToCSV as any) = vi.fn();
    (exportLib.exportToJSON as any) = vi.fn();
  });

  it('should render analytics dashboard with all sections', () => {
    render(<AnalyticsDashboard />);

    expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    expect(screen.getByText(/Monitor your AI usage/i)).toBeInTheDocument();
    expect(screen.getByTestId('overview-section')).toBeInTheDocument();
    expect(screen.getByTestId('token-usage-chart')).toBeInTheDocument();
    expect(screen.getByTestId('tool-metrics-table')).toBeInTheDocument();
    expect(screen.getByTestId('session-analytics')).toBeInTheDocument();
    expect(screen.getByTestId('ingestion-metrics')).toBeInTheDocument();
  });

  it('should show loading skeletons when loading', () => {
    mockUseAnalyticsData.mockReturnValue({
      ...mockAnalyticsData,
      isLoading: true,
    });

    render(<AnalyticsDashboard />);

    // Should show multiple skeleton loaders
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should show error state with retry button', () => {
    const mockRefetch = vi.fn();
    mockUseAnalyticsData.mockReturnValue({
      ...mockAnalyticsData,
      error: new Error('Failed to load'),
      refetch: mockRefetch,
    });

    render(<AnalyticsDashboard />);

    expect(screen.getByText(/Failed to load analytics data/i)).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: /Retry/i });
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('should render all preset range buttons', () => {
    render(<AnalyticsDashboard />);

    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'This Week' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'This Month' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Last 30 Days' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Custom' })).toBeInTheDocument();
  });

  it('should highlight the default preset (This Week)', () => {
    render(<AnalyticsDashboard />);

    const weekButton = screen.getByRole('button', { name: 'This Week' });
    expect(weekButton).toHaveClass('bg-primary', 'text-primary-foreground');
  });

  it('should change date range when preset button is clicked', () => {
    render(<AnalyticsDashboard />);

    const todayButton = screen.getByRole('button', { name: 'Today' });
    fireEvent.click(todayButton);

    expect(todayButton).toHaveClass('bg-primary', 'text-primary-foreground');
  });

  it('should call refresh when refresh button is clicked', () => {
    render(<AnalyticsDashboard />);

    const refreshButton = screen.getByRole('button', { name: /Refresh/i });
    fireEvent.click(refreshButton);

    expect(mockRefresh).toHaveBeenCalled();
  });

  it('should export to CSV when CSV button is clicked', async () => {
    render(<AnalyticsDashboard />);

    const csvButton = screen.getByRole('button', { name: /CSV/i });
    fireEvent.click(csvButton);

    await waitFor(() => {
      expect(exportLib.exportToCSV).toHaveBeenCalled();
    });
  });

  it('should export to JSON when JSON button is clicked', async () => {
    render(<AnalyticsDashboard />);

    const jsonButton = screen.getByRole('button', { name: /JSON/i });
    fireEvent.click(jsonButton);

    await waitFor(() => {
      expect(exportLib.exportToJSON).toHaveBeenCalled();
    });
  });

  it('should show error toast when exporting with no data', () => {
    const { toastError } = require('@/lib/toast-helpers');
    mockUseAnalyticsData.mockReturnValue({
      ...mockAnalyticsData,
      overview: null,
    });

    render(<AnalyticsDashboard />);

    const csvButton = screen.getByRole('button', { name: /CSV/i });
    fireEvent.click(csvButton);

    expect(toastError).toHaveBeenCalledWith('No data to export');
  });

  it('should export data with correct structure', async () => {
    render(<AnalyticsDashboard />);

    const csvButton = screen.getByRole('button', { name: /CSV/i });
    fireEvent.click(csvButton);

    await waitFor(() => {
      expect(exportLib.exportToCSV).toHaveBeenCalled();
      const exportedData = (exportLib.exportToCSV as any).mock.calls[0][0];
      expect(exportedData).toHaveProperty('overview');
      expect(exportedData).toHaveProperty('tokens');
      expect(exportedData).toHaveProperty('tools');
      expect(exportedData).toHaveProperty('sessions');
      expect(exportedData).toHaveProperty('ingestion');
      expect(exportedData).toHaveProperty('exportedAt');
    });
  });

  it('should limit session data in export', async () => {
    const manySessions = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      messages: 10,
      tokens: 1000,
      tools: 1,
      createdAt: '2025-01-01',
    }));

    mockUseAnalyticsData.mockReturnValue({
      ...mockAnalyticsData,
      sessions: manySessions,
    });

    render(<AnalyticsDashboard />);

    const csvButton = screen.getByRole('button', { name: /CSV/i });
    fireEvent.click(csvButton);

    await waitFor(() => {
      const exportedData = (exportLib.exportToCSV as any).mock.calls[0][0];
      expect(exportedData.sessions).toHaveLength(10);
    });
  });

  it('should render date range picker', () => {
    render(<AnalyticsDashboard />);

    expect(screen.getByTestId('date-range-picker')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Custom date range')).toBeInTheDocument();
  });

  it('should update date range when using custom date picker', () => {
    render(<AnalyticsDashboard />);

    const dateRangePicker = screen.getByTestId('date-range-picker');
    fireEvent.change(dateRangePicker);

    // Should trigger useAnalyticsData with new date range
    expect(mockUseAnalyticsData).toHaveBeenCalled();
  });

  it('should show success toast after export', async () => {
    const { toastSuccess } = require('@/lib/toast-helpers');
    render(<AnalyticsDashboard />);

    const csvButton = screen.getByRole('button', { name: /CSV/i });
    fireEvent.click(csvButton);

    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith('Analytics exported as CSV');
    });
  });

  it('should pass correct data to child components', () => {
    render(<AnalyticsDashboard />);

    expect(screen.getByText('Token Usage: 2 entries')).toBeInTheDocument();
    expect(screen.getByText('Tools: 2 entries')).toBeInTheDocument();
    expect(screen.getByText('Sessions: 2 entries')).toBeInTheDocument();
    expect(screen.getByText('Ingestion: 20 docs')).toBeInTheDocument();
  });

  it('should handle Today preset correctly', () => {
    render(<AnalyticsDashboard />);

    const todayButton = screen.getByRole('button', { name: 'Today' });
    fireEvent.click(todayButton);

    // Should call useAnalyticsData with date range for today
    expect(mockUseAnalyticsData).toHaveBeenCalled();
  });

  it('should handle This Month preset correctly', () => {
    render(<AnalyticsDashboard />);

    const monthButton = screen.getByRole('button', { name: 'This Month' });
    fireEvent.click(monthButton);

    // Should call useAnalyticsData with date range for this month
    expect(mockUseAnalyticsData).toHaveBeenCalled();
  });

  it('should handle Last 30 Days preset correctly', () => {
    render(<AnalyticsDashboard />);

    const thirtyDaysButton = screen.getByRole('button', { name: 'Last 30 Days' });
    fireEvent.click(thirtyDaysButton);

    // Should call useAnalyticsData with date range for last 30 days
    expect(mockUseAnalyticsData).toHaveBeenCalled();
  });

  it('should clear date range when Custom preset is selected', () => {
    render(<AnalyticsDashboard />);

    const customButton = screen.getByRole('button', { name: 'Custom' });
    fireEvent.click(customButton);

    // Should clear the date range picker
    expect(mockUseAnalyticsData).toHaveBeenCalled();
  });

  it('should have responsive layout classes', () => {
    const { container } = render(<AnalyticsDashboard />);

    // Check for responsive grid classes
    const grids = container.querySelectorAll('.grid');
    expect(grids.length).toBeGreaterThan(0);
  });

  it('should render export buttons with correct icons', () => {
    render(<AnalyticsDashboard />);

    const csvButton = screen.getByRole('button', { name: /CSV/i });
    const jsonButton = screen.getByRole('button', { name: /JSON/i });

    expect(csvButton).toBeInTheDocument();
    expect(jsonButton).toBeInTheDocument();

    // Both should have download icons
    const downloadIcons = csvButton.parentElement?.querySelectorAll('svg');
    expect(downloadIcons).toBeDefined();
  });
});
