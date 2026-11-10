import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createAdminSupabase, isUserAdmin } from '@/lib/supabaseServer'

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const isAdmin = await isUserAdmin(user.id, user.email, user.user_metadata, user.app_metadata)
    // Any signed-in user or admin can unmerge within 24 hours

    const body = await request.json()
    const { mergedDeckId } = body

    if (!mergedDeckId) {
      return NextResponse.json({ error: 'mergedDeckId is required' }, { status: 400 })
    }

    const adminClient = createAdminSupabase()
    const client = adminClient ?? supabase

    // 1. Fetch the merged deck
    const { data: deck, error: fetchErr } = await client
      .from('decks')
      .select('*')
      .eq('id', mergedDeckId)
      .single()

    if (fetchErr || !deck) {
      return NextResponse.json({ error: 'Merged deck not found' }, { status: 404 })
    }

    // 2. Check if deck is a merged deck and verify 24-hour expiration window
    const authorName = deck.author_name || ''
    const match = authorName.match(/\[MERGED:(.+?)\]/)
    const mergedAt = match ? match[1] : deck.published_at

    if (!mergedAt) {
      return NextResponse.json({ error: 'This deck is not a reversible merged deck' }, { status: 400 })
    }

    const mergedTime = new Date(mergedAt).getTime()
    const elapsed = Date.now() - mergedTime

    if (elapsed > TWENTY_FOUR_HOURS_MS) {
      return NextResponse.json({
        error: 'The 24-hour unmerge window has expired. This deck merge is now permanent.',
        expired: true,
      }, { status: 400 })
    }

    // 3. Restore original source decks from backup if available
    try {
      const { data: backup } = await client
        .from('deck_merge_backups')
        .select('source_decks')
        .eq('merged_deck_id', mergedDeckId)
        .maybeSingle()

      if (backup && Array.isArray(backup.source_decks) && backup.source_decks.length > 0) {
        const decksToRestore = backup.source_decks.map((d: any) => ({
          id: d.id,
          title: d.title,
          subject: d.subject || 'General',
          csv_content: d.csv_content,
          author_name: d.author_name,
          published_at: d.published_at || new Date().toISOString(),
          download_count: d.download_count || 0,
          device_id: d.device_id,
          folder_id: d.folder_id || null,
        }))

        await client.from('decks').upsert(decksToRestore, { onConflict: 'id' })
        await client.from('deck_merge_backups').delete().eq('merged_deck_id', mergedDeckId)
      }
    } catch (restoreErr) {
      console.warn('[unmerge] Failed to restore from backup table:', restoreErr)
    }

    // 4. Delete the merged deck
    const { error: deleteErr } = await client
      .from('decks')
      .delete()
      .eq('id', mergedDeckId)

    if (deleteErr) {
      throw deleteErr
    }

    return NextResponse.json({
      success: true,
      message: 'Deck unmerged successfully. Original decks have been restored to the feed.',
    })
  } catch (err: any) {
    console.error('feed unmerge error:', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to unmerge deck' },
      { status: 500 }
    )
  }
}
