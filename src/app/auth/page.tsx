'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function AuthForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo') ?? '/'
  const pendingRecipe = searchParams.get('pendingRecipe') // 'true' when save was triggered as guest

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    // If already signed in, redirect immediately
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace(returnTo)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
      setMessage('Check your email to confirm your account, then sign in.')
      setLoading(false)
      setMode('signin')
      return
    }

    // Auto-save pending recipe if triggered from Save button as guest
    if (pendingRecipe === 'true') {
      try {
        const raw = sessionStorage.getItem('pending_save_recipe')
        if (raw) {
          const payload = JSON.parse(raw)
          await fetch('/api/recipes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          sessionStorage.removeItem('pending_save_recipe')
        }
      } catch {
        // Non-fatal — user will see the Save button on recipe screen
      }
    }

    router.replace(returnTo)
  }

  async function handleGoogleOAuth() {
    setLoading(true)
    setError(null)
    const callbackUrl = `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}&pendingRecipe=${pendingRecipe ?? ''}`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen px-6">
      <div className="h-16" />

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[#333333]">
          {mode === 'signin' ? 'Welcome back' : 'Create account'}
        </h1>
        <p className="text-[#5B5F66] text-sm mt-1">
          {mode === 'signin' ? 'Sign in to access your saved recipes.' : 'Save and revisit your brew recipes.'}
        </p>
      </div>

      {message && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800 mb-4">
          {message}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="text-xs font-medium text-[#6B6B6B] uppercase tracking-wider block mb-1.5">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full bg-white border border-[#E1E2E5] rounded-[12px] px-4 py-3 text-sm text-[#333333] placeholder:text-[#9CA3AF] outline-none focus:border-[#333333] transition-colors"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-[#6B6B6B] uppercase tracking-wider block mb-1.5">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            placeholder="••••••••"
            className="w-full bg-white border border-[#E1E2E5] rounded-[12px] px-4 py-3 text-sm text-[#333333] placeholder:text-[#9CA3AF] outline-none focus:border-[#333333] transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#333333] text-white text-sm font-semibold rounded-[14px] py-4 mt-1 active:opacity-80 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : mode === 'signin' ? 'Sign In' : 'Create Account'}
        </button>
      </form>

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-[#E1E2E5]" />
        <span className="text-xs text-[#9CA3AF]">or</span>
        <div className="flex-1 h-px bg-[#E1E2E5]" />
      </div>

      <button
        onClick={handleGoogleOAuth}
        disabled={loading}
        className="w-full bg-white border border-[#E1E2E5] text-[#333333] text-sm font-medium rounded-[14px] py-3.5 active:opacity-80 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2.5"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
          <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </button>

      <button
        onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError(null) }}
        className="mt-6 text-sm text-[#6B6B6B] text-center"
      >
        {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
        <span className="text-[#333333] font-medium underline">
          {mode === 'signin' ? 'Sign up' : 'Sign in'}
        </span>
      </button>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  )
}
