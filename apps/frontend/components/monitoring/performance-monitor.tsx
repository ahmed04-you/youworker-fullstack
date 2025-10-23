"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, Clock, Cpu, Zap, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

interface PerformanceMetrics {
  fcp: number  // First Contentful Paint
  lcp: number  // Largest Contentful Paint
  fid: number  // First Input Delay
  cls: number  // Cumulative Layout Shift
  ttfb: number  // Time to Interactive
  bundleSize: number  // Bundle size in KB
  loadTime: number  // Page load time in ms
  renderTime: number  // Render time in ms
  memoryUsage: number  // Memory usage in MB
  apiResponseTime: number  // API response time in ms
}

export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fcp: 0,
    lcp: 0,
    fid: 0,
    cls: 0,
    ttfb: 0,
    bundleSize: 0,
    loadTime: 0,
    renderTime: 0,
    memoryUsage: 0,
    apiResponseTime: 0,
  })
  const [isVisible, setIsVisible] = useState(false)
  const [isRecording, setIsRecording] = useState(false)

  // Collect performance metrics
  const collectMetrics = useCallback(() => {
    // Get navigation timing
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    if (navigation) {
      const fcp = navigation.responseStart - navigation.requestStart
      const loadTime = navigation.loadEventEnd - navigation.navigationStart
      
      // Get paint timing
      const paintEntries = performance.getEntriesByType('paint')
      const lcp = paintEntries.length > 0 
        ? Math.max(...paintEntries.map(entry => (entry as PerformancePaintTiming).startTime))
        : 0
      
      // Get layout shift
      const layoutShiftEntries = performance.getEntriesByType('layout-shift')
      const cls = layoutShiftEntries.length > 0
        ? layoutShiftEntries.reduce((sum, entry) => sum + (entry as PerformanceEntry).value, 0)
        : 0
      
      // Get input delay
      const inputEntries = performance.getEntriesByType('first-input')
      const fid = inputEntries.length > 0
        ? Math.max(...inputEntries.map(entry => (entry as PerformanceEventTiming).processingStart - entry.startTime))
        : 0
      
      // Get time to interactive
      const ttfb = navigation.domInteractive - navigation.navigationStart
      
      // Get bundle size (approximate)
      const bundleSize = document.querySelector('html')?.outerHTML.length / 1024 || 0
      
      // Get memory usage
      const memory = (performance as any).memory
      const memoryUsage = memory ? memory.usedJSHeapSize / (1024 * 1024) : 0
      
      setMetrics({
        fcp,
        lcp,
        fid,
        cls,
        ttfb,
        bundleSize,
        loadTime,
        renderTime: 0,
        memoryUsage,
        apiResponseTime: metrics.apiResponseTime,
      })
    }
  }, [metrics.apiResponseTime])

  // Monitor API response time
  const monitorApiResponse = useCallback((responseTime: number) => {
    setMetrics(prev => ({ ...prev, apiResponseTime: responseTime }))
  }, [])

  // Start recording performance metrics
  const startRecording = useCallback(() => {
    setIsRecording(true)
    collectMetrics()
  }, [collectMetrics])

  // Stop recording performance metrics
  const stopRecording = useCallback(() => {
    setIsRecording(false)
  }, [])

  // Get performance grade
  const getPerformanceGrade = useCallback(() => {
    const { fcp, lcp, fid, cls, ttfb } = metrics
    
    // Calculate overall score (0-100)
    let score = 100
    
    // FCP score (40% weight)
    if (fcp > 0) {
      if (fcp < 1000) score -= 10  // Excellent
      else if (fcp < 1800) score -= 5  // Good
      else if (fcp < 3000) score -= 2  // Needs improvement
      else score -= 5  // Poor
    }
    
    // LCP score (25% weight)
    if (lcp > 0) {
      if (lcp < 1200) score -= 8  // Excellent
      else if (lcp < 2500) score -= 4  // Good
      else if (lcp < 4000) score -= 2  // Needs improvement
      else score -= 6  // Poor
    }
    
    // FID score (20% weight)
    if (fid > 0) {
      if (fid < 100) score -= 5  // Excellent
      else if (fid < 300) score -= 3  // Good
      else if (fid < 500) score -= 1  // Needs improvement
      else score -= 5  // Poor
    }
    
    // CLS score (15% weight)
    if (cls > 0) {
      if (cls < 0.1) score -= 5  // Excellent
      else if (cls < 0.25) score -= 3  // Good
      else if (cls < 0.5) score -= 1  // Needs improvement
      else score -= 5  // Poor
    }
    
    // TTFB score (20% weight)
    if (ttfb > 0) {
      if (ttfb < 300) score -= 5  // Excellent
      else if (ttfb < 800) score -= 3  // Good
      else if (ttfb < 1600) score -= 1  // Needs improvement
      else score -= 5  // Poor
    }
    
    // Determine grade
    if (score >= 90) return { grade: 'A', color: 'text-green-600' }
    if (score >= 80) return { grade: 'B', color: 'text-blue-600' }
    if (score >= 70) return { grade: 'C', color: 'text-yellow-600' }
    if (score >= 60) return { grade: 'D', color: 'text-orange-600' }
    return { grade: 'F', color: 'text-red-600' }
  }, [metrics])

  // Format metrics for display
  const formatMetric = (value: number, unit: string) => {
    return `${value.toFixed(2)} ${unit}`
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button
        onClick={() => setIsVisible(!isVisible)}
        variant="outline"
        size="sm"
        className="mb-2"
      >
        {isVisible ? 'Hide Metrics' : 'Show Metrics'}
      </Button>
      
      {isVisible && (
        <Card className="w-80 max-h-96 overflow-auto">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Performance Metrics
              {isRecording && (
                <Badge variant="outline" className="ml-auto">
                  Recording
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Core Web Vitals */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Core Web Vitals</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">FCP:</span>
                  <span className={cn(
                    "font-medium",
                    getPerformanceGrade().color
                  )}>
                    {formatMetric(metrics.fcp, 'ms')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">LCP:</span>
                  <span className={cn(
                    "font-medium",
                    getPerformanceGrade().color
                  )}>
                    {formatMetric(metrics.lcp, 'ms')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">FID:</span>
                  <span className={cn(
                    "font-medium",
                    getPerformanceGrade().color
                  )}>
                    {formatMetric(metrics.fid, 'ms')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">CLS:</span>
                  <span className={cn(
                    "font-medium",
                    getPerformanceGrade().color
                  )}>
                    {metrics.cls.toFixed(3)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">TTFB:</span>
                  <span className={cn(
                    "font-medium",
                    getPerformanceGrade().color
                  )}>
                    {formatMetric(metrics.ttfb, 'ms')}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Performance Grade */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Performance Grade</h4>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Grade:</span>
                <Badge 
                  variant={getPerformanceGrade().grade === 'A' ? 'default' : 'destructive'}
                  className="text-lg font-bold"
                >
                  {getPerformanceGrade().grade}
                </Badge>
              </div>
            </div>
            
            {/* Additional Metrics */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Additional Metrics</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Bundle Size:</span>
                  <span className="font-medium">
                    {formatBytes(metrics.bundleSize * 1024)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Load Time:</span>
                  <span className="font-medium">
                    {formatMetric(metrics.loadTime, 'ms')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Memory Usage:</span>
                  <span className="font-medium">
                    {formatBytes(metrics.memoryUsage * 1024 * 1024)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">API Response:</span>
                  <span className="font-medium">
                    {formatMetric(metrics.apiResponseTime, 'ms')}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={startRecording}
                disabled={isRecording}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Clock className="h-4 w-4" />
                Start Recording
              </Button>
              <Button
                onClick={stopRecording}
                disabled={!isRecording}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Zap className="h-4 w-4" />
                Stop Recording
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Hook for monitoring API performance
export function useApiPerformance() {
  const [responseTime, setResponseTime] = useState<number>(0)
  
  const startTiming = useCallback(() => {
    setResponseTime(performance.now())
  }, [])
  
  const endTiming = useCallback(() => {
    const endTime = performance.now()
    const duration = endTime - responseTime
    setResponseTime(duration)
  }, [responseTime])
  
  return { responseTime, startTiming, endTiming }
}

// Hook for monitoring errors
export function useErrorMonitor() {
  const [errors, setErrors] = useState<Array<{ timestamp: number; message: string; context?: string }>>([])
  
  const logError = useCallback((message: string, context?: string) => {
    setErrors(prev => [...prev, {
      timestamp: Date.now(),
      message,
      context,
    }])
    
    // Log to console in development
    if (typeof window !== 'undefined' && (window as any).__DEV__) {
      console.error('Error:', { message, context })
    }
    
    // Log to monitoring service
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'exception', {
        description: message,
        fatal: false,
        custom_map: { context },
      })
    }
  }, [])
  
  const clearErrors = useCallback(() => {
    setErrors([])
  }, [])
  
  return { errors, logError, clearErrors }
}