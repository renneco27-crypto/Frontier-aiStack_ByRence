import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createAdminSupabase, isUserAdmin } from '@/lib/supabaseServer'
import { mergeDeckCsv } from '@/features/upload/csvParser'
import { notifyDeckPublished } from '@/lib/deckPublishNotify'

// Helper function to log publisher IP
async function logPublisherIp(
  supabase: any,
  authorName: string,
  userId: string,
  ip: string,
  userAgent?: string,
  deckTitle?: string
) {
  try {
    await supabase.rpc('log_publisher_ip', {
      p_author_name: authorName,
      p_user_id: userId,
      p_ip: ip,
      p_user_agent: userAgent || null,
      p_deck_title: deckTitle || null
    })
  } catch (error) {
    console.warn('[publish] Failed to log publisher IP:', error)
    // Don't fail the publish if IP logging fails
  }
}

async function sendPublishNotification(deckTitle: string, authorName: string, deckId?: string) {
  try {
    // 1. Broadcast via native Firebase Cloud Messaging (FCM) to all Android app devices
    await notifyDeckPublished({ title: deckTitle, authorName, deckId }).catch((e) => {
      console.warn('[publish] FCM push notification failed:', e)
    })

    const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY
    const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID

    if (!ONESIGNAL_API_KEY || !ONESIGNAL_APP_ID) {
      console.warn('[publish] OneSignal credentials not configured')
      return
    }

    // Broadcast notification to ALL app subscribers so everyone receives it
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_API_KEY}`
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        included_segments: ['Total Subscriptions', 'Subscribed Users'],
        headings: { en: 'New Deck Published! 🎉' },
        contents: { en: `${authorName} published a new deck "${deckTitle}" to the public feed!` },
        android_sound: 'custom_sound_1',
        data: {
          type: 'deck_published_broadcast',
          timestamp: new Date().toISOString()
        }
      })
    })

    const resJson = await response.json().catch(() => ({}))
    console.log('[publish] OneSignal broadcast result:', resJson)
  } catch (err) {
    console.warn('[publish] Failed to send notification:', err)
    // Don't throw error - notification failure shouldn't break publishing
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'You must be signed in to publish' }, { status: 401 })
    }

    const title = request.nextUrl.searchParams.get('title')?.trim()
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const { data: existingDeck } = await supabase
      .from('decks')
      .select('id, device_id, author_name')
      .eq('title', title)
      .maybeSingle()

    if (!existingDeck) {
      return NextResponse.json({ existing: false })
    }

    const isAdmin = await isUserAdmin(user.id, user.email, user.user_metadata, user.app_metadata)
    const isOwner = !existingDeck.device_id || existingDeck.device_id === user.id

    return NextResponse.json({
      existing: true,
      ownedByOther: !isOwner && !isAdmin,
      authorName: existingDeck.author_name || 'Unknown',
    })
  } catch (err) {
    console.error('publish check error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to check publish status' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'You must be signed in to publish' }, { status: 401 })
    }

    const isAdmin = await isUserAdmin(user.id, user.email, user.user_metadata, user.app_metadata)

    const { data: profile } = await supabase
      .from('profiles')
      .select('can_publish')
      .eq('id', user.id)
      .maybeSingle()

    if (!isAdmin && profile && !profile.can_publish) {
      return NextResponse.json({ error: 'Your account does not have publishing permission' }, { status: 403 })
    }

    const { title, subject, csvContent, mode } = await request.json()
    const publishMode = mode === 'append' ? 'append' : 'overwrite'

    if (!title || !csvContent) {
      return NextResponse.json({ error: 'Title and CSV content are required' }, { status: 400 })
    }

    // Always use the server-side authenticated user name — never trust client input
    const authorName = user.user_metadata?.full_name
      || user.user_metadata?.display_name
      || user.email?.split('@')[0]
      || user.email
      || 'Unknown'

    // Extract publisher IP once — used for logging on success
    const forwardedFor = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || ''
    const publisherIp = forwardedFor.split(',')[0]?.trim() || '127.0.0.1'
    const userAgent = request.headers.get('user-agent') || undefined

    const { data: existingDeck } = await supabase
      .from('decks')
      .select('id, csv_content, device_id, author_name')
      .eq('title', title.trim())
      .maybeSingle()

    if (existingDeck) {
      const isOwner = !existingDeck.device_id || existingDeck.device_id === user.id
      if (!isOwner && !isAdmin) {
        return NextResponse.json(
          {
            error: `A deck titled "${title.trim()}" was created by another user (${existingDeck.author_name || 'another author'}). Only the deck owner or an admin can overwrite or append to it. Please rename your deck.`,
          },
          { status: 403 }
        )
      }

      const nextCsv = publishMode === 'append' && existingDeck.csv_content
        ? mergeDeckCsv(existingDeck.csv_content, csvContent)
        : csvContent

      // Use admin client if user is admin to bypass RLS, otherwise standard client
      const dbClient = isAdmin ? (createAdminSupabase() || supabase) : supabase

      const { data, error } = await dbClient
        .from('decks')
        .update({
          subject: subject || 'General',
          csv_content: nextCsv,
          author_name: isOwner ? authorName : existingDeck.author_name,
        })
        .eq('id', existingDeck.id)
        .select('id')
        .maybeSingle()

      if (error) {
        console.error('[publish] update error:', error)
        return NextResponse.json({ error: error.message || 'Failed to update deck' }, { status: 500 })
      }

      // Log publisher IP on successful update
      const adminClient = createAdminSupabase() || supabase
      await logPublisherIp(adminClient, authorName, user.id, publisherIp, userAgent, title.trim())

      // Send notification for deck update
      await sendPublishNotification(title.trim(), authorName, data?.id || existingDeck.id)

      return NextResponse.json({ id: data?.id || existingDeck.id, updated: true, appended: publishMode === 'append' })
    }

    const { data, error } = await supabase
      .from('decks')
      .insert({
        title: title.trim(),
        subject: subject || 'General',
        csv_content: csvContent,
        author_name: authorName,
        device_id: user.id,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[publish] insert error:', error)
      return NextResponse.json({ error: error.message || 'Failed to create deck' }, { status: 500 })
    }

    // Log publisher IP on successful insert
    const adminClient = createAdminSupabase() || supabase
    await logPublisherIp(adminClient, authorName, user.id, publisherIp, userAgent, title.trim())

    // Send notification for new deck
    await sendPublishNotification(title.trim(), authorName, data.id)

    return NextResponse.json({ id: data.id })
  } catch (err) {
    console.error('publish error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to publish' },
      { status: 500 }
    )
  }
}