"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart2, TableIcon } from "lucide-react";

interface ChartDataPoint {
  [key: string]: string | number;
}

interface AccessibleChartProps {
  chart: React.ReactNode;
  data: ChartDataPoint[];
  dataKeys: {
    key: string;
    label: string;
    format?: (value: any) => string;
  }[];
  title: string;
  description?: string;
  ariaLabel: string;
}

export function AccessibleChart({
  chart,
  data,
  dataKeys,
  title,
  description,
  ariaLabel,
}: AccessibleChartProps) {
  const [view, setView] = useState<"chart" | "table">("chart");

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <Tabs value={view} onValueChange={(v) => setView(v as "chart" | "table")}>
          <TabsList className="grid w-[200px] grid-cols-2">
            <TabsTrigger value="chart" className="flex items-center gap-2">
              <BarChart2 className="h-3 w-3" />
              Chart
            </TabsTrigger>
            <TabsTrigger value="table" className="flex items-center gap-2">
              <TableIcon className="h-3 w-3" />
              Table
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {view === "chart" ? (
        <div role="img" aria-label={ariaLabel}>
          {chart}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {dataKeys.map((key) => (
                  <TableHead key={key.key} scope="col">
                    {key.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={dataKeys.length} className="text-center text-sm text-muted-foreground">
                    No data available
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row, index) => (
                  <TableRow key={index}>
                    {dataKeys.map((key) => (
                      <TableCell key={key.key}>
                        {key.format
                          ? key.format(row[key.key])
                          : String(row[key.key])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
