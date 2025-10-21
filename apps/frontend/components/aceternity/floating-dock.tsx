"use client"

import type React from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useMotionPreference } from "@/lib/hooks/use-motion-preference"

interface FloatingDockProps {
  items: {
    title: string
    icon: React.ReactNode
    href: string
  }[]
  className?: string
}

export function FloatingDock({ items, className }: FloatingDockProps) {
  const prefersReducedMotion = useMotionPreference()

  const Container = prefersReducedMotion ? "div" : motion.div

  return (
    <TooltipProvider>
      <Container
        {...(!prefersReducedMotion && {
          initial: { y: 100, opacity: 0 },
          animate: { y: 0, opacity: 1 },
        })}
        className={cn(
          "fixed bottom-8 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-2xl border border-border bg-background/80 px-4 py-3 shadow-lg backdrop-blur-md",
          className,
        )}
        role="navigation"
        aria-label="Quick navigation"
      >
        {items.map((item, idx) => (
          <Tooltip key={idx}>
            <TooltipTrigger asChild>
              <Link
                href={item.href}
                className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors hover:bg-accent"
                aria-label={item.title}
              >
                {item.icon}
              </Link>
            </TooltipTrigger>
            <TooltipContent>
              <p>{item.title}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </Container>
    </TooltipProvider>
  )
}
