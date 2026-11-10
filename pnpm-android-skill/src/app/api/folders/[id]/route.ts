import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createAdminSupabase, isUserAdmin } from '@/lib/supabaseServer'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabase()
    const { id } = await params

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in to delete a folder' }, { status: 401 })
    }

    const isAdmin = await isUserAdmin(user.id, user.email, user.user_metadata, user.app_metadata)
    const adminClient = createAdminSupabase()
    const client = (isAdmin && adminClient) ? adminClient : supabase

    // Unassign all decks from this folder before deleting
    await client
      .from('decks')
      .update({ folder_id: null })
      .eq('folder_id', id)

    const { error, count } = await client
      .from('feed_folders')
      .delete({ count: 'exact' })
      .eq('id', id)

    if (error) throw error
    if (count === 0) {
      return NextResponse.json({ error: 'Not authorized to delete this folder or it does not exist' }, { status: 403 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('delete folder error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete folder' },
      { status: 500 }
    )
  }
}