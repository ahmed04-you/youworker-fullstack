'use client';

import * as Select from '@radix-ui/react-select';
import { ChevronDown } from 'lucide-react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

export interface ComboBoxOption {
  value: string;
  label: string;
}

export interface ComboBoxProps extends React.ComponentPropsWithoutRef<typeof Select.Root> {
  /**
   * Options for the select dropdown
   */
  options: ComboBoxOption[];
  /**
   * Placeholder text when no option is selected
   */
  placeholder?: string;
  /**
   * Label for the select (optional)
   */
  label?: string;
}

export const ComboBox = forwardRef<HTMLButtonElement, ComboBoxProps>(
  ({ options, placeholder = 'Select an option', label, value, onValueChange, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label
            className={cn(
              'block mb-[5px]',
              'text-[var(--font-medium)] font-bold',
              'text-[var(--text-settings-title)]'
            )}
          >
            {label}
          </label>
        )}
        <Select.Root value={value} onValueChange={onValueChange} {...props}>
          <Select.Trigger
            ref={ref}
            className={cn(
              // Dimensions
              'min-w-[150px]',
              'w-full',
              'px-[15px] py-[10px]',

              // Visual
              'bg-[var(--bg-control)]',
              'border border-[var(--border-control)]',
              'rounded-[var(--radius-standard)]',

              // Typography
              'text-[var(--font-medium)]',
              'text-[var(--text-color)]',

              // Layout
              'flex justify-between items-center gap-[10px]',
              'cursor-pointer',

              // Focus
              'focus:outline-none',
              'focus:border-[var(--accent-color)]',

              // Transition
              'transition-[border-color] duration-[var(--duration-standard)]'
            )}
            aria-label={label}
          >
            <Select.Value placeholder={placeholder} />
            <Select.Icon>
              <ChevronDown
                className={cn(
                  'w-[20px] h-[20px]',
                  'text-[var(--text-muted)]',
                  'transition-transform duration-[var(--duration-standard)]',
                  'data-[state=open]:rotate-180'
                )}
              />
            </Select.Icon>
          </Select.Trigger>

          <Select.Portal>
            <Select.Content
              className={cn(
                // Position
                'relative z-[1000]',

                // Dimensions
                'w-[var(--radix-select-trigger-width)]',
                'max-h-[300px]',
                'overflow-y-auto',

                // Visual
                'bg-[var(--context-menu-bg)]',
                'border border-[var(--context-menu-frame)]',
                'rounded-[var(--radius-standard)]',
                'shadow-[0_5px_15px_rgba(0,0,0,0.2)]',

                // Spacing
                'mt-[5px]'
              )}
              position="popper"
              sideOffset={5}
            >
              <Select.Viewport>
                {options.map((option) => (
                  <Select.Item
                    key={option.value}
                    value={option.value}
                    className={cn(
                      // Dimensions
                      'px-[15px] py-[10px]',

                      // Typography
                      'text-[var(--font-medium)]',
                      'text-[var(--text-color)]',

                      // Interaction
                      'cursor-pointer',
                      'outline-none',

                      // Hover/Selected
                      'data-[highlighted]:bg-[var(--context-menu-highlight)]',
                      'data-[state=checked]:bg-[var(--context-menu-highlight)]',

                      // Transition
                      'transition-[background] duration-100 ease'
                    )}
                  >
                    <Select.ItemText>{option.label}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </div>
    );
  }
);

ComboBox.displayName = 'ComboBox';
