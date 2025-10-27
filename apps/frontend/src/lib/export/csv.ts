/**
 * CSV export utilities
 */

/**
 * Converts array of objects to CSV format
 * @param data - Array of objects to convert
 * @returns CSV formatted string
 */
export function arrayToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const headerRow = headers.join(',');

  const rows = data.map((row) =>
    headers
      .map((header) => {
        const value = row[header];
        // Escape commas and quotes
        if (typeof value === 'string') {
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }
        return value;
      })
      .join(',')
  );

  return [headerRow, ...rows].join('\n');
}

/**
 * Triggers a download of CSV content
 * @param filename - Name of the file to download
 * @param data - Array of objects to export
 */
export function downloadCSV(filename: string, data: Record<string, unknown>[]) {
  const csv = arrayToCSV(data);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
