import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Users, FileText, Clock, Zap, Database } from 'lucide-react';
import { formatTokenCount, formatDuration, formatPercentage, formatNumber } from '../utils/chart-formatters';
import { AnalyticsOverview } from '../types';

interface MetricCardProps {
  title: string;
  value: string | number;
  description: string;
  trend?: number;
  icon?: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
}

const iconMap = {
  sessions: <Users className="h-4 w-4" />,
  tokens: <TrendingUp className="h-4 w-4" />,
  tools: <Zap className="h-4 w-4" />,
  duration: <Clock className="h-4 w-4" />,
  documents: <FileText className="h-4 w-4" />,
  chunks: <Database className="h-4 w-4" />,
};

export const MetricCard = React.memo(function MetricCard({
  title,
  value,
  description,
  trend,
  icon,
  variant = 'default'
}: MetricCardProps) {
  const formattedValue = typeof value === 'number' 
    ? (title.includes('Token') ? formatTokenCount(value) : formatNumber(value))
    : value;

  const trendIcon = trend !== undefined && (
    <div className={`flex items-center gap-1 text-sm ${
      trend >= 0 ? 'text-green-600' : 'text-red-600'
    }`}>
      {trend >= 0 ? '↑' : '↓'}
      {Math.abs(trend)}%
    </div>
  );

  return (
    <Card className={`border-${variant}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon || iconMap[title.toLowerCase() as keyof typeof iconMap]}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formattedValue}</div>
        <CardDescription className="text-xs text-muted-foreground">
          {description}
          {trendIcon}
        </CardDescription>
      </CardContent>
    </Card>
  );
});

// Specialized cards for overview
export function SessionsCard({ data }: { data: Pick<AnalyticsOverview, 'totalSessions'> }) {
  return (
    <MetricCard
      title="Sessions"
      value={data.totalSessions}
      description="Total conversations"
      icon={iconMap.sessions}
    />
  );
}

export function TokensCard({ data }: { data: Pick<AnalyticsOverview, 'totalTokens'> }) {
  return (
    <MetricCard
      title="Tokens Used"
      value={data.totalTokens}
      description="Total tokens consumed"
      icon={iconMap.tokens}
    />
  );
}

export function ToolCallsCard({ data }: { data: Pick<AnalyticsOverview, 'totalToolCalls'> }) {
  return (
    <MetricCard
      title="Tool Calls"
      value={data.totalToolCalls}
      description="AI tool executions"
      icon={iconMap.tools}
    />
  );
}

export function DurationCard({ data }: { data: Pick<AnalyticsOverview, 'avgSessionDuration'> }) {
  return (
    <MetricCard
      title="Avg Duration"
      value={formatDuration(data.avgSessionDuration)}
      description="Average session length"
      icon={iconMap.duration}
    />
  );
}

export function DocumentsCard({ data }: { data: Pick<AnalyticsOverview, 'totalDocuments'> }) {
  return (
    <MetricCard
      title="Documents"
      value={data.totalDocuments}
      description="Uploaded files"
      icon={iconMap.documents}
    />
  );
}

export function ChunksCard({ data }: { data: Pick<AnalyticsOverview, 'totalChunks'> }) {
  return (
    <MetricCard
      title="Chunks"
      value={data.totalChunks}
      description="Processed text chunks"
      icon={iconMap.chunks}
    />
  );
}