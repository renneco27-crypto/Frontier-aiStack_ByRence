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

    const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY
    const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID

    if (!ONESIGNAL_API_KEY || !ONESIGNAL_APP_ID) {
      return NextResponse.json({ error: 'OneSignal credentials not configured' }, { status: 500 })
    }

    const supabase = createAdminSupabase() || await createServerSupabase()

    // Get pending notifications that are due to be sent
    const { data: pendingNotifications, error: fetchError } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(50)

    if (fetchError) {
      console.error('[process-notifications] Failed to fetch pending notifications:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch pending notifications' }, { status: 500 })
    }

    if (!pendingNotifications || pendingNotifications.length === 0) {
      return NextResponse.json({ success: true, message: 'No pending notifications to process' })
    }

    // Get all registered users
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('onesignal_external_user_id')
      .not('onesignal_external_user_id', 'is', null)

    if (profilesError) {
      console.error('[process-notifications] Failed to fetch user profiles:', profilesError)
      return NextResponse.json({ error: 'Failed to fetch user profiles' }, { status: 500 })
    }

    if (!profiles || profiles.length === 0) {
      console.log('[process-notifications] No registered users found')
      return NextResponse.json({ success: true, message: 'No registered users to notify' })
    }

    const userEmails = profiles
      .map(p => p.onesignal_external_user_id)
      .filter(email => email && email.trim() !== '')

    if (userEmails.length === 0) {
      console.log('[process-notifications] No valid user emails found')
      return NextResponse.json({ success: true, message: 'No valid user emails to notify' })
    }

    // Process each notification
    const results = []
    for (const notification of pendingNotifications) {
      try {
        const response = await fetch('https://onesignal.com/api/v1/notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${ONESIGNAL_API_KEY}`
          },
          body: JSON.stringify({
            app_id: ONESIGNAL_APP_ID,
            include_external_user_ids: userEmails,
            headings: { en: notification.title },
            contents: { en: notification.message },
            data: {
              type: 'scheduled_notification',
              notification_id: notification.id,
              timestamp: new Date().toISOString()
            }
          })
        })

        if (response.ok) {
          // Mark as sent
          await supabase
            .from('notification_queue')
            .update({ 
              status: 'sent', 
              sent_at: new Date().toISOString() 
            })
            .eq('id', notification.id)

          results.push({ id: notification.id, status: 'sent' })
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          
          // Mark as failed
          await supabase
            .from('notification_queue')
            .update({ 
              status: 'failed', 
              error_message: JSON.stringify(errorData) 
            })
            .eq('id', notification.id)

          results.push({ id: notification.id, status: 'failed', error: errorData })
        }
      } catch (err) {
        console.error(`[process-notifications] Failed to send notification ${notification.id}:`, err)
        
        // Mark as failed
        await supabase
          .from('notification_queue')
          .update({ 
            status: 'failed', 
            error_message: err instanceof Error ? err.message : 'Unknown error' 
          })
          .eq('id', notification.id)

        results.push({ id: notification.id, status: 'failed', error: String(err) })
      }
    }

    return NextResponse.json({ 
      success: true, 
      processed: results.length,
      results 
    })

  } catch (err) {
    console.error('Process notifications error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to process notifications' },
      { status: 500 }
    )
  }
}
