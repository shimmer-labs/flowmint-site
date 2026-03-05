'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signIn, resetPassword } from '@/app/lib/auth'
import { getAuthErrorMessage } from '@/app/lib/auth/errors'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetLoading(true)
    setError('')
    try {
      await resetPassword(resetEmail || email)
      setResetSent(true)
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email')
    } finally {
      setResetLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signIn({ email, password })
      router.push(redirectTo)
      router.refresh()
    } catch (error: any) {
      setError(getAuthErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold text-mint-700">FlowMint</Link>
          <h2 className="mt-6 text-2xl font-bold text-gray-900">Sign in to your account</h2>
          <p className="mt-2 text-sm text-gray-600">
            Or{' '}
            <Link href="/signup" className="font-medium text-mint-600 hover:text-mint-700">
              create a new account
            </Link>
          </p>
        </div>

        <form className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-mint-600 focus:ring-2 focus:ring-mint-100 text-sm"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
              <button
                type="button"
                onClick={() => { setShowForgotPassword(true); setResetEmail(email); }}
                className="text-xs text-mint-600 hover:text-mint-700 font-medium"
              >
                Forgot password?
              </button>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-mint-600 focus:ring-2 focus:ring-mint-100 text-sm"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-mint-600 text-white font-medium py-3 px-4 rounded-lg hover:bg-mint-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {/* Forgot Password Modal */}
        {showForgotPassword && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-lg max-w-md w-full">
              {resetSent ? (
                <div className="text-center">
                  <div className="w-12 h-12 bg-mint-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl text-mint-600">&#10003;</span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Check your email</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    We sent a password reset link to <strong>{resetEmail || email}</strong>.
                  </p>
                  <button
                    onClick={() => { setShowForgotPassword(false); setResetSent(false); }}
                    className="text-mint-600 hover:text-mint-700 font-medium text-sm"
                  >
                    Back to login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword}>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Reset your password</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Enter your email and we&apos;ll send you a reset link.
                  </p>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-mint-600 focus:ring-2 focus:ring-mint-100 text-sm mb-4"
                    placeholder="you@example.com"
                  />
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(false)}
                      className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="flex-1 py-2.5 bg-mint-600 text-white rounded-lg font-medium hover:bg-mint-700 transition-colors disabled:opacity-50 text-sm"
                    >
                      {resetLoading ? 'Sending...' : 'Send reset link'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading...</p></div>}>
      <LoginForm />
    </Suspense>
  )
}
