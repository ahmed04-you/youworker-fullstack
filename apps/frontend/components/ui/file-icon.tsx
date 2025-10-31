import {
  FileText,
  FileImage,
  FileCode,
  FileSpreadsheet,
  FileArchive,
  File,
  type LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface FileIconProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * File name or extension to determine icon type
   */
  fileName: string;
  /**
   * Size of the icon (default: 40px)
   */
  size?: number;
  /**
   * Custom color for the icon (optional)
   * Defaults to var(--accent-color)
   */
  color?: string;
}

/**
 * Get the appropriate icon based on file extension
 */
const getFileIcon = (fileName: string): LucideIcon => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  // PDF
  if (extension === 'pdf') {
    return FileText;
  }

  // Images
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'ico', 'bmp'].includes(extension)) {
    return FileImage;
  }

  // Code files
  if ([
    'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp',
    'cs', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'scala', 'sh',
    'bash', 'zsh', 'fish', 'html', 'css', 'scss', 'sass', 'less',
    'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'conf'
  ].includes(extension)) {
    return FileCode;
  }

  // Text files
  if (['txt', 'md', 'markdown', 'rst', 'log'].includes(extension)) {
    return FileText;
  }

  // Spreadsheets
  if (['xls', 'xlsx', 'csv', 'tsv', 'ods'].includes(extension)) {
    return FileSpreadsheet;
  }

  // Archives
  if (['zip', 'rar', 'tar', 'gz', '7z', 'bz2', 'xz'].includes(extension)) {
    return FileArchive;
  }

  // Documents
  if (['doc', 'docx', 'odt', 'rtf', 'tex'].includes(extension)) {
    return FileText;
  }

  // Generic/Unknown
  return File;
};

export const FileIcon = ({
  fileName,
  size = 40,
  color,
  className,
  ...props
}: FileIconProps) => {
  const Icon = getFileIcon(fileName);

  return (
    <div
      className={cn('inline-flex items-center justify-center', className)}
      {...props}
    >
      <Icon
        size={size}
        className="text-[var(--accent-color)]"
        style={color ? { color } : undefined}
      />
    </div>
  );
};
