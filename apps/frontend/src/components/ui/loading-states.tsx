"use client";

import { memo } from "react";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

/**
 * Branded spinner with gradient
 */
export const BrandSpinner = memo(function BrandSpinner({
  size = "md",
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  return (
    <div className={`relative ${className}`}>
      <Loader2 className={`${sizeClasses[size]} animate-spin text-primary`} />
      <div
        className={`absolute inset-0 ${sizeClasses[size]} rounded-full gradient-accent blur-lg opacity-30 animate-pulse`}
      />
    </div>
  );
});

/**
 * Full page loading state
 */
export const PageLoader = memo(function PageLoader({
  message = "Loading...",
}: {
  message?: string;
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="relative">
          <BrandSpinner size="lg" />
        </div>
        <p className="text-sm text-muted-foreground animate-pulse">{message}</p>
      </motion.div>
    </div>
  );
});

/**
 * Inline loading state
 */
export const InlineLoader = memo(function InlineLoader({
  text,
}: {
  text: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <BrandSpinner size="sm" />
      <span>{text}</span>
    </div>
  );
});

/**
 * Shimmer skeleton for content placeholders
 */
export const ContentSkeleton = memo(function ContentSkeleton({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-gradient-to-r from-muted via-muted/50 to-muted rounded-md animate-shimmer bg-[length:200%_100%]"
          style={{ width: `${100 - i * 10}%` }}
        />
      ))}
    </div>
  );
});

/**
 * Card skeleton for document/session cards
 */
export const CardSkeleton = memo(function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-gradient-to-r from-muted via-muted/50 to-muted animate-shimmer bg-[length:200%_100%]" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gradient-to-r from-muted via-muted/50 to-muted rounded animate-shimmer bg-[length:200%_100%] w-3/4" />
          <div className="h-3 bg-gradient-to-r from-muted via-muted/50 to-muted rounded animate-shimmer bg-[length:200%_100%] w-1/2" />
        </div>
      </div>
    </div>
  );
});
