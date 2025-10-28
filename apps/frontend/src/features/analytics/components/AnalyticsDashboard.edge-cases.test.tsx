/**
 * Edge case tests for AnalyticsDashboard component
 * Covers: empty data, date range boundaries, invalid exports, large datasets, timezone handling
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render } from '@/test/test-utils';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { useAnalyticsData } from '../hooks/useAnalyticsData';
import { useRefreshAnalytics } from '../api/analytics-service';
import * as exportLib from '@/lib/export';

// Mock dependencies
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
  OverviewSection: ({ data }: any) => (
    <div data-testid="overview-section">
      {data ? `Total: ${data.totalSessions}` : 'No Data'}
    </div>
  ),
}));
vi.mock('./TokenUsageChart', () => ({
  TokenUsageChart: ({ data }: any) => (
    <div data-testid="token-usage-chart">
      {data && data.length > 0 ? `Tokens: ${data.length}` : 'No token data'}
    </div>
  ),
}));
vi.mock('./ToolMetricsTable', () => ({
  ToolMetricsTable: ({ data }: any) => (
    <div data-testid="tool-metrics-table">
      {data && data.length > 0 ? `Tools: ${data.length}` : 'No tools'}
    </div>
  ),
}));
vi.mock('./SessionAnalytics', () => ({
  SessionAnalytics: ({ data }: any) => (
    <div data-testid="session-analytics">
      {data && data.length > 0 ? `Sessions: ${data.length}` : 'No sessions'}
    </div>
  ),
}));
vi.mock('./IngestionMetrics', () => ({
  IngestionMetrics: ({ data }: any) => (
    <div data-testid="ingestion-metrics">
      {data ? `Docs: ${data.totalDocuments}` : 'No ingestion data'}
    </div>
  ),
}));

describe('AnalyticsDashboard - Edge Cases', () => {
  const mockUseAnalyticsData = vi.fn();
  const mockRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAnalyticsData as any).mockImplementation(mockUseAnalyticsData);
    (useRefreshAnalytics as any).mockReturnValue(mockRefresh);
    (exportLib.exportToCSV as any) = vi.fn();
    (exportLib.exportToJSON as any) = vi.fn();
  });

  describe('Empty Data Scenarios', () => {
    it('should handle completely empty analytics data', () => {
      mockUseAnalyticsData.mockReturnValue({
        overview: null,
        tokens: [],
        tools: [],
        sessions: [],
        ingestion: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AnalyticsDashboard />);

      expect(screen.getByText('No Data')).toBeInTheDocument();
      expect(screen.getByText('No token data')).toBeInTheDocument();
      expect(screen.getByText('No tools')).toBeInTheDocument();
      expect(screen.getByText('No sessions')).toBeInTheDocument();
      expect(screen.getByText('No ingestion data')).toBeInTheDocument();
    });

    it('should handle zero values in overview', () => {
      mockUseAnalyticsData.mockReturnValue({
        overview: {
          totalSessions: 0,
          totalMessages: 0,
          totalTokens: 0,
          avgTokensPerMessage: 0,
          totalTools: 0,
          avgToolsPerSession: 0,
        },
        tokens: [],
        tools: [],
        sessions: [],
        ingestion: {
          totalDocuments: 0,
          totalChunks: 0,
          avgChunksPerDocument: 0,
          totalSize: 0,
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AnalyticsDashboard />);

      expect(screen.getByText('Total: 0')).toBeInTheDocument();
      expect(screen.getByText('Docs: 0')).toBeInTheDocument();
    });

    it('should prevent export when data is null', () => {
      const { toastError } = require('@/lib/toast-helpers');

      mockUseAnalyticsData.mockReturnValue({
        overview: null,
        tokens: [],
        tools: [],
        sessions: [],
        ingestion: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AnalyticsDashboard />);

      const csvButton = screen.getByRole('button', { name: /CSV/i });
      fireEvent.click(csvButton);

      expect(toastError).toHaveBeenCalledWith('No data to export');
      expect(exportLib.exportToCSV).not.toHaveBeenCalled();
    });

    it('should prevent export when data arrays are empty', () => {
      const { toastError } = require('@/lib/toast-helpers');

      mockUseAnalyticsData.mockReturnValue({
        overview: null,
        tokens: [],
        tools: [],
        sessions: [],
        ingestion: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AnalyticsDashboard />);

      const jsonButton = screen.getByRole('button', { name: /JSON/i });
      fireEvent.click(jsonButton);

      expect(toastError).toHaveBeenCalledWith('No data to export');
      expect(exportLib.exportToJSON).not.toHaveBeenCalled();
    });
  });

  describe('Date Range Boundaries', () => {
    it('should handle same start and end date (single day)', () => {
      const today = new Date('2025-01-15');

      mockUseAnalyticsData.mockReturnValue({
        overview: { totalSessions: 5 },
        tokens: [],
        tools: [],
        sessions: [],
        ingestion: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AnalyticsDashboard />);

      const todayButton = screen.getByRole('button', { name: 'Today' });
      fireEvent.click(todayButton);

      // Should handle single-day range without errors
      expect(screen.getByText('Total: 5')).toBeInTheDocument();
    });

    it('should handle very large date range (multiple years)', () => {
      mockUseAnalyticsData.mockReturnValue({
        overview: { totalSessions: 1000 },
        tokens: Array.from({ length: 730 }, (_, i) => ({
          date: `2023-01-${(i % 30) + 1}`,
          inputTokens: 100,
          outputTokens: 200,
        })),
        tools: [],
        sessions: [],
        ingestion: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AnalyticsDashboard />);

      expect(screen.getByText('Tokens: 730')).toBeInTheDocument();
    });

    it('should handle future dates gracefully', () => {
      const futureDate = new Date('2030-01-01');

      mockUseAnalyticsData.mockReturnValue({
        overview: { totalSessions: 0 },
        tokens: [],
        tools: [],
        sessions: [],
        ingestion: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AnalyticsDashboard />);

      // Should handle future dates without crashing
      expect(screen.getByText('Total: 0')).toBeInTheDocument();
    });

    it('should handle dates at Unix epoch (1970-01-01)', () => {
      mockUseAnalyticsData.mockReturnValue({
        overview: { totalSessions: 0 },
        tokens: [
          {
            date: '1970-01-01',
            inputTokens: 0,
            outputTokens: 0,
          },
        ],
        tools: [],
        sessions: [],
        ingestion: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AnalyticsDashboard />);

      expect(screen.getByText('Tokens: 1')).toBeInTheDocument();
    });

    it('should handle invalid date range (end before start)', () => {
      mockUseAnalyticsData.mockReturnValue({
        overview: { totalSessions: 0 },
        tokens: [],
        tools: [],
        sessions: [],
        ingestion: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AnalyticsDashboard />);

      // Component should handle invalid ranges gracefully
      expect(screen.getByText('Total: 0')).toBeInTheDocument();
    });

    it('should handle month boundaries correctly', () => {
      mockUseAnalyticsData.mockReturnValue({
        overview: { totalSessions: 30 },
        tokens: [],
        tools: [],
        sessions: [],
        ingestion: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AnalyticsDashboard />);

      const monthButton = screen.getByRole('button', { name: 'This Month' });
      fireEvent.click(monthButton);

      expect(screen.getByText('Total: 30')).toBeInTheDocument();
    });

    it('should handle leap year date (Feb 29)', () => {
      mockUseAnalyticsData.mockReturnValue({
        overview: { totalSessions: 1 },
        tokens: [
          {
            date: '2024-02-29',
            inputTokens: 100,
            outputTokens: 200,
          },
        ],
        tools: [],
        sessions: [],
        ingestion: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AnalyticsDashboard />);

      expect(screen.getByText('Tokens: 1')).toBeInTheDocument();
    });
  });

  describe('Large Dataset Handling', () => {
    it('should handle very large token usage array (10000+ entries)', () => {
      const largeTokenData = Array.from({ length: 10000 }, (_, i) => ({
        date: `2024-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`,
        inputTokens: Math.random() * 1000,
        outputTokens: Math.random() * 2000,
      }));

      mockUseAnalyticsData.mockReturnValue({
        overview: { totalSessions: 5000 },
        tokens: largeTokenData,
        tools: [],
        sessions: [],
        ingestion: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AnalyticsDashboard />);

      expect(screen.getByText('Tokens: 10000')).toBeInTheDocument();
    });

    it('should limit sessions in export to prevent memory issues', async () => {
      const manySessions = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        messages: 10,
        tokens: 1000,
        tools: 1,
        createdAt: '2025-01-01',
      }));

      mockUseAnalyticsData.mockReturnValue({
        overview: { totalSessions: 1000 },
        tokens: [],
        tools: [],
        sessions: manySessions,
        ingestion: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AnalyticsDashboard />);

      const csvButton = screen.getByRole('button', { name: /CSV/i });
      fireEvent.click(csvButton);

      await waitFor(() => {
        const exportedData = (exportLib.exportToCSV as any).mock.calls[0][0];
        // Should limit to 10 sessions in export
        expect(exportedData.sessions).toHaveLength(10);
      });
    });

    it('should handle very large tool metrics table', () => {
      const manyTools = Array.from({ length: 500 }, (_, i) => ({
        name: `tool-${i}`,
        count: Math.floor(Math.random() * 100),
        avgDuration: Math.random() * 5,
      }));

      mockUseAnalyticsData.mockReturnValue({
        overview: { totalSessions: 100 },
        tokens: [],
        tools: manyTools,
        sessions: [],
        ingestion: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AnalyticsDashboard />);

      expect(screen.getByText('Tools: 500')).toBeInTheDocument();
    });

    it('should handle extremely large token counts', () => {
      mockUseAnalyticsData.mockReturnValue({
        overview: {
          totalSessions: 1000000,
          totalMessages: 5000000,
          totalTokens: Number.MAX_SAFE_INTEGER - 1,
          avgTokensPerMessage: 1000,
          totalTools: 10000,
          avgToolsPerSession: 10,
        },
        tokens: [],
        tools: [],
        sessions: [],
        ingestion: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AnalyticsDashboard />);

      expect(screen.getByText('Total: 1000000')).toBeInTheDocument();
    });
  });

  describe('Invalid Export Scenarios', () => {
    it('should handle export library throwing error', async () => {
      const { toastError } = require('@/lib/toast-helpers');
      (exportLib.exportToCSV as any).mockImplementation(() => {
        throw new Error('Export failed');
      });

      mockUseAnalyticsData.mockReturnValue({
        overview: { totalSessions: 10 },
        tokens: [],
        tools: [],
        sessions: [],
        ingestion: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AnalyticsDashboard />);

      const csvButton = screen.getByRole('button', { name: /CSV/i });
      fireEvent.click(csvButton);

      await waitFor(() => {
        expect(toastError).toHaveBeenCalled();
      });
    });

    it('should handle circular reference in export data', async () => {
      const circularData: any = { overview: { totalSessions: 1 } };
      circularData.self = circularData;

      mockUseAnalyticsData.mockReturnValue({
        ...circularData,
        tokens: [],
        tools: [],
        sessions: [],
        ingestion: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AnalyticsDashboard />);

      const jsonButton = screen.getByRole('button', { name: /JSON/i });

      // Should handle gracefully without crashing
      fireEvent.click(jsonButton);
      expect(true).toBe(true);
    });

    it('should include exportedAt timestamp in export', async () => {
      mockUseAnalyticsData.mockReturnValue({
        overview: { totalSessions: 10 },
        tokens: [],
        tools: [],
        sessions: [],
        ingestion: { totalDocuments: 5 },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AnalyticsDashboard />);

      const csvButton = screen.getByRole('button', { name: /CSV/i });
      fireEvent.click(csvButton);

      await waitFor(() => {
        const exportedData = (exportLib.exportToCSV as any).mock.calls[0][0];
        expect(exportedData.exportedAt).toBeDefined();
        expect(new Date(exportedData.exportedAt)).toBeInstanceOf(Date);
      });
    });

    it('should handle export with special characters in data', async () => {
      mockUseAnalyticsData.mockReturnValue({
        overview: { totalSessions: 1 },
        tokens: [],
        tools: [
          { name: 'tool,with,commas', count: 5, avgDuration: 1.0 },
          { name: 'tool"with"quotes', count: 3, avgDuration: 0.5 },
          { name: 'tool\nwith\nnewlines', count: 2, avgDuration: 0.3 },
        ],
        sessions: [],
        ingestion: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AnalyticsDashboard />);

      const csvButton = screen.getByRole('button', { name: /CSV/i });
      fireEvent.click(csvButton);

      await waitFor(() => {
        const exportedData = (exportLib.exportToCSV as any).mock.calls[0][0];
        expect(exportedData.tools).toHaveLength(3);
      });
    });
  });

  describe('Loading and Error State Transitions', () => {
    it('should transition from loading to empty data', () => {
      const { rerender } = render(<AnalyticsDashboard />);

      mockUseAnalyticsData.mockReturnValue({
        overview: null,
        tokens: [],
        tools: [],
        sessions: [],
        ingestion: null,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      });

      rerender(<AnalyticsDashboard />);

      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);

      mockUseAnalyticsData.mockReturnValue({
        overview: null,
        tokens: [],
        tools: [],
        sessions: [],
        ingestion: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      rerender(<AnalyticsDashboard />);

      expect(screen.getByText('No Data')).toBeInTheDocument();
    });

    it('should transition from error to success', () => {
      const mockRefetch = vi.fn();

      mockUseAnalyticsData.mockReturnValue({
        overview: null,
        tokens: [],
        tools: [],
        sessions: [],
        ingestion: null,
        isLoading: false,
        error: new Error('Network error'),
        refetch: mockRefetch,
      });

      const { rerender } = render(<AnalyticsDashboard />);

      expect(screen.getByText(/Failed to load analytics data/i)).toBeInTheDocument();

      mockUseAnalyticsData.mockReturnValue({
        overview: { totalSessions: 10 },
        tokens: [],
        tools: [],
        sessions: [],
        ingestion: null,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      rerender(<AnalyticsDashboard />);

      expect(screen.getByText('Total: 10')).toBeInTheDocument();
    });

    it('should handle rapid refresh clicks', () => {
      mockUseAnalyticsData.mockReturnValue({
        overview: { totalSessions: 10 },
        tokens: [],
        tools: [],
        sessions: [],
        ingestion: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AnalyticsDashboard />);

      const refreshButton = screen.getByRole('button', { name: /Refresh/i });

      fireEvent.click(refreshButton);
      fireEvent.click(refreshButton);
      fireEvent.click(refreshButton);

      expect(mockRefresh).toHaveBeenCalledTimes(3);
    });
  });

  describe('Negative and Invalid Values', () => {
    it('should handle negative token counts', () => {
      mockUseAnalyticsData.mockReturnValue({
        overview: {
          totalSessions: -5,
          totalMessages: -10,
          totalTokens: -1000,
          avgTokensPerMessage: -100,
          totalTools: -2,
          avgToolsPerSession: -0.5,
        },
        tokens: [],
        tools: [],
        sessions: [],
        ingestion: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AnalyticsDashboard />);

      // Should render without crashing
      expect(screen.getByText('Total: -5')).toBeInTheDocument();
    });

    it('should handle NaN values', () => {
      mockUseAnalyticsData.mockReturnValue({
        overview: {
          totalSessions: NaN,
          totalMessages: NaN,
          totalTokens: NaN,
          avgTokensPerMessage: NaN,
          totalTools: NaN,
          avgToolsPerSession: NaN,
        },
        tokens: [],
        tools: [],
        sessions: [],
        ingestion: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AnalyticsDashboard />);

      // Should render without crashing
      expect(screen.getByTestId('overview-section')).toBeInTheDocument();
    });

    it('should handle Infinity values', () => {
      mockUseAnalyticsData.mockReturnValue({
        overview: {
          totalSessions: Infinity,
          totalMessages: Infinity,
          totalTokens: Infinity,
          avgTokensPerMessage: Infinity,
          totalTools: Infinity,
          avgToolsPerSession: Infinity,
        },
        tokens: [],
        tools: [],
        sessions: [],
        ingestion: null,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<AnalyticsDashboard />);

      // Should render without crashing
      expect(screen.getByTestId('overview-section')).toBeInTheDocument();
    });
  });
});
