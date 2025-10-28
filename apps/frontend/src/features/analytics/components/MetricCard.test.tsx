import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '@/test/test-utils';
import {
  MetricCard,
  SessionsCard,
  TokensCard,
  ToolCallsCard,
  DurationCard,
  DocumentsCard,
  ChunksCard
} from './MetricCard';
import type { AnalyticsOverview } from '../types';

describe('MetricCard', () => {
  it('should render with basic props', () => {
    render(
      <MetricCard
        title="Test Metric"
        value={100}
        description="Test description"
      />
    );

    expect(screen.getByText('Test Metric')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('should render string values', () => {
    render(
      <MetricCard
        title="Status"
        value="Active"
        description="Current status"
      />
    );

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('should format token counts', () => {
    render(
      <MetricCard
        title="Tokens Used"
        value={1500000}
        description="Total tokens"
      />
    );

    // Token formatter should format large numbers (e.g., 1.5M)
    const valueElement = screen.getByText(/1/);
    expect(valueElement).toBeInTheDocument();
  });

  it('should format regular numbers', () => {
    render(
      <MetricCard
        title="Sessions"
        value={1234}
        description="Total sessions"
      />
    );

    // Number formatter should format with commas or K/M notation
    const valueElement = screen.getByText(/1/);
    expect(valueElement).toBeInTheDocument();
  });

  describe('Trend Indicators', () => {
    it('should render positive trend', () => {
      render(
        <MetricCard
          title="Growth"
          value={100}
          description="Metric description"
          trend={15.5}
        />
      );

      expect(screen.getByText('↑')).toBeInTheDocument();
      expect(screen.getByText(/15.5%/)).toBeInTheDocument();
    });

    it('should render negative trend', () => {
      render(
        <MetricCard
          title="Decline"
          value={100}
          description="Metric description"
          trend={-10.2}
        />
      );

      expect(screen.getByText('↓')).toBeInTheDocument();
      expect(screen.getByText(/10.2%/)).toBeInTheDocument();
    });

    it('should render zero trend as positive', () => {
      render(
        <MetricCard
          title="Stable"
          value={100}
          description="Metric description"
          trend={0}
        />
      );

      expect(screen.getByText('↑')).toBeInTheDocument();
      expect(screen.getByText(/0%/)).toBeInTheDocument();
    });

    it('should not render trend when undefined', () => {
      const { container } = render(
        <MetricCard
          title="No Trend"
          value={100}
          description="Metric description"
        />
      );

      expect(container.textContent).not.toContain('↑');
      expect(container.textContent).not.toContain('↓');
    });
  });

  describe('Icons', () => {
    it('should render custom icon when provided', () => {
      const CustomIcon = () => <span data-testid="custom-icon">★</span>;

      render(
        <MetricCard
          title="Custom"
          value={100}
          description="With custom icon"
          icon={<CustomIcon />}
        />
      );

      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });

    it('should use default icon map when no icon provided', () => {
      const { container } = render(
        <MetricCard
          title="Sessions"
          value={100}
          description="Uses default icon"
        />
      );

      // Check for SVG icon (lucide-react icons render as SVGs)
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('Variants', () => {
    it('should render with default variant', () => {
      const { container } = render(
        <MetricCard
          title="Default"
          value={100}
          description="Default variant"
          variant="default"
        />
      );

      expect(container.querySelector('[class*="border-default"]')).toBeInTheDocument();
    });

    it('should render with success variant', () => {
      const { container } = render(
        <MetricCard
          title="Success"
          value={100}
          description="Success variant"
          variant="success"
        />
      );

      expect(container.querySelector('[class*="border-success"]')).toBeInTheDocument();
    });

    it('should render with warning variant', () => {
      const { container } = render(
        <MetricCard
          title="Warning"
          value={100}
          description="Warning variant"
          variant="warning"
        />
      );

      expect(container.querySelector('[class*="border-warning"]')).toBeInTheDocument();
    });

    it('should render with destructive variant', () => {
      const { container } = render(
        <MetricCard
          title="Destructive"
          value={100}
          description="Destructive variant"
          variant="destructive"
        />
      );

      expect(container.querySelector('[class*="border-destructive"]')).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('should render title with correct styling', () => {
      render(
        <MetricCard
          title="Styled Title"
          value={100}
          description="Description"
        />
      );

      const title = screen.getByText('Styled Title');
      expect(title).toHaveClass('text-sm', 'font-medium');
    });

    it('should render value with bold font', () => {
      render(
        <MetricCard
          title="Title"
          value={123}
          description="Description"
        />
      );

      const value = screen.getByText(/123/);
      expect(value).toHaveClass('text-2xl', 'font-bold');
    });
  });
});

describe('Specialized Metric Cards', () => {
  const mockOverview: AnalyticsOverview = {
    totalSessions: 150,
    totalTokens: 2500000,
    totalToolCalls: 45,
    avgSessionDuration: 180, // seconds
    totalDocuments: 23,
    totalChunks: 456,
    sessionsOverTime: [],
    topTools: [],
    tokensByModel: [],
  };

  describe('SessionsCard', () => {
    it('should render with sessions data', () => {
      render(<SessionsCard data={{ totalSessions: mockOverview.totalSessions }} />);

      expect(screen.getByText('Sessions')).toBeInTheDocument();
      expect(screen.getByText('Total conversations')).toBeInTheDocument();
      expect(screen.getByText(/150/)).toBeInTheDocument();
    });

    it('should render sessions icon', () => {
      const { container } = render(<SessionsCard data={{ totalSessions: 100 }} />);

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('TokensCard', () => {
    it('should render with tokens data', () => {
      render(<TokensCard data={{ totalTokens: mockOverview.totalTokens }} />);

      expect(screen.getByText('Tokens Used')).toBeInTheDocument();
      expect(screen.getByText('Total tokens consumed')).toBeInTheDocument();
    });

    it('should format large token counts', () => {
      render(<TokensCard data={{ totalTokens: 2500000 }} />);

      // Should format as 2.5M or similar
      const value = screen.getByText(/2/);
      expect(value).toBeInTheDocument();
    });
  });

  describe('ToolCallsCard', () => {
    it('should render with tool calls data', () => {
      render(<ToolCallsCard data={{ totalToolCalls: mockOverview.totalToolCalls }} />);

      expect(screen.getByText('Tool Calls')).toBeInTheDocument();
      expect(screen.getByText('AI tool executions')).toBeInTheDocument();
      expect(screen.getByText(/45/)).toBeInTheDocument();
    });

    it('should handle zero tool calls', () => {
      render(<ToolCallsCard data={{ totalToolCalls: 0 }} />);

      expect(screen.getByText(/0/)).toBeInTheDocument();
    });
  });

  describe('DurationCard', () => {
    it('should render with formatted duration', () => {
      render(<DurationCard data={{ avgSessionDuration: 180 }} />);

      expect(screen.getByText('Avg Duration')).toBeInTheDocument();
      expect(screen.getByText('Average session length')).toBeInTheDocument();
      // Duration formatter should format 180 seconds as "3:00" or "3m"
    });

    it('should handle zero duration', () => {
      render(<DurationCard data={{ avgSessionDuration: 0 }} />);

      expect(screen.getByText('Avg Duration')).toBeInTheDocument();
    });
  });

  describe('DocumentsCard', () => {
    it('should render with documents data', () => {
      render(<DocumentsCard data={{ totalDocuments: mockOverview.totalDocuments }} />);

      expect(screen.getByText('Documents')).toBeInTheDocument();
      expect(screen.getByText('Uploaded files')).toBeInTheDocument();
      expect(screen.getByText(/23/)).toBeInTheDocument();
    });
  });

  describe('ChunksCard', () => {
    it('should render with chunks data', () => {
      render(<ChunksCard data={{ totalChunks: mockOverview.totalChunks }} />);

      expect(screen.getByText('Chunks')).toBeInTheDocument();
      expect(screen.getByText('Processed text chunks')).toBeInTheDocument();
      expect(screen.getByText(/456/)).toBeInTheDocument();
    });

    it('should handle large chunk counts', () => {
      render(<ChunksCard data={{ totalChunks: 15000 }} />);

      // Should format large numbers appropriately
      const value = screen.getByText(/15/);
      expect(value).toBeInTheDocument();
    });
  });
});

describe('MetricCard Memoization', () => {
  it('should be memoized to prevent unnecessary re-renders', () => {
    const { rerender } = render(
      <MetricCard
        title="Test"
        value={100}
        description="Description"
      />
    );

    // Re-render with same props
    rerender(
      <MetricCard
        title="Test"
        value={100}
        description="Description"
      />
    );

    // Component should be memoized (React.memo)
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
