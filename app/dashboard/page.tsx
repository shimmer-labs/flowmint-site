import { ensureAuthenticated } from '@/app/lib/auth/protected'
import { createClient } from '@/app/lib/supabase/server'
import { getUserPurchases, hasUnlimitedAccess } from '@/app/lib/plan-gating'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const user = await ensureAuthenticated()
  const supabase = await createClient()

  // Fetch user's brand analyses
  const { data: analyses } = await supabase
    .from('brand_analyses')
    .select('id, url, analysis, created_at, last_refreshed')
    .eq('user_id', user.id)
    .order('last_refreshed', { ascending: false })

  // Fetch purchases + unlimited status
  const [purchases, isUnlimited] = await Promise.all([
    getUserPurchases(user.id),
    hasUnlimitedAccess(user.id),
  ])

  // Fetch template stats
  const { count: templateCount } = await supabase
    .from('email_templates')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // Count distinct flows
  const { data: flowData } = await supabase
    .from('email_templates')
    .select('flow_id')
    .eq('user_id', user.id)

  const uniqueFlows = new Set(flowData?.map((t: any) => t.flow_id) || [])

  return (
    <DashboardClient
      user={{ email: user.email!, name: user.user_metadata?.full_name }}
      analyses={analyses || []}
      purchases={purchases}
      isUnlimited={isUnlimited}
      templateCount={templateCount || 0}
      flowCount={uniqueFlows.size}
    />
  )
}
