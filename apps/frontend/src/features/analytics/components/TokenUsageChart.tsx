import React from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { TokenUsage } from '../types';
import { formatDateForChart, formatTokenCount } from '../utils/chart-formatters';
import { AccessibleChart } from '@/components/AccessibleChart';

interface TokenUsageChartProps {
  data: TokenUsage[];
  height?: number;
}

export function TokenUsageChart({ data, height = 300 }: TokenUsageChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground rounded-md border p-4">
        No token usage data available for the selected period
      </div>
    );
  }

  return (
    <AccessibleChart
      title="Token Usage Over Time"
      description="Line chart showing input, output, and total tokens over time"
      ariaLabel="Line chart showing token usage over time with input, output, and total tokens"
      data={data as any}
      dataKeys={[
        { key: 'date', label: 'Date', format: (v) => formatDateForChart(v) },
        { key: 'totalTokens', label: 'Total Tokens', format: (v) => formatTokenCount(v) },
        { key: 'inputTokens', label: 'Input Tokens', format: (v) => formatTokenCount(v) },
        { key: 'outputTokens', label: 'Output Tokens', format: (v) => formatTokenCount(v) },
      ]}
      chart={
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateForChart}
              label={{ value: 'Date', position: 'insideBottom', offset: -5, fill: '#64748b' }}
            />
            <YAxis
              tickFormatter={formatTokenCount}
              label={{ value: 'Tokens', angle: -90, position: 'insideLeft', fill: '#64748b' }}
            />
            <Tooltip
              labelFormatter={formatDateForChart}
              formatter={(value: number, name: string) => [formatTokenCount(value), name]}
              labelStyle={{ fontWeight: 'bold' }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="totalTokens"
              stroke="#3b82f6"
              name="Total Tokens"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', strokeWidth: 2 }}
              activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2 }}
            />
            <Line
              type="monotone"
              dataKey="inputTokens"
              stroke="#10b981"
              name="Input Tokens"
              strokeWidth={2}
              dot={{ fill: '#10b981', strokeWidth: 2 }}
            />
            <Line
              type="monotone"
              dataKey="outputTokens"
              stroke="#f59e0b"
              name="Output Tokens"
              strokeWidth={2}
              dot={{ fill: '#f59e0b', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      }
    />
  );
}