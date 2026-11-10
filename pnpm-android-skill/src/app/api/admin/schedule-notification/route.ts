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

    const { title, message, scheduledFor } = await request.json()

    if (!title || !message) {
      return NextResponse.json({ error: 'Missing required fields: title, message' }, { status: 400 })
    }

    // Default to immediate sending if no time specified
    const scheduledTime = scheduledFor || new Date().toISOString()

    const supabase = createAdminSupabase() || await createServerSupabase()

    const { data, error } = await supabase
      .from('notification_queue')
      .insert({
        title,
        message,
        scheduled_for: scheduledTime,
        created_by: user.id
      })
      .select('id')
      .single()

    if (error) {
      console.error('[schedule-notification] Failed to schedule notification:', error)
      return NextResponse.json({ error: 'Failed to schedule notification' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      notificationId: data.id,
      scheduledFor: scheduledTime 
    })

  } catch (err) {
    console.error('Schedule notification error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to schedule notification' },
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

    const { data: notifications, error } = await supabase
      .from('notification_queue')
      .select('*')
      .order('scheduled_for', { ascending: false })
      .limit(50)

    if (error) {
      console.error('[schedule-notification] Failed to fetch notifications:', error)
      return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      notifications 
    })

  } catch (err) {
    console.error('Get notifications error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}
