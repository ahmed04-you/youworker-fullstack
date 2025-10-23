"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { useI18n } from "@/lib/i18n"

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error })
    
    // Log error to console in development
    if (typeof window !== 'undefined' && (window as any).__DEV__) {
      console.error('ErrorBoundary caught an error:', error, errorInfo)
    }
    
    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo)
  }

  reset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      
      return <DefaultErrorFallback error={this.state.error} reset={this.reset} />
    }

    return this.props.children
  }
}

function DefaultErrorFallback({ error, reset }: { error?: Error; reset: () => void }) {
  const { t } = useI18n()
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center p-6 text-center">
      <div className="mb-4 rounded-full bg-destructive/10 p-3">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <h2 className="mb-2 text-lg font-semibold">{t("error.boundary.title")}</h2>
      <p className="mb-4 max-w-md text-sm text-muted-foreground">
        {error?.message || t("error.boundary.description")}
      </p>
      <Button onClick={reset} variant="outline" className="gap-2">
        <RefreshCw className="h-4 w-4" />
        {t("error.boundary.retry")}
      </Button>
      {typeof window !== 'undefined' && (window as any).__DEV__ && error && (
        <details className="mt-4 text-left">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            Dettagli errore (sviluppo)
          </summary>
          <pre className="mt-2 overflow-auto text-xs bg-muted p-2 rounded">
            {error.stack}
          </pre>
        </details>
      )}
    </div>
  )
}

// Async error boundary for handling promise rejections
export function AsyncErrorBoundary({ 
  children, 
  fallback 
}: { 
  children: React.ReactNode
  fallback?: React.ReactNode 
}) {
  return (
    <ErrorBoundary 
      fallback={fallback}
      onError={(error) => {
        console.error('Async error:', error)
      }}
    >
      {children}
    </ErrorBoundary>
  )
}
