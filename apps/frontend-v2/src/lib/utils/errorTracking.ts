interface ErrorContext {
  user?: { id: string; email: string }
  component?: string
  action?: string
  metadata?: Record<string, unknown>
}

class ErrorTracker {
  private static instance: ErrorTracker

  private constructor() {}

  static getInstance(): ErrorTracker {
    if (!ErrorTracker.instance) {
      ErrorTracker.instance = new ErrorTracker()
    }
    return ErrorTracker.instance
  }

  captureError(error: Error, context?: ErrorContext): void {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error:', error)
      console.error('Context:', context)
      return
    }

    // In production, this would send to error tracking service (Sentry, LogRocket, etc.)
    // Example with Sentry:
    // Sentry.captureException(error, {
    //   extra: context,
    // })
  }

  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: ErrorContext): void {
    if (process.env.NODE_ENV === 'development') {
      console[level](message, context)
      return
    }

    // Send to tracking service in production
  }
}

export const errorTracker = ErrorTracker.getInstance()
