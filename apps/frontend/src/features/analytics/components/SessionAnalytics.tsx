import React from 'react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer,
  Tooltip 
} from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { SessionStat } from '../types';
import { formatTokenCount, formatDuration } from '../utils/chart-formatters';
import { AccessibleChart } from '@/components/AccessibleChart';

interface SessionAnalyticsProps {
  data: SessionStat[];
  height?: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export function SessionAnalytics({ data, height = 300 }: SessionAnalyticsProps) {
  if (data.length === 0) {
    return (
      <div className="space-y-4">
        <div className="h-[300px] flex items-center justify-center text-muted-foreground rounded-md border p-4">
          No session data available
        </div>
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          <h3 className="text-lg font-medium mb-2">No sessions</h3>
          <p className="text-sm">No sessions in the selected period</p>
        </div>
      </div>
    );
  }

  // Model distribution for pie chart
  const modelDistribution = data.reduce((acc, session) => {
    acc[session.model] = (acc[session.model] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(modelDistribution).map(([model, count]) => ({
    name: model,
    value: count,
  }));

  // Top 5 sessions by tokens
  const topSessions = [...data]
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Model Distribution</h3>
          <AccessibleChart title="Session Model Distribution" description="Pie chart showing distribution of sessions by model">
            <ResponsiveContainer width="100%" height={height}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [value, 'Sessions']} />
              </PieChart>
            </ResponsiveContainer>
          </AccessibleChart>
        </div>

        {/* Top Sessions Table */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Top Sessions by Token Usage</h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Tool Calls</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topSessions.map((session, index) => (
                  <TableRow key={session.sessionId}>
                    <TableCell className="font-medium">
                      <Badge variant="secondary">{session.model}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{formatTokenCount(session.tokens)}</TableCell>
                    <TableCell>{formatDuration(session.duration)}</TableCell>
                    <TableCell>{session.toolCalls}</TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(session.createdAt), 'PPP')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}