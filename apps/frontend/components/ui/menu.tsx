'use client';

import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Menu Root - Controls the open/closed state
 */
export const Menu = DropdownMenuPrimitive.Root;

/**
 * Menu Trigger - Button that opens the menu
 */
export const MenuTrigger = DropdownMenuPrimitive.Trigger;

/**
 * Menu Portal - Renders menu content in a portal
 */
export const MenuPortal = DropdownMenuPrimitive.Portal;

/**
 * Menu Content - The main menu container
 */
export const MenuContent = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 5, ...props }, ref) => (
  <MenuPortal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        // Position
        'z-[1000]',

        // Dimensions
        'min-w-[150px]',
        'max-w-[300px]',

        // Visual
        'bg-[var(--context-menu-bg)]',
        'border border-[var(--context-menu-frame)]',
        'rounded-[var(--radius-standard)]',
        'shadow-[0_5px_15px_rgba(0,0,0,0.2)]',

        // Spacing
        'py-[5px]',

        // Animation
        'data-[state=open]:animate-[fadeIn_100ms_ease]',
        'data-[state=closed]:animate-[fadeOut_100ms_ease]',

        className
      )}
      {...props}
    />
  </MenuPortal>
));
MenuContent.displayName = 'MenuContent';

/**
 * Menu Item - Individual menu item
 */
export const MenuItem = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    icon?: React.ReactNode;
  }
>(({ className, children, icon, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      // Dimensions
      'px-[20px] py-[10px]',

      // Layout
      'flex items-center gap-[10px]',

      // Typography
      'text-[var(--font-medium)]',
      'text-[var(--text-color)]',

      // Interaction
      'cursor-pointer',
      'outline-none',

      // Hover/Selected
      'data-[highlighted]:bg-[var(--context-menu-highlight)]',

      // Disabled
      'data-[disabled]:opacity-50',
      'data-[disabled]:cursor-not-allowed',
      'data-[disabled]:bg-transparent',

      // Transition
      'transition-[background] duration-100 ease',

      className
    )}
    {...props}
  >
    {icon && (
      <span className="w-[20px] h-[20px] text-[var(--text-muted)] flex items-center justify-center">
        {icon}
      </span>
    )}
    {children}
  </DropdownMenuPrimitive.Item>
));
MenuItem.displayName = 'MenuItem';

/**
 * Menu Separator - Divider between menu items
 */
export const MenuSeparator = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn(
      'h-[1px]',
      'bg-[var(--border-divider)]',
      'my-[5px]',
      className
    )}
    {...props}
  />
));
MenuSeparator.displayName = 'MenuSeparator';

/**
 * Menu Label - Label for a group of menu items
 */
export const MenuLabel = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      'px-[20px] py-[10px]',
      'text-[var(--font-small)]',
      'text-[var(--text-muted)]',
      'font-bold',
      'uppercase',
      className
    )}
    {...props}
  />
));
MenuLabel.displayName = 'MenuLabel';

/**
 * Menu Group - Group of related menu items
 */
export const MenuGroup = DropdownMenuPrimitive.Group;

/**
 * Menu Sub - Submenu trigger and content
 */
export const MenuSub = DropdownMenuPrimitive.Sub;
export const MenuSubTrigger = DropdownMenuPrimitive.SubTrigger;
export const MenuSubContent = DropdownMenuPrimitive.SubContent;
