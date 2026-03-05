'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/contexts/AuthContext'

interface Analysis {
  id: string
  url: string
  analysis: any
  created_at: string
  last_refreshed: string
}

interface Props {
  user: { email: string; name?: string }
  analyses: Analysis[]
  plan: string
  purchasedAt?: string
}

export default function DashboardClient({ user, analyses, plan, purchasedAt }: Props) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [currentTask, setCurrentTask] = useState('')
  const router = useRouter()
  const { signOut } = useAuth()

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    let progressInterval: NodeJS.Timeout | null = null

    try {
      let validatedUrl = url
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        validatedUrl = 'https://' + url
      }
      new URL(validatedUrl)

      const tasks = [
        { progress: 15, task: 'Connecting to website...' },
        { progress: 30, task: 'Scraping content...' },
        { progress: 50, task: 'Analyzing brand voice...' },
        { progress: 70, task: 'Extracting brand colors...' },
        { progress: 85, task: 'Generating recommendations...' },
      ]

      let taskIndex = 0
      progressInterval = setInterval(() => {
        if (taskIndex < tasks.length) {
          setProgress(tasks[taskIndex].progress)
          setCurrentTask(tasks[taskIndex].task)
          taskIndex++
        }
      }, 2000)

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
      if (progressInterval) clearInterval(progressInterval)
      setProgress(100)
      setCurrentTask('Analysis complete!')

      sessionStorage.setItem(`analysis-${data.analysisId}`, JSON.stringify(data))

      setTimeout(() => {
        router.push(`/results?id=${data.analysisId}`)
      }, 500)
    } catch (err: any) {
      if (progressInterval) clearInterval(progressInterval)
      setProgress(0)
      setCurrentTask('')
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

  const planLabel = plan === 'free' ? 'Free' : plan === 'essentials' ? 'Essentials' : plan === 'complete' ? 'Complete' : plan === 'premium' ? 'Premium' : plan

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="text-2xl font-bold text-mint-700">FlowMint</a>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user.email}</span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              plan === 'free' ? 'bg-gray-100 text-gray-600' : 'bg-mint-100 text-mint-700'
            }`}>
              {planLabel}
            </span>
            <button onClick={handleSignOut} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Welcome + Analyze */}
        <div className="mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {user.name ? `Welcome, ${user.name.split(' ')[0]}` : 'Dashboard'}
          </h1>
          <p className="text-gray-600 mb-8">Analyze a website to generate personalized email flows.</p>

          {loading ? (
            <div className="max-w-2xl bg-white rounded-xl border-2 border-mint-600 p-12 text-center shadow-lg">
              <div className="inline-block w-16 h-16 border-4 border-gray-200 border-t-mint-600 rounded-full animate-spin mb-6"></div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Analyzing Your Brand</h2>
              <div className="w-full max-w-md mx-auto h-6 bg-gray-200 rounded-full overflow-hidden mb-4">
                <div
                  className="h-full bg-mint-600 transition-all duration-500 flex items-center justify-center text-white text-xs font-semibold"
                  style={{ width: `${progress}%` }}
                >
                  {progress}%
                </div>
              </div>
              <p className="text-gray-600">{currentTask}</p>
            </div>
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
                  Analyze Brand
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
              {analyses.map((a) => (
                <div key={a.id} className="bg-white rounded-lg border border-gray-200 p-6 flex items-center justify-between hover:shadow-sm transition-shadow">
                  <div>
                    <div className="font-medium text-gray-900">{a.url}</div>
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
              ))}
            </div>
          </div>
        )}

        {/* Upgrade CTA for free users */}
        {plan === 'free' && (
          <div className="mt-12 bg-gradient-to-r from-mint-50 to-green-50 border border-mint-200 rounded-xl p-8">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Upgrade to export your templates</h3>
            <p className="text-gray-600 mb-4">
              Free plan lets you analyze and preview. Purchase a plan to export templates and push to your email platform.
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
