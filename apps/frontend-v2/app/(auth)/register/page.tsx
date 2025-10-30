'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { GlassCard } from '@/src/components/ui/glass/GlassCard'
import { GlassButton } from '@/src/components/ui/glass/GlassButton'
import { GlassInput } from '@/src/components/ui/glass/GlassInput'
import { Mail, Lock, User, AlertCircle, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { register } from '@/src/lib/api/auth'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const passwordStrength = {
    hasLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
  }

  const isPasswordValid = Object.values(passwordStrength).every(Boolean)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (!isPasswordValid) {
      setError('Password does not meet the requirements')
      return
    }

    setIsLoading(true)

    try {
      await register(name, email, password)
      // Registration successful, redirect to chat
      router.push('/chat')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.')
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
        <h1 className="text-3xl font-bold text-white mb-2">Create account</h1>
        <p className="text-white/50">Start using YouWorker AI today</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-brand-red/10 border border-brand-red/30">
            <AlertCircle className="w-5 h-5 text-brand-red-light shrink-0 mt-0.5" />
            <p className="text-sm text-white/90">{error}</p>
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="name" className="block text-sm font-medium text-white/70">
            Full Name
          </label>
          <GlassInput
            id="name"
            type="text"
            placeholder="John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            icon={<User className="w-4 h-4" />}
            required
            disabled={isLoading}
          />
        </div>

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

          {password && (
            <div className="mt-2 space-y-1">
              <PasswordRequirement met={passwordStrength.hasLength}>
                At least 8 characters
              </PasswordRequirement>
              <PasswordRequirement met={passwordStrength.hasUpper}>
                One uppercase letter
              </PasswordRequirement>
              <PasswordRequirement met={passwordStrength.hasLower}>
                One lowercase letter
              </PasswordRequirement>
              <PasswordRequirement met={passwordStrength.hasNumber}>
                One number
              </PasswordRequirement>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-white/70">
            Confirm Password
          </label>
          <GlassInput
            id="confirmPassword"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            icon={<Lock className="w-4 h-4" />}
            required
            disabled={isLoading}
            error={confirmPassword.length > 0 && password !== confirmPassword}
          />
          {confirmPassword.length > 0 && password !== confirmPassword && (
            <p className="text-xs text-brand-red mt-1">Passwords do not match</p>
          )}
        </div>

        <GlassButton
          type="submit"
          variant="primary"
          className="w-full"
          loading={isLoading}
          disabled={isLoading || !isPasswordValid || password !== confirmPassword}
        >
          Create Account
        </GlassButton>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-white/50">
          Already have an account?{' '}
          <Link href="/login" className="text-brand-red-light hover:text-brand-red transition-colors font-medium">
            Sign in
          </Link>
        </p>
      </div>

      <div className="mt-8 pt-6 border-t border-glass-dark">
        <p className="text-xs text-center text-white/40">
          By creating an account, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </GlassCard>
  )
}

function PasswordRequirement({ met, children }: { met: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {met ? (
        <CheckCircle className="w-3 h-3 text-green-400" />
      ) : (
        <div className="w-3 h-3 rounded-full border border-white/30" />
      )}
      <span className={met ? 'text-green-400' : 'text-white/50'}>{children}</span>
    </div>
  )
}
