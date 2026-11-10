import { NextResponse } from 'next/server'
import { getAuthUser, getProfileCanPublish, isUserAdmin, createServerSupabase } from '@/lib/supabaseServer'

export async function GET() {
  try {
    const user = await getAuthUser()

    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    const supabase = await createServerSupabase()
    const { data: { user: fullUser } } = await supabase.auth.getUser()

    const canPublish = await getProfileCanPublish(user.id)
    const isAdmin = await isUserAdmin(
      user.id,
      fullUser?.email ?? user.email,
      fullUser?.user_metadata ?? {},
      fullUser?.app_metadata ?? {}
    )

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email ?? '',
        displayName: user.user_metadata?.display_name ?? user.email ?? '',
      },
      canPublish,
      isAdmin,
    })
  } catch (err) {
    console.error('session error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load session' },
      { status: 500 }
    )
  }
}