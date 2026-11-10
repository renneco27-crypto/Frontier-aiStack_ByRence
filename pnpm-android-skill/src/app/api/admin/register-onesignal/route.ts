import { NextResponse } from 'next/server'
import { getAuthUser, isUserAdmin, createAdminSupabase, createServerSupabase } from '@/lib/supabaseServer'

export async function POST(request: Request) {
  try {
    // Verify admin access
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = await isUserAdmin(
      user.id,
      user.email ?? '',
      user.user_metadata ?? {},
      user.app_metadata ?? {}
    )

    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { userId, userEmail } = await request.json()

    if (!userId || !userEmail) {
      return NextResponse.json({ error: 'userId and userEmail are required' }, { status: 400 })
    }

    const supabase = createAdminSupabase() || await createServerSupabase()
    
    // Update the profiles table with the OneSignal external user ID (email)
    const { error } = await supabase
      .from('profiles')
      .update({ onesignal_external_user_id: userEmail })
      .eq('id', userId)

    if (error) {
      console.error('Failed to update OneSignal ID:', error)
      return NextResponse.json({ error: 'Failed to update OneSignal ID' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      message: `User ${userEmail} registered for push notifications` 
    })

  } catch (err) {
    console.error('Register OneSignal ID error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to register user for push notifications' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    // Verify admin access
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = await isUserAdmin(
      user.id,
      user.email ?? '',
      user.user_metadata ?? {},
      user.app_metadata ?? {}
    )

    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const supabase = createAdminSupabase() || await createServerSupabase()
    
    // Get all users with their OneSignal registration status
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, onesignal_external_user_id')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch user profiles:', error)
      return NextResponse.json({ error: 'Failed to fetch user profiles' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      users: profiles 
    })

  } catch (err) {
    console.error('Get OneSignal users error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch users' },
      { status: 500 }
    )
  }
}
