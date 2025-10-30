"use client";

import { memo, ReactNode } from "react";
import { motion } from "framer-motion";
import { Button } from "./button";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  illustration?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/**
 * Enhanced EmptyState component for displaying empty states across the app
 * Shows an icon with gradient background, title, description, and optional action button
 */
export const EmptyState = memo(function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  illustration,
  children,
  className = "",
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className}`}
    >
      {illustration || (
        <div className="relative mb-6">
          {/* Gradient background glow */}
          <div className="absolute inset-0 gradient-mesh opacity-30 blur-2xl" />

          {/* Icon container */}
          <div className="relative rounded-2xl bg-muted/50 p-6 border border-border/50">
            <Icon className="h-12 w-12 text-muted-foreground" />
          </div>
        </div>
      )}

      <div className="space-y-2 max-w-md">
        <h3 className="text-xl font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>

      {action && (
        <Button
          onClick={action.onClick}
          className="mt-6 rounded-full gradient-accent text-white hover:shadow-lg transition-shadow"
          size="lg"
        >
          {action.icon && <action.icon className="mr-2 h-4 w-4" />}
          {action.label}
        </Button>
      )}

      {children}
    </motion.div>
  );
});
