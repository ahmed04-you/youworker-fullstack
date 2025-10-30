'use client'

import { Component, ReactNode } from 'react'
import { GlassCard } from '@/src/components/ui/glass/GlassCard'
import { GlassButton } from '@/src/components/ui/glass/GlassButton'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: string
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: { componentStack?: string }) {
    console.error('Error caught by boundary:', error, errorInfo)
    this.setState({
      errorInfo: errorInfo?.componentStack || 'No additional info'
    })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="h-full flex items-center justify-center p-6">
          <GlassCard variant="heavy" className="max-w-md p-8 text-center space-y-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-brand-red/20 to-slate-deep/40 flex items-center justify-center backdrop-blur-glass-md border border-glass-red shadow-glass-red">
              <AlertCircle className="w-8 h-8 text-brand-red-light" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">Something went wrong</h2>
              <p className="text-white/70">
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <details className="text-left">
                <summary className="text-sm text-white/50 cursor-pointer hover:text-white/70 transition-colors">
                  Show error details
                </summary>
                <pre className="mt-2 p-3 rounded-lg bg-slate-deep-darker/50 text-xs text-white/60 overflow-auto max-h-40">
                  {this.state.errorInfo}
                </pre>
              </details>
            )}

            <GlassButton
              variant="primary"
              onClick={this.handleReset}
              icon={<RefreshCw className="w-4 h-4" />}
            >
              Try Again
            </GlassButton>
          </GlassCard>
        </div>
      )
    }

    return this.props.children
  }
}
