import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <div className="relative">
        <input
          type={type}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 md:text-sm transition-all",
            className
          )}
          ref={ref}
          {...props}
        />
        {/* Focus glow effect */}
        <div className="absolute inset-0 rounded-md gradient-accent opacity-0 focus-within:opacity-20 blur-xl transition-opacity pointer-events-none" />
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
