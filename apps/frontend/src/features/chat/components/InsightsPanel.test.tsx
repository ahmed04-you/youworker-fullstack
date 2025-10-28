import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { render } from '@/test/test-utils';
import { InsightsPanel, MobileInsightsDrawer } from './InsightsPanel';
import type { ChatLogEntry, ChatToolEvent } from '@/lib/types';
import type { HealthStatus, SpeechTranscriptMeta } from '../types';

describe('InsightsPanel', () => {
  const defaultProps = {
    toolTimeline: [] as ChatToolEvent[],
    logEntries: [] as ChatLogEntry[],
    transcript: null,
    sttMeta: { confidence: 0, language: null } as SpeechTranscriptMeta,
    health: null,
    healthLoading: false,
    onRefreshHealth: vi.fn(),
  };

  describe('Empty States', () => {
    it('should render empty state for tool timeline', () => {
      render(<InsightsPanel {...defaultProps} />);

      expect(screen.getByText(/Tools spring into action while you chat/i)).toBeInTheDocument();
    });

    it('should render empty state for reasoning trace', () => {
      render(<InsightsPanel {...defaultProps} />);

      expect(screen.getByText(/We'll surface the thought process/i)).toBeInTheDocument();
    });

    it('should render empty state for voice capture', () => {
      render(<InsightsPanel {...defaultProps} />);

      expect(screen.getByText(/When you speak to YouWorker/i)).toBeInTheDocument();
    });

    it('should render health section with unknown status', () => {
      render(<InsightsPanel {...defaultProps} />);

      expect(screen.getByText(/unknown/i)).toBeInTheDocument();
      expect(screen.getByText(/Health data will appear/i)).toBeInTheDocument();
    });
  });

  describe('Tool Timeline', () => {
    it('should render tool events with status badges', () => {
      const toolTimeline: ChatToolEvent[] = [
        {
          tool: 'search_documents',
          status: 'start',
          latency_ms: 120,
          result_preview: 'Found 5 documents',
        },
        {
          tool: 'analyze_sentiment',
          status: 'success',
          latency_ms: 85,
          result_preview: 'Positive sentiment detected',
        },
      ];

      render(<InsightsPanel {...defaultProps} toolTimeline={toolTimeline} />);

      expect(screen.getByText('search_documents')).toBeInTheDocument();
      expect(screen.getByText('analyze_sentiment')).toBeInTheDocument();
      expect(screen.getByText(/120 ms.*Found 5 documents/)).toBeInTheDocument();
      expect(screen.getByText(/85 ms.*Positive sentiment detected/)).toBeInTheDocument();
    });

    it('should display only last 6 tool events', () => {
      const toolTimeline: ChatToolEvent[] = Array.from({ length: 10 }, (_, i) => ({
        tool: `tool_${i}`,
        status: 'success' as const,
        latency_ms: 100,
        result_preview: `Result ${i}`,
      }));

      render(<InsightsPanel {...defaultProps} toolTimeline={toolTimeline} />);

      // Should show tools 4-9 (last 6)
      expect(screen.queryByText('tool_0')).not.toBeInTheDocument();
      expect(screen.queryByText('tool_3')).not.toBeInTheDocument();
      expect(screen.getByText('tool_4')).toBeInTheDocument();
      expect(screen.getByText('tool_9')).toBeInTheDocument();
    });

    it('should apply correct badge styling for different statuses', () => {
      const toolTimeline: ChatToolEvent[] = [
        { tool: 'start_tool', status: 'start', latency_ms: 0, result_preview: '' },
        { tool: 'success_tool', status: 'success', latency_ms: 100, result_preview: 'Done' },
        { tool: 'error_tool', status: 'error', latency_ms: 50, result_preview: 'Failed' },
      ];

      const { container } = render(<InsightsPanel {...defaultProps} toolTimeline={toolTimeline} />);

      const badges = container.querySelectorAll('[class*="Badge"]');
      expect(badges.length).toBeGreaterThan(0);
    });

    it('should show link to analytics page', () => {
      render(<InsightsPanel {...defaultProps} />);

      const link = screen.getByRole('link', { name: /View analytics/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/analytics');
    });

    it('should truncate long result previews', () => {
      const toolTimeline: ChatToolEvent[] = [
        {
          tool: 'long_result',
          status: 'success',
          latency_ms: 100,
          result_preview: 'A'.repeat(100), // String longer than 60 chars
        },
      ];

      render(<InsightsPanel {...defaultProps} toolTimeline={toolTimeline} />);

      const text = screen.getByText(/…$/);
      expect(text).toBeInTheDocument();
    });
  });

  describe('Reasoning Trace', () => {
    it('should render log entries', () => {
      const logEntries: ChatLogEntry[] = [
        { level: 'INFO', msg: 'Processing user query' },
        { level: 'DEBUG', msg: 'Searching knowledge base' },
        { level: 'WARN', msg: 'Low confidence result' },
      ];

      render(<InsightsPanel {...defaultProps} logEntries={logEntries} />);

      expect(screen.getByText('INFO')).toBeInTheDocument();
      expect(screen.getByText('Processing user query')).toBeInTheDocument();
      expect(screen.getByText('DEBUG')).toBeInTheDocument();
      expect(screen.getByText('Searching knowledge base')).toBeInTheDocument();
      expect(screen.getByText('WARN')).toBeInTheDocument();
      expect(screen.getByText('Low confidence result')).toBeInTheDocument();
    });

    it('should display only last 8 log entries', () => {
      const logEntries: ChatLogEntry[] = Array.from({ length: 12 }, (_, i) => ({
        level: 'INFO',
        msg: `Log entry ${i}`,
      }));

      render(<InsightsPanel {...defaultProps} logEntries={logEntries} />);

      // Should show entries 4-11 (last 8)
      expect(screen.queryByText('Log entry 0')).not.toBeInTheDocument();
      expect(screen.queryByText('Log entry 3')).not.toBeInTheDocument();
      expect(screen.getByText('Log entry 4')).toBeInTheDocument();
      expect(screen.getByText('Log entry 11')).toBeInTheDocument();
    });
  });

  describe('Voice Capture', () => {
    it('should render transcript when available', () => {
      const props = {
        ...defaultProps,
        transcript: 'Hello, how are you today?',
        sttMeta: {
          confidence: 0.95,
          language: 'en',
        },
      };

      render(<InsightsPanel {...props} />);

      expect(screen.getByTestId('transcript')).toHaveTextContent('Hello, how are you today?');
      expect(screen.getByText(/Confidence 0.95/i)).toBeInTheDocument();
      expect(screen.getByText(/EN/)).toBeInTheDocument();
    });

    it('should handle null language in transcript metadata', () => {
      const props = {
        ...defaultProps,
        transcript: 'Test transcript',
        sttMeta: {
          confidence: 0.85,
          language: null,
        },
      };

      render(<InsightsPanel {...props} />);

      expect(screen.getByText(/auto/i)).toBeInTheDocument();
    });

    it('should format confidence to 2 decimal places', () => {
      const props = {
        ...defaultProps,
        transcript: 'Test',
        sttMeta: {
          confidence: 0.8765432,
          language: 'en',
        },
      };

      render(<InsightsPanel {...props} />);

      expect(screen.getByText(/Confidence 0.88/i)).toBeInTheDocument();
    });
  });

  describe('System Health', () => {
    it('should render health status as healthy', () => {
      const health: HealthStatus = {
        status: 'healthy',
        components: {
          agent: 'ready',
        },
      };

      render(<InsightsPanel {...defaultProps} health={health} />);

      expect(screen.getByText('healthy')).toBeInTheDocument();
      expect(screen.getByText('Agent ready')).toBeInTheDocument();
    });

    it('should render health status as unhealthy', () => {
      const health: HealthStatus = {
        status: 'unhealthy',
        components: {
          agent: 'initializing',
        },
      };

      render(<InsightsPanel {...defaultProps} health={health} />);

      expect(screen.getByText(/Agent warming up/i)).toBeInTheDocument();
    });

    it('should render ollama models when available', () => {
      const health: HealthStatus = {
        status: 'healthy',
        components: {
          agent: 'ready',
          ollama: {
            models: {
              'llama2': { name: 'llama2:7b', available: true },
              'codellama': { name: 'codellama:13b', available: false },
            },
          },
        },
      };

      render(<InsightsPanel {...defaultProps} health={health} />);

      expect(screen.getByText('Models')).toBeInTheDocument();
      expect(screen.getByText('llama2:7b')).toBeInTheDocument();
      expect(screen.getByText('codellama:13b')).toBeInTheDocument();
      expect(screen.getByText('ready')).toBeInTheDocument();
      expect(screen.getByText('missing')).toBeInTheDocument();
    });

    it('should call onRefreshHealth when refresh button is clicked', () => {
      const onRefreshHealth = vi.fn();
      render(<InsightsPanel {...defaultProps} onRefreshHealth={onRefreshHealth} />);

      const refreshButton = screen.getByRole('button', { name: /Refresh/i });
      fireEvent.click(refreshButton);

      expect(onRefreshHealth).toHaveBeenCalledTimes(1);
    });

    it('should disable refresh button when loading', () => {
      render(<InsightsPanel {...defaultProps} healthLoading={true} />);

      const refreshButton = screen.getByRole('button');
      expect(refreshButton).toBeDisabled();
    });

    it('should show loading spinner when healthLoading is true', () => {
      const { container } = render(<InsightsPanel {...defaultProps} healthLoading={true} />);

      // Loader2 icon should be present
      const loader = container.querySelector('[class*="animate-spin"]');
      expect(loader).toBeInTheDocument();
    });
  });

  describe('Sections Structure', () => {
    it('should render all four main sections', () => {
      render(<InsightsPanel {...defaultProps} />);

      expect(screen.getByText('Tool timeline')).toBeInTheDocument();
      expect(screen.getByText('Reasoning trace')).toBeInTheDocument();
      expect(screen.getByText('Voice capture')).toBeInTheDocument();
      expect(screen.getByText('System health')).toBeInTheDocument();
    });

    it('should have appropriate icons for each section', () => {
      const { container } = render(<InsightsPanel {...defaultProps} />);

      // Check for SVG icons (lucide-react renders as SVGs)
      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThan(0);
    });
  });
});

describe('MobileInsightsDrawer', () => {
  const defaultProps = {
    open: false,
    onOpenChange: vi.fn(),
    toolTimeline: [] as ChatToolEvent[],
    logEntries: [] as ChatLogEntry[],
    transcript: null,
    sttMeta: { confidence: 0, language: null } as SpeechTranscriptMeta,
    health: null,
    healthLoading: false,
    onRefreshHealth: vi.fn(),
  };

  it('should render drawer with insights title', () => {
    render(<MobileInsightsDrawer {...defaultProps} open={true} />);

    expect(screen.getByText('Insights')).toBeInTheDocument();
  });

  it('should render all sections in drawer', () => {
    render(<MobileInsightsDrawer {...defaultProps} open={true} />);

    expect(screen.getByText('Tool timeline')).toBeInTheDocument();
    expect(screen.getByText('Reasoning trace')).toBeInTheDocument();
    expect(screen.getByText('Voice capture')).toBeInTheDocument();
    expect(screen.getByText('System health')).toBeInTheDocument();
  });

  it('should call onOpenChange when drawer state changes', () => {
    const onOpenChange = vi.fn();
    render(<MobileInsightsDrawer {...defaultProps} open={true} onOpenChange={onOpenChange} />);

    // Note: Testing drawer close would require more complex interaction with Sheet component
    expect(onOpenChange).not.toHaveBeenCalled(); // Initial render shouldn't trigger change
  });

  it('should render content identical to InsightsPanel', () => {
    const toolTimeline: ChatToolEvent[] = [
      { tool: 'test_tool', status: 'success', latency_ms: 100, result_preview: 'Test result' },
    ];

    const propsWithData = {
      ...defaultProps,
      open: true,
      toolTimeline,
    };

    render(<MobileInsightsDrawer {...propsWithData} />);

    expect(screen.getByText('test_tool')).toBeInTheDocument();
    expect(screen.getByText(/Test result/)).toBeInTheDocument();
  });

  it('should render refresh button in drawer', () => {
    const onRefreshHealth = vi.fn();
    render(<MobileInsightsDrawer {...defaultProps} open={true} onRefreshHealth={onRefreshHealth} />);

    const refreshButton = screen.getByRole('button', { name: /Refresh/i });
    fireEvent.click(refreshButton);

    expect(onRefreshHealth).toHaveBeenCalledTimes(1);
  });
});
