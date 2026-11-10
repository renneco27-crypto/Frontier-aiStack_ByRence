import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase, createAdminSupabaseB, isUserAdmin, resolveRequestUser } from '@/lib/supabaseServer'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabaseA = createAdminSupabase()
    const supabaseB = createAdminSupabaseB()
    if (!supabaseA && !supabaseB) {
      return NextResponse.json({ error: 'Feed database credentials are unavailable' }, { status: 503 })
    }

    // Try Database A first
    let targetClient = supabaseA
    let data: any = null
    let error: any = null

    if (supabaseA) {
      const resA = await supabaseA
        .from('decks')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      data = resA.data
      error = resA.error
    }

    // Fallback to Database B if not found or DB A errored
    if ((error || !data) && supabaseB) {
      const resB = await supabaseB
        .from('decks')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (resB.data) {
        data = resB.data
        error = null
        targetClient = supabaseB
      }
    }

    if (error || !data) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    const rawContent = data.csv_content || data.json_content || ''
    const payload = {
      id: data.id,
      title: data.title,
      subject: data.subject,
      csv_content: rawContent,
      json_content: rawContent,
      author_name: data.author_name,
      published_at: data.published_at,
      download_count: (data.download_count ?? 0) + 1,
    }

    // Increment download count on the database where the deck resides
    try {
      if (targetClient) {
        await targetClient
          .from('decks')
          .update({ download_count: (data.download_count ?? 0) + 1 })
          .eq('id', id)
      }
    } catch {}

    return NextResponse.json(payload)
  } catch (err) {
    console.error('feed/[id] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load deck' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const user = await resolveRequestUser(request)
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    // Find the deck in DB A or DB B
    const supabase = createAdminSupabase()
    const supabaseB = createAdminSupabaseB()
    if (!supabase && !supabaseB) {
      return NextResponse.json({ error: 'Feed database credentials are unavailable' }, { status: 503 })
    }

    let deck: any = null
    let foundInB = false

    if (supabase) {
      const resA = await supabase
        .from('decks')
        .select('device_id')
        .eq('id', id)
        .maybeSingle()
      deck = resA.data
    }

    if (!deck && supabaseB) {
      const resB = await supabaseB
        .from('decks')
        .select('device_id')
        .eq('id', id)
        .maybeSingle()
      if (resB.data) {
        deck = resB.data
        foundInB = true
      }
    }

    if (!deck) return NextResponse.json({ error: 'Deck not found' }, { status: 404 })

    const isAdmin = await isUserAdmin(user.id, user.email, user.user_metadata, user.app_metadata)
    const isOwner = deck.device_id === user.id
    if (!isOwner && !isAdmin) {
      return NextResponse.json({
        error: 'Not authorized to delete this deck',
        details: `Your account (${user.email || user.id}) is not the deck owner and is not recognized as an admin.`,
      }, { status: 403 })
    }

    const targetClient = foundInB ? supabaseB : supabase
    if (targetClient) {
      await targetClient.from('deck_blanks').delete().eq('deck_id', id)
      const { error: lastError } = await targetClient.from('decks').delete().eq('id', id)
      if (lastError) throw lastError
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('feed/[id] delete error:', err)
    const message = err?.message || (typeof err === 'string' ? err : 'Failed to delete deck')
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const user = await resolveRequestUser(request)
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const isAdmin = await isUserAdmin(user.id, user.email, user.user_metadata, user.app_metadata)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const body = await request.json()
    const adminClientA = createAdminSupabase()
    const adminClientB = createAdminSupabaseB()
    if (!adminClientA && !adminClientB) {
      return NextResponse.json({ error: 'Feed database credentials are unavailable' }, { status: 503 })
    }

    // Determine which DB holds this deck
    let targetClient = adminClientA
    let deck: any = null
    let fetchErr: any = null

    if (adminClientA) {
      const resA = await adminClientA.from('decks').select('*').eq('id', id).maybeSingle()
      deck = resA.data
      fetchErr = resA.error
    }

    if ((fetchErr || !deck) && adminClientB) {
      targetClient = adminClientB
      const resB = await targetClient.from('decks').select('*').eq('id', id).maybeSingle()
      deck = resB.data
    }

    if (!deck) return NextResponse.json({ error: 'Deck not found' }, { status: 404 })

    // Merge Cards Mode
    if (Array.isArray(body.cardIndices)) {
      const { cardIndices } = body
      if (cardIndices.length < 2) {
        return NextResponse.json({ error: 'Select at least 2 cards to merge' }, { status: 400 })
      }

      const content = deck.csv_content || deck.json_content || ''
      const lines = content ? content.split(String.fromCharCode(10)) : []
      const selectedLines = cardIndices.map((i: number) => lines[i]).filter(Boolean)
      const remainingLines = lines.filter((_: string, i: number) => !cardIndices.includes(i))

      const mergedLine = selectedLines.join(' / ')
      const newCsv = [...remainingLines, mergedLine].join(String.fromCharCode(10))

      if (targetClient) {
        const { error: updateErr } = await targetClient.from('decks').update({ csv_content: newCsv }).eq('id', id)
        if (updateErr) throw updateErr
      }

      return NextResponse.json({ success: true })
    }

    // Rename Deck Mode
    const title = typeof body.title === 'string' ? body.title.trim() : null
    if (!title) return NextResponse.json({ error: 'Title or cardIndices required' }, { status: 400 })

    if (targetClient) {
      const { error } = await targetClient.from('decks').update({ title }).eq('id', id)
      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('feed/[id] patch error:', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to rename deck' },
      { status: 500 }
    )
  }
}
