import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createAdminSupabase } from '@/lib/supabaseServer'

export async function GET() {
  try {
    const supabase = createAdminSupabase() || (await createServerSupabase())
    const { data, error } = await supabase
      .from('feed_folders')
      .select('*, decks(count)')
      .order('created_at', { ascending: true })

    if (error) {
      console.warn('feed_folders query error (falling back to empty):', error)
      return NextResponse.json([])
    }

    const folders = (data ?? []).map((f: Record<string, unknown>) => ({
      id: f.id,
      name: f.name,
      created_by: f.created_by,
      created_at: f.created_at,
      deck_count: (f.decks as { count: number }[])?.[0]?.count ?? 0,
    })) as { id: string; name: string; created_by: string; created_at: string; deck_count: number }[]

    return NextResponse.json(folders)
  } catch (err) {
    console.warn('folders error fallback:', err)
    return NextResponse.json([])
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in to create a folder' }, { status: 401 })
    }

    const { name } = await request.json()

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('feed_folders')
      .insert({ name: name.trim(), created_by: user.id })
      .select('id, name, created_at')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A folder with this name already exists' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('create folder error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create folder' },
      { status: 500 }
    )
  }
}