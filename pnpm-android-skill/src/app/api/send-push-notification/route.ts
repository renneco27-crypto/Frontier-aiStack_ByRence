import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/supabaseServer'

export async function POST(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userEmail, title, message } = await request.json()

    if (!userEmail || !title || !message) {
      return NextResponse.json({ error: 'Missing required fields: userEmail, title, message' }, { status: 400 })
    }

    const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY
    const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID

    if (!ONESIGNAL_API_KEY || !ONESIGNAL_APP_ID) {
      return NextResponse.json({ error: 'OneSignal credentials not configured' }, { status: 500 })
    }

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_API_KEY}`
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_external_user_ids: [userEmail],
        headings: { en: title },
        contents: { en: message },
        data: {
          type: 'individual_notification',
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
    return NextResponse.json({ success: true, result })

  } catch (err) {
    console.error('Push notification error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send push notification' },
      { status: 500 }
    )
  }
}
