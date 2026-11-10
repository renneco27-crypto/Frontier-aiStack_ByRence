import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabaseServer'

export async function POST(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { title, message } = await request.json()

    if (!title || !message) {
      return NextResponse.json({ error: 'Missing required fields: title, message' }, { status: 400 })
    }

    const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY
    const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID

    if (!ONESIGNAL_API_KEY || !ONESIGNAL_APP_ID) {
      return NextResponse.json({ error: 'OneSignal credentials not configured' }, { status: 500 })
    }

    // Send broadcast notification to all app subscribers
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_API_KEY}`
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        included_segments: ['Total Subscriptions', 'Subscribed Users'],
        headings: { en: title },
        contents: { en: message },
        android_sound: 'custom_sound_1',
        data: {
          type: 'deck_created_broadcast',
          timestamp: new Date().toISOString()
        }
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      console.error('OneSignal API error:', errorData)
      return NextResponse.json({ error: 'Failed to send notification', details: errorData }, { status: 500 })
    }

    const result = await response.json()
    console.log('[send-broadcast-notification] Notification sent successfully:', result)
    return NextResponse.json({ 
      success: true, 
      result,
      recipients: result?.recipients ?? 'all'
    })

  } catch (err) {
    console.error('Broadcast notification error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send broadcast notification' },
      { status: 500 }
    )
  }
}
