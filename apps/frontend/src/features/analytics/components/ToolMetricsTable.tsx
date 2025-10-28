import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ToolMetric } from '../types';
import { formatPercentage, formatTokenCount, formatDuration } from '../utils/chart-formatters';
import { TrendingUp, Zap } from 'lucide-react';

interface ToolMetricsTableProps {
  data: ToolMetric[];
}

export function ToolMetricsTable({ data }: ToolMetricsTableProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground">
        <Zap className="mx-auto h-12 w-12 mb-4" />
        <h3 className="text-lg font-medium mb-2">No tool usage data</h3>
        <p className="text-sm">No tools have been executed in the selected period</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-1/2">Tool</TableHead>
            <TableHead>Calls</TableHead>
            <TableHead>Success Rate</TableHead>
            <TableHead>Avg Duration</TableHead>
            <TableHead>Tokens</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((tool, index) => (
            <TableRow key={tool.toolName || index}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: getColorForTool(tool.toolName) }} />
                  {tool.toolName}
                </div>
              </TableCell>
              <TableCell>{tool.calls}</TableCell>
              <TableCell>
                <Badge variant={tool.successRate > 90 ? 'default' : tool.successRate > 70 ? 'secondary' : 'destructive'}>
                  {formatPercentage(tool.successRate)}
                </Badge>
              </TableCell>
              <TableCell>{formatDuration(tool.avgDuration)}</TableCell>
              <TableCell>{formatTokenCount(tool.totalTokens)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// Helper function for consistent colors (export if needed elsewhere)
function getColorForTool(toolName: string): string {
  const colors = [
    '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
    '#ef4444', '#f97316', '#14b8a6', '#a855f7', '#6366f1'
  ];
  const index = toolName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
}