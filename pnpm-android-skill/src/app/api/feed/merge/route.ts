import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createAdminSupabase, isUserAdmin } from '@/lib/supabaseServer'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const isAdmin = await isUserAdmin(user.id, user.email, user.user_metadata, user.app_metadata)
    // Any signed-in user or admin can merge decks

    const body = await request.json()
    const { sourceDeckIds, customTitle } = body

    if (!Array.isArray(sourceDeckIds) || sourceDeckIds.length < 2) {
      return NextResponse.json({ error: 'Please select at least 2 decks to merge' }, { status: 400 })
    }

    const adminClient = createAdminSupabase()
    const client = adminClient ?? supabase

    // 1. Fetch all source decks
    const { data: sourceDecks, error: fetchErr } = await client
      .from('decks')
      .select('*')
      .in('id', sourceDeckIds)

    if (fetchErr || !sourceDecks || sourceDecks.length < 2) {
      return NextResponse.json({ error: 'Failed to fetch the selected decks for merging' }, { status: 404 })
    }

    // 2. Combine CSV contents
    const mergedTitle = customTitle?.trim() || sourceDecks.map((d: any) => d.title).join(' + ')
    const primarySubject = sourceDecks[0].subject || 'General'
    const totalDownloads = sourceDecks.reduce((sum: number, d: any) => sum + (d.download_count || 0), 0)

    let unifiedHeader = 'front,back,chapter,subject,lesson,type,mc_correct,mc_distractor1,mc_distractor2,mc_distractor3,tf_answer,explanation,enum_items,id_answer,id_variants'
    const combinedRows: string[] = []

    for (const deck of sourceDecks) {
      if (!deck.csv_content) continue
      const lines = deck.csv_content.split(/\r?\n/).filter((l: string) => l.trim().length > 0)
      if (lines.length === 0) continue

      const firstLine = lines[0].toLowerCase()
      const isHeader = firstLine.includes('front') && firstLine.includes('back')
      if (isHeader) {
        unifiedHeader = lines[0]
      }
      const dataRows = isHeader ? lines.slice(1) : lines
      combinedRows.push(...dataRows)
    }

    const combinedCsvContent = [unifiedHeader, ...combinedRows].join('\n')

    // 3. Create merged deck with merge timestamp
    const mergedAt = new Date().toISOString()
    const authorName = `${user.user_metadata?.name || user.email?.split('@')[0] || 'Learner'} [MERGED:${mergedAt}]`

    const newDeckPayload = {
      title: mergedTitle,
      subject: primarySubject,
      csv_content: combinedCsvContent,
      author_name: authorName,
      published_at: mergedAt,
      download_count: totalDownloads,
      device_id: user.id,
      folder_id: null,
    }

    const { data: newDeck, error: insertErr } = await client
      .from('decks')
      .insert(newDeckPayload)
      .select()
      .single()

    if (insertErr || !newDeck) {
      throw insertErr || new Error('Failed to create merged deck')
    }

    // Backup the source decks for 24-hour unmerge restoration
    try {
      await client.from('deck_merge_backups').insert({
        merged_deck_id: newDeck.id,
        source_decks: sourceDecks,
        merged_at: mergedAt,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
    } catch (backupErr) {
      console.warn('[merge] Backup save warning:', backupErr)
    }

    // Delete the original source decks so they don't clutter the feed
    const { error: deleteErr } = await client
      .from('decks')
      .delete()
      .in('id', sourceDeckIds)
      
    if (deleteErr) {
      console.warn('Failed to delete source decks after merge:', deleteErr)
    }

    return NextResponse.json({
      success: true,
      mergedDeck: newDeck,
      mergedAt,
      sourceDeckCount: sourceDecks.length,
    })
  } catch (err: any) {
    console.error('feed merge error:', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to merge decks' },
      { status: 500 }
    )
  }
}
