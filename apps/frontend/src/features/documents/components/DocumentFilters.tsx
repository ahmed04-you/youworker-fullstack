import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Search, X } from 'lucide-react';
import { format } from 'date-fns';
import type { DocumentFilters } from '../types';
import { useDocumentStore } from '../store/document-store';

interface DocumentFiltersProps {
  onFiltersChange?: (filters: DocumentFilters) => void;
}

type DateRange = { start: Date; end: Date } | undefined;

export function DocumentFilters({ onFiltersChange }: DocumentFiltersProps) {
  const { filters, setFilters, resetFilters } = useDocumentStore();
  const [startDate, setStartDate] = useState<Date | undefined>(filters.dateRange?.start);
  const [endDate, setEndDate] = useState<Date | undefined>(filters.dateRange?.end);

  const handleSearchChange = (value: string) => {
    const newFilters = { ...filters, search: value || undefined };
    setFilters(newFilters);
    onFiltersChange?.(newFilters);
  };

  const handleTypeChange = (value: string) => {
    const newFilters = { ...filters, fileType: value || undefined };
    setFilters(newFilters);
    onFiltersChange?.(newFilters);
  };

  const handleSourceChange = (value: string) => {
    const newFilters = { ...filters, source: value as any || undefined };
    setFilters(newFilters);
    onFiltersChange?.(newFilters);
  };

  const handleStatusChange = (value: string) => {
    const newFilters = { ...filters, status: value as any || undefined };
    setFilters(newFilters);
    onFiltersChange?.(newFilters);
  };

  const updateDateRange = () => {
    const newDateRange = startDate && endDate ? { start: startDate, end: endDate } : undefined;
    const newFilters = { ...filters, dateRange: newDateRange };
    setFilters(newFilters);
    onFiltersChange?.(newFilters);
  };

  const handleStartChange = (value: string) => {
    setStartDate(value ? new Date(value) : undefined);
    updateDateRange();
  };

  const handleEndChange = (value: string) => {
    setEndDate(value ? new Date(value) : undefined);
    updateDateRange();
  };

  const handleReset = () => {
    resetFilters();
    setDateRange(undefined);
    onFiltersChange?.({});
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2 items-end">
      {/* Search */}
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search documents..."
          className="pl-10"
          value={filters.search || ''}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
      </div>

      {/* Filters Dropdown or separate selects for mobile/desktop */}
      <div className="flex gap-2">
        <Select value={filters.fileType || ''} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pdf">PDF</SelectItem>
            <SelectItem value="txt">Text</SelectItem>
            <SelectItem value="csv">CSV</SelectItem>
            <SelectItem value="json">JSON</SelectItem>
            <SelectItem value="image">Image</SelectItem>
            <SelectItem value="audio">Audio</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.source || ''} onValueChange={handleSourceChange}>
          <SelectTrigger className="w-[100px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="upload">Upload</SelectItem>
            <SelectItem value="url">URL</SelectItem>
            <SelectItem value="path">Path</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.status || ''} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[100px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ingested">Ingested</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>

        {/* Date Range - Simplified input for now */}
        <Input
          type="date"
          placeholder="Start Date"
          value={startDate ? format(startDate, 'yyyy-MM-dd') : ''}
          onChange={(e) => handleStartChange(e.target.value)}
          className="w-[120px]"
        />
        <Input
          type="date"
          placeholder="End Date"
          value={endDate ? format(endDate, 'yyyy-MM-dd') : ''}
          onChange={(e) => handleEndChange(e.target.value)}
          className="w-[120px]"
        />

        {/* Reset Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            handleReset();
            setStartDate(undefined);
            setEndDate(undefined);
          }}
          className="h-9 px-2"
          title="Reset filters"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}