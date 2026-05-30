'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/contexts/AuthContext'
import { hasAnyPurchaseClient, getPlanLabel } from '@/app/lib/plan-gating-client'
import { isBetaOpenAccessClient } from '@/app/lib/beta-client'
import AnalyzingCard from '@/app/components/AnalyzingCard'
import type { Purchase } from '@/app/lib/stripe'

interface Analysis {
  id: string
  url: string
  analysis: any
  created_at: string
  last_refreshed: string
}

interface GhlConnection {
  id: string
  location_id: string
  location_label: string | null
}

interface Props {
  user: { email: string; name?: string }
  analyses: Analysis[]
  purchases: Purchase[]
  isUnlimited: boolean
  templateCount: number
  flowCount: number
  ghlConnections: GhlConnection[]
}

export default function DashboardClient({ user, analyses, purchases, isUnlimited, templateCount, flowCount, ghlConnections }: Props) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const { signOut } = useAuth()

  const beta = isBetaOpenAccessClient()
  const hasPaid = hasAnyPurchaseClient(purchases, isUnlimited)
  const planLabel = getPlanLabel(isUnlimited, purchases.length)
  const ghlConnected = ghlConnections.length > 0
  const isFirstRun = analyses.length === 0

  // Get purchase badge for an analysis
  const getAnalysisBadge = (analysisId: string) => {
    if (isUnlimited) return { label: 'Unlimited', color: 'bg-purple-100 text-purple-700' }

    const fullCampaign = purchases.some(
      (p) => p.analysis_id === analysisId && p.purchase_type === 'full_campaign' && p.status === 'active'
    )
    if (fullCampaign) return { label: 'Full Campaign', color: 'bg-mint-100 text-mint-700' }

    const singleFlows = purchases.filter(
      (p) => p.analysis_id === analysisId && p.purchase_type === 'single_flow' && p.status === 'active'
    )
    if (singleFlows.length > 0) return { label: `${singleFlows.length} flow${singleFlows.length !== 1 ? 's' : ''} purchased`, color: 'bg-blue-100 text-blue-700' }

    return null
  }

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      let validatedUrl = url
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        validatedUrl = 'https://' + url
      }
      new URL(validatedUrl)

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: validatedUrl }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Analysis failed')
      }

      const data = await response.json()

      sessionStorage.setItem(`analysis-${data.analysisId}`, JSON.stringify(data))

      router.push(`/results?id=${data.analysisId}`)
    } catch (err: any) {
      if (err.message.includes('Invalid URL')) {
        setError('Please enter a valid URL (e.g., https://example.com)')
      } else {
        setError(err.message || 'Failed to analyze website')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-y-3">
          <a href="/" className="text-2xl font-bold text-mint-700">FlowMint</a>
          <nav className="flex items-center gap-4 sm:gap-6 flex-wrap">
            <a href="/dashboard" className="text-sm text-mint-600 font-medium">Dashboard</a>
            <a href="/templates" className="text-sm text-gray-600 hover:text-gray-900">Templates</a>
            <a href="/settings" className="text-sm text-gray-600 hover:text-gray-900">Settings</a>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              beta ? 'bg-amber-100 text-amber-700' : hasPaid ? 'bg-mint-100 text-mint-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {beta ? 'Beta' : planLabel}
            </span>
            <button onClick={handleSignOut} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              Sign out
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Welcome */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <h1 className="text-3xl font-bold text-gray-900">
            {user.name ? `Welcome, ${user.name.split(' ')[0]}` : 'Dashboard'}
          </h1>
          {/* GHL connection status — gives GoHighLevel a presence on the dashboard */}
          {ghlConnected ? (
            <a href="/settings" className="inline-flex items-center gap-2 text-sm bg-ghl-50 text-ghl-700 ring-1 ring-ghl-200 rounded-full px-3 py-1.5 hover:bg-ghl-100 transition-colors">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              GoHighLevel connected{ghlConnections[0]?.location_label ? `: ${ghlConnections[0].location_label}` : ''}
            </a>
          ) : (
            <a href="/settings" className="inline-flex items-center gap-2 text-sm bg-gray-100 text-gray-600 rounded-full px-3 py-1.5 hover:bg-gray-200 transition-colors">
              <span className="w-2 h-2 rounded-full bg-gray-400"></span>
              Connect GoHighLevel
            </a>
          )}
        </div>
        <p className="text-gray-600 mb-8">Turn any website into a ready-to-send email campaign.</p>

        {/* First-run 3-step intro (ported from the Shopify plugin) */}
        {isFirstRun && !loading && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-8 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-1">How it works</h2>
            <p className="text-gray-500 text-sm mb-6">Paste your URL below to get started. Takes about a minute.</p>
            <div className="grid md:grid-cols-3 gap-5">
              {[
                { n: 1, t: 'Paste your URL', d: 'We read your website: voice, colors, services, the works.' },
                { n: 2, t: 'See your first email', d: 'Get one on-brand email right away, then write the whole campaign.' },
                { n: 3, t: 'Push to your CRM', d: 'Send it straight into GoHighLevel (or 5 other platforms).' },
              ].map((s) => (
                <div key={s.n} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-mint-100 text-mint-700 font-bold flex items-center justify-center flex-shrink-0">{s.n}</div>
                  <div>
                    <div className="font-semibold text-gray-900">{s.t}</div>
                    <div className="text-sm text-gray-500">{s.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        {(templateCount > 0 || analyses.length > 0) && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="text-2xl font-bold text-gray-900">{analyses.length}</div>
              <div className="text-sm text-gray-500">Analyses</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="text-2xl font-bold text-gray-900">{flowCount}</div>
              <div className="text-sm text-gray-500">Emails written</div>
            </div>
            <a href="/templates" className="bg-white rounded-lg border border-gray-200 p-5 hover:border-mint-300 transition-colors">
              <div className="text-2xl font-bold text-gray-900">{templateCount}</div>
              <div className="text-sm text-gray-500">Templates &rarr;</div>
            </a>
          </div>
        )}

        {/* Analyze Form */}
        <div className="mb-12">
          {loading ? (
            <AnalyzingCard />
          ) : (
            <form onSubmit={handleAnalyze} className="max-w-2xl">
              <div className="flex flex-col md:flex-row gap-4">
                <input
                  type="text"
                  placeholder="yourwebsite.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-6 py-4 text-lg focus:outline-none focus:border-mint-600 focus:ring-4 focus:ring-mint-100 transition-all"
                  required
                />
                <button
                  type="submit"
                  disabled={!url}
                  className="bg-mint-600 hover:bg-mint-700 disabled:bg-gray-300 text-white font-medium py-4 px-8 rounded-lg transition-all whitespace-nowrap disabled:cursor-not-allowed"
                >
                  Scan my website
                </button>
              </div>
              {error && <p className="mt-4 text-red-600 text-sm">{error}</p>}
            </form>
          )}
        </div>

        {/* Previous Analyses */}
        {analyses.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Previous Analyses</h2>
            <div className="grid gap-4">
              {analyses.map((a) => {
                const badge = getAnalysisBadge(a.id)
                return (
                  <div key={a.id} className="bg-white rounded-lg border border-gray-200 p-6 flex items-center justify-between hover:shadow-sm transition-shadow">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-gray-900">{a.url}</span>
                        {badge && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.color}`}>
                            {badge.label}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {a.analysis?.businessModel && <span className="mr-4">Model: {a.analysis.businessModel}</span>}
                        Last analyzed: {new Date(a.last_refreshed).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        sessionStorage.setItem(`analysis-${a.id}`, JSON.stringify({ analysisId: a.id, analysis: a.analysis, scrapedData: { siteName: a.url } }))
                        router.push(`/results?id=${a.id}`)
                      }}
                      className="text-mint-600 hover:text-mint-700 font-medium text-sm"
                    >
                      View Results &rarr;
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Upgrade CTA for free users */}
        {!hasPaid && (
          <div className="mt-12 bg-gradient-to-r from-mint-50 to-green-50 border border-mint-200 rounded-xl p-8">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Ready to export?</h3>
            <p className="text-gray-600 mb-4">
              Scan and preview for free. Pay when you&apos;re ready to send, starting at $29 per campaign.
            </p>
            <a href="/#pricing" className="inline-block bg-mint-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-mint-700 transition-colors">
              View Pricing
            </a>
          </div>
        )}
      </main>
    </div>
  )
}
