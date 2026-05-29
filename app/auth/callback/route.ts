import { createClient } from '@/app/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  // Honor a relative ?next= (e.g. back to /results?id=…&flow=…) so the
  // email-confirmation path returns where the user started, not /dashboard.
  // Only allow same-origin relative paths.
  const next = requestUrl.searchParams.get('next')
  const dest = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
  return NextResponse.redirect(requestUrl.origin + dest)
}
