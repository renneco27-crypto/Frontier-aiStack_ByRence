import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createAdminSupabase, isUserAdmin } from '@/lib/supabaseServer'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminSupabase() || (await createServerSupabase())
    const { id } = await params

    const { data, error } = await supabase
      .from('decks')
      .select('id, title, subject, author_name, published_at, download_count')
      .eq('folder_id', id)
      .order('published_at', { ascending: false })

    if (error) throw error

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('get folder decks error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load folder decks' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminSupabase() || (await createServerSupabase())
    const { id } = await params
    const { deckId } = await request.json()

    if (!deckId) {
      return NextResponse.json({ error: 'deckId is required' }, { status: 400 })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in to categorize' }, { status: 401 })
    }

    const isAdmin = await isUserAdmin(user.id, user.email, user.user_metadata, user.app_metadata)
    const adminClient = createAdminSupabase()
    const client = (isAdmin && adminClient) ? adminClient : supabase

    // Verify deck existence and ownership/admin permission
    const { data: deck } = await client
      .from('decks')
      .select('id, device_id')
      .eq('id', deckId)
      .single()

    if (!deck) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    const isOwner = deck.device_id === user.id
    if (!isOwner && !isAdmin) {
      return NextResponse.json({
        error: 'Not authorized to categorize this deck',
        details: `Your account (${user.email || user.id}) is not the deck owner and is not recognized as an admin.`,
      }, { status: 403 })
    }

    const { error, count } = await client
      .from('decks')
      .update({ folder_id: id }, { count: 'exact' })
      .eq('id', deckId)

    if (error) throw error
    if (count === 0) {
      return NextResponse.json({ error: 'Failed to update deck folder' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('add deck to folder error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to add deck to folder' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminSupabase() || (await createServerSupabase())
    const { id } = await params
    const { deckId } = await request.json()

    if (!deckId) {
      return NextResponse.json({ error: 'deckId is required' }, { status: 400 })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in to un-categorize' }, { status: 401 })
    }

    const isAdmin = await isUserAdmin(user.id, user.email, user.user_metadata, user.app_metadata)
    const adminClient = createAdminSupabase()
    const client = (isAdmin && adminClient) ? adminClient : supabase

    const { data: deck } = await client
      .from('decks')
      .select('id, device_id')
      .eq('id', deckId)
      .single()

    if (!deck) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    const isOwner = deck.device_id === user.id
    if (!isOwner && !isAdmin) {
      return NextResponse.json({
        error: 'Not authorized to un-categorize this deck',
        details: `Your account (${user.email || user.id}) is not the deck owner and is not recognized as an admin.`,
      }, { status: 403 })
    }

    const { error, count } = await client
      .from('decks')
      .update({ folder_id: null }, { count: 'exact' })
      .eq('id', deckId)
      .eq('folder_id', id)

    if (error) throw error
    if (count === 0) {
      return NextResponse.json({ error: 'Deck was not in this folder or already removed' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('remove deck from folder error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to remove deck from folder' },
      { status: 500 }
    )
  }
}