/**
 * Dynamically imported components for code splitting.
 *
 * This reduces the initial bundle size by lazy-loading heavy components
 * only when they're needed.
 */

import dynamic from 'next/dynamic';

// Analytics dashboard (heavy: includes Recharts)
export const AnalyticsDashboard = dynamic(
  () => import('@/app/(shell)/analytics/page'),
  {
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    ),
    ssr: false, // Client-side only due to Recharts
  }
);

// Chat interface (can be SSR'd)
export const ChatTranscript = dynamic(
  () => import('@/components/chat/chat-transcript'),
  {
    loading: () => (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2 mt-2"></div>
          </div>
        ))}
      </div>
    ),
  }
);

// Tool events panel (client-side only, contains animations)
export const ToolEventsPanel = dynamic(
  () => import('@/components/chat/tool-events-panel'),
  {
    loading: () => (
      <div className="animate-pulse space-y-2">
        <div className="h-20 bg-muted rounded"></div>
        <div className="h-20 bg-muted rounded"></div>
      </div>
    ),
    ssr: false,
  }
);

// Settings sheet (modal, client-only)
export const SettingsSheet = dynamic(
  () => import('@/components/shell/settings-sheet'),
  {
    loading: () => null,
    ssr: false,
  }
);

// Voice recorder (requires browser APIs)
export const VoiceRecorder = dynamic(
  () => import('@/components/chat/voice-recorder').then((mod) => ({ default: mod.VoiceRecorder })),
  {
    loading: () => (
      <button disabled className="opacity-50 cursor-not-allowed">
        Loading...
      </button>
    ),
    ssr: false,
  }
);

// Heavy UI components (modals, overlays)
export const IngestModal = dynamic(
  () => import('@/components/ingest/ingest-modal'),
  {
    loading: () => null,
    ssr: false,
  }
);

// Chart components (Recharts is heavy)
export const TokenUsageChart = dynamic(
  () => import('@/components/analytics/token-usage-chart'),
  {
    loading: () => (
      <div className="h-64 bg-muted rounded animate-pulse"></div>
    ),
    ssr: false,
  }
);

export const ToolPerformanceChart = dynamic(
  () => import('@/components/analytics/tool-performance-chart'),
  {
    loading: () => (
      <div className="h-64 bg-muted rounded animate-pulse"></div>
    ),
    ssr: false,
  }
);

/**
 * Usage example:
 *
 * ```tsx
 * import { AnalyticsDashboard } from '@/lib/dynamic-components';
 *
 * function Page() {
 *   return (
 *     <div>
 *       <AnalyticsDashboard />
 *     </div>
 *   );
 * }
 * ```
 */
