import React, { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, X } from 'lucide-react';
import type { DocumentFilters } from '../types';
import { useDocumentStore } from '../store/document-store';

interface DocumentFiltersProps {
  onFiltersChange?: (filters: DocumentFilters) => void;
}

export function DocumentFilters({ onFiltersChange }: DocumentFiltersProps) {
  const { filters, setFilters, resetFilters } = useDocumentStore();

  const handleSearchChange = useCallback(
    (value: string) => {
      const newFilters = { ...filters, search: value || undefined };
      setFilters(newFilters);
      onFiltersChange?.(newFilters);
    },
    [filters, setFilters, onFiltersChange]
  );

  const handleTypeChange = useCallback(
    (value: string) => {
      const newFilters = { ...filters, fileType: value || undefined };
      setFilters(newFilters);
      onFiltersChange?.(newFilters);
    },
    [filters, setFilters, onFiltersChange]
  );

  const handleSourceChange = useCallback(
    (value: string) => {
      const newFilters = { ...filters, source: value as any || undefined };
      setFilters(newFilters);
      onFiltersChange?.(newFilters);
    },
    [filters, setFilters, onFiltersChange]
  );

  const handleStatusChange = useCallback(
    (value: string) => {
      const newFilters = { ...filters, status: value as any || undefined };
      setFilters(newFilters);
      onFiltersChange?.(newFilters);
    },
    [filters, setFilters, onFiltersChange]
  );

  const handleReset = useCallback(() => {
    resetFilters();
    onFiltersChange?.({});
  }, [resetFilters, onFiltersChange]);

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

        {/* Reset Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="h-9 px-2"
          title="Reset filters"
          aria-label="Reset filters"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}