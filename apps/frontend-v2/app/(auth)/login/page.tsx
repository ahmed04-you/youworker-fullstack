'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { GlassCard } from '@/src/components/ui/glass/GlassCard'
import { GlassButton } from '@/src/components/ui/glass/GlassButton'
import { GlassInput } from '@/src/components/ui/glass/GlassInput'
import { Mail, Lock, AlertCircle } from 'lucide-react'
import { login } from '@/src/lib/api/auth'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      await login(email, password)
      router.push('/chat')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please check your credentials.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <GlassCard variant="heavy" className="w-full max-w-md p-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-2xl bg-gradient-brand shadow-glass-red">
          <span className="text-2xl font-bold text-white">Y</span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Welcome back</h1>
        <p className="text-white/50">Sign in to your YouWorker account</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-brand-red/10 border border-brand-red/30">
            <AlertCircle className="w-5 h-5 text-brand-red-light shrink-0 mt-0.5" />
            <p className="text-sm text-white/90">{error}</p>
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-medium text-white/70">
            Email
          </label>
          <GlassInput
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail className="w-4 h-4" />}
            required
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium text-white/70">
            Password
          </label>
          <GlassInput
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={<Lock className="w-4 h-4" />}
            required
            disabled={isLoading}
          />
        </div>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-glass bg-glass-white/10 text-brand-red focus:ring-2 focus:ring-brand-red/50"
            />
            <span className="text-white/70">Remember me</span>
          </label>

          <a href="#" className="text-brand-red-light hover:text-brand-red transition-colors">
            Forgot password?
          </a>
        </div>

        <GlassButton
          type="submit"
          variant="primary"
          className="w-full"
          loading={isLoading}
          disabled={isLoading}
        >
          Sign in
        </GlassButton>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-white/50">
          Don't have an account?{' '}
          <Link href="/register" className="text-brand-red-light hover:text-brand-red transition-colors font-medium">
            Sign up
          </Link>
        </p>
      </div>

      <div className="mt-8 pt-6 border-t border-glass-dark">
        <p className="text-xs text-center text-white/40">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </GlassCard>
  )
}
