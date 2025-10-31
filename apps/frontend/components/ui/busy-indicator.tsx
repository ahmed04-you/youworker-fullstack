import { cn } from '@/lib/utils/cn';

export interface BusyIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Size of the spinner
   * - small: 16px × 16px
   * - medium: 24px × 24px (default)
   * - large: 40px × 40px
   */
  size?: 'small' | 'medium' | 'large';
  /**
   * Custom color for the spinner (optional)
   * Defaults to var(--accent-color)
   */
  color?: string;
}

export const BusyIndicator = ({
  size = 'medium',
  color,
  className,
  ...props
}: BusyIndicatorProps) => {
  const sizeClasses = {
    small: 'w-[16px] h-[16px] border-2',
    medium: 'w-[24px] h-[24px] border-3',
    large: 'w-[40px] h-[40px] border-[3px]',
  }[size];

  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn('inline-block', className)}
      {...props}
    >
      <div
        className={cn(
          // Size
          sizeClasses,

          // Visual
          'border-[var(--bg-lighter-button)]',
          'rounded-full',

          // Animation
          'animate-[rotate_1s_linear_infinite]'
        )}
        style={{
          borderTopColor: color || 'var(--accent-color)',
        }}
      />
      <span className="sr-only">Loading...</span>
    </div>
  );
};
