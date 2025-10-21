"use client"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { useMotionPreference } from "@/lib/hooks/use-motion-preference"

export function DotLoader({ className }: { className?: string }) {
  const prefersReducedMotion = useMotionPreference()

  if (prefersReducedMotion) {
    return (
      <div className={cn("flex items-center gap-1", className)} role="status" aria-label="Caricamento">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-2 w-2 rounded-full bg-primary opacity-70" />
        ))}
      </div>
    )
  }

  return (
    <div className={cn("flex items-center gap-1", className)} role="status" aria-label="Caricamento">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="h-2 w-2 rounded-full bg-primary"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1,
            repeat: Number.POSITIVE_INFINITY,
            delay: i * 0.2,
          }}
        />
      ))}
    </div>
  )
}

export function SpinLoader({ className }: { className?: string }) {
  const prefersReducedMotion = useMotionPreference()

  if (prefersReducedMotion) {
    return (
      <div
        className={cn("h-6 w-6 rounded-full border-2 border-primary border-t-transparent opacity-70", className)}
        role="status"
        aria-label="Caricamento"
      />
    )
  }

  return (
    <motion.div
      className={cn("h-6 w-6 rounded-full border-2 border-primary border-t-transparent", className)}
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        repeat: Number.POSITIVE_INFINITY,
        ease: "linear",
      }}
      role="status"
      aria-label="Caricamento"
    />
  )
}

export function PulseLoader({ className }: { className?: string }) {
  const prefersReducedMotion = useMotionPreference()

  if (prefersReducedMotion) {
    return (
      <div className={cn("h-4 w-4 rounded-full bg-primary opacity-70", className)} role="status" aria-label="Caricamento" />
    )
  }

  return (
    <motion.div
      className={cn("h-4 w-4 rounded-full bg-primary", className)}
      animate={{
        scale: [1, 1.5, 1],
        opacity: [1, 0.5, 1],
      }}
      transition={{
        duration: 1.5,
        repeat: Number.POSITIVE_INFINITY,
        ease: "easeInOut",
      }}
      role="status"
      aria-label="Caricamento"
    />
  )
}
