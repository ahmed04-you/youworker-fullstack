"use client"

import {
  lazy,
  Suspense,
  ComponentType,
  useState,
  useRef,
  useEffect,
  type ReactNode,
} from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface DynamicImportProps {
  loader: () => Promise<{ default: ComponentType<any> }>
  fallback?: ReactNode
  className?: string
}

export function DynamicImport({ 
  loader, 
  fallback, 
  className 
}: DynamicImportProps) {
  const LazyComponent = lazy(loader)
  
  return (
    <Suspense 
      fallback={
        fallback || (
          <div className={cn("flex items-center justify-center p-8", className)}>
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2 text-sm text-muted-foreground">Caricamento...</span>
          </div>
        )
      }
    >
      <LazyComponent />
    </Suspense>
  )
}

// Predefined dynamic imports for common components
export const DynamicChatComposer = (props: any) => (
  <DynamicImport
    loader={() => import("@/components/chat/chat-composer")}
    className="w-full"
    {...props}
  />
)

export const DynamicChatTranscript = (props: any) => (
  <DynamicImport
    loader={() => import("@/components/chat/chat-transcript")}
    className="flex-1"
    {...props}
  />
)

export const DynamicRightPanel = (props: any) => (
  <DynamicImport
    loader={() => import("@/components/shell/right-panel")}
    className="hidden lg:block"
    {...props}
  />
)

export const DynamicMobileToolSheet = (props: any) => (
  <DynamicImport
    loader={() => import("@/components/shell/mobile-tool-sheet")}
    className="lg:hidden"
    {...props}
  />
)

// Hook for preloading components
export function usePreloadComponent(importPath: string) {
  const preload = () => {
    // Preload the component
    import(importPath).catch(error => {
      console.error(`Failed to preload component: ${importPath}`, error)
    })
  }
  
  return { preload }
}

// Intersection Observer hook for lazy loading
export function useLazyLoad(
  importPath: string,
  options?: IntersectionObserverInit
) {
  const [Component, setComponent] = useState<ComponentType<any> | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const elementRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      async (entries) => {
        const [entry] = entries
        if (entry.isIntersecting && !Component) {
          setIsLoading(true)
          try {
            const resolvedModule = await import(importPath)
            setComponent(() => resolvedModule.default)
          } catch (err) {
            setError(err as Error)
          } finally {
            setIsLoading(false)
          }
        }
      },
      { threshold: 0.1, ...options }
    )
    
    const currentElement = elementRef.current
    if (currentElement) {
      observer.observe(currentElement)
    }
    
    return () => {
      if (currentElement) {
        observer.unobserve(currentElement)
      }
    }
  }, [Component, importPath, options])
  
  return { Component, isLoading, error, elementRef }
}
