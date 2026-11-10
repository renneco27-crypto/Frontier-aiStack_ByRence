import { NextResponse } from 'next/server'
import { getAuthUser, createServerSupabase } from '@/lib/supabaseServer'

export async function POST(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userEmail } = await request.json()

    if (!userEmail) {
      return NextResponse.json({ error: 'Missing userEmail' }, { status: 400 })
    }

    const supabase = await createServerSupabase()
    
    // Update the profiles table with the OneSignal external user ID (email)
    const { error } = await supabase
      .from('profiles')
      .update({ onesignal_external_user_id: userEmail })
      .eq('id', user.id)

    if (error) {
      console.error('Failed to update OneSignal ID:', error)
      return NextResponse.json({ error: 'Failed to update OneSignal ID' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error('Update OneSignal ID error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update OneSignal ID' },
      { status: 500 }
    )
  }
}
