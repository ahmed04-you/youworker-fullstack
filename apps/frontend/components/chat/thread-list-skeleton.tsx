"use client"

import { Skeleton } from "@/components/ui/skeleton"

export function ThreadListSkeleton() {
  const widths = ["w-full", "w-5/6", "w-4/5", "w-full", "w-3/4", "w-5/6", "w-4/5", "w-full"]

  return (
    <div className="space-y-2" role="status" aria-label="Caricamento conversazioni">
      {widths.map((width, i) => (
        <div key={i} className="rounded-xl p-3 h-[68px] flex flex-col justify-center">
          <Skeleton className={`h-4 ${width} mb-2`} />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
      <span className="sr-only">Caricamento delle conversazioni...</span>
    </div>
  )
}
