import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { IngestionMetric } from '../types';
import { formatNumber } from '../utils/chart-formatters';
import { AccessibleChart } from '@/components/AccessibleChart';
import { FileText, AlertCircle } from 'lucide-react';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface IngestionMetricsProps {
  data: IngestionMetric[];
  height?: number;
}

export function IngestionMetrics({ data, height = 300 }: IngestionMetricsProps) {
  if (data.length === 0) {
    return (
      <div className="space-y-4">
        <div className="h-[300px] flex items-center justify-center text-muted-foreground rounded-md border p-4">
          No ingestion data available
        </div>
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          <FileText className="mx-auto h-12 w-12 mb-4" />
          <h3 className="text-lg font-medium mb-2">No ingestion activity</h3>
          <p className="text-sm">No documents ingested in the selected period</p>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const chartData = data.map((metric) => ({
    date: new Date(metric.date).toLocaleDateString(),
    documents: metric.documentsAdded,
    chunks: metric.chunksAdded,
    errors: metric.errors,
  }));

  // Sources breakdown for table
  const totalSources = data.reduce((acc, metric) => {
    Object.entries(metric.sources).forEach(([source, count]) => {
      acc[source] = (acc[source] || 0) + count;
    });
    return acc;
  }, {} as Record<string, number>);

  const sourcesData = Object.entries(totalSources)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const totalErrors = data.reduce((acc, metric) => acc + metric.errors, 0);
  const errorRate = data.length > 0 ? (totalErrors / data.reduce((acc, m) => acc + m.documentsAdded, 0)) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Ingestion Activity</h3>
          <AccessibleChart
            title="Document Ingestion Metrics"
            description="Bar chart showing documents, chunks, and errors over time"
            ariaLabel="Bar chart showing document ingestion metrics over time"
            data={chartData}
            dataKeys={[
              { key: 'date', label: 'Date' },
              { key: 'documents', label: 'Documents', format: formatNumber },
              { key: 'chunks', label: 'Chunks', format: formatNumber },
              { key: 'errors', label: 'Errors', format: formatNumber },
            ]}
            chart={
              <ResponsiveContainer width="100%" height={height}>
                <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                  <XAxis dataKey="date" />
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    tickFormatter={formatNumber}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickFormatter={formatNumber}
                    stroke="#ef4444"
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [formatNumber(value), name]}
                    labelStyle={{ fontWeight: 'bold' }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="documents"
                    fill="#10b981"
                    name="Documents"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="chunks"
                    fill="#3b82f6"
                    name="Chunks"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="errors"
                    fill="#ef4444"
                    name="Errors"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            }
          />
        </div>

        {/* Sources Table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Source Breakdown</h3>
            <Badge variant={errorRate > 5 ? 'destructive' : 'secondary'}>
              {formatNumber(totalErrors)} errors ({errorRate.toFixed(1)}% rate)
            </Badge>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Documents</TableHead>
                  <TableHead>Percentage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sourcesData.map((sourceData, index) => {
                  const percentage = ((sourceData.count / data.reduce((acc, m) => acc + m.documentsAdded, 0)) * 100).toFixed(1);
                  return (
                    <TableRow key={sourceData.source}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div 
                            className="h-3 w-3 rounded-full" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          {sourceData.source}
                        </div>
                      </TableCell>
                      <TableCell>{formatNumber(sourceData.count)}</TableCell>
                      <TableCell>{percentage}%</TableCell>
                    </TableRow>
                  );
                })}
                {sourcesData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No source data
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}