import { ReactNode } from 'react'

export default function AuthLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-gradient-to-br from-slate-deep-darker via-slate-deep-dark to-slate-deep">
      {/* Animated background elements - Brand colors */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-red/8 rounded-full blur-3xl animate-glass-float" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-slate-deep-light/10 rounded-full blur-3xl animate-glass-float" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-brand-red-dark/6 rounded-full blur-3xl animate-glass-float" style={{ animationDelay: '2s' }} />
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex items-center justify-center p-4">
        {children}
      </div>
    </div>
  )
}
