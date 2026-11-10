import { createBrowserSupabase } from '@/lib/supabase'

export interface DeckBlank {
  id: string
  deck_id: string
  user_id: string | null
  title: string
  text_content: string
  created_at: string
}

export async function getDeckBlanks(deckId: string): Promise<DeckBlank[]> {
  const supabase = createBrowserSupabase()
  const { data, error } = await supabase
    .from('deck_blanks')
    .select('*')
    .eq('deck_id', deckId)
    .order('created_at', { ascending: false })
    
  if (error) {
    console.error('Error fetching deck blanks:', error)
    return []
  }
  return data as DeckBlank[]
}

export async function getAllUserBlanks(): Promise<DeckBlank[]> {
  const supabase = createBrowserSupabase()
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id

  if (!userId) return []

  const { data, error } = await supabase
    .from('deck_blanks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    
  if (error) {
    console.error('Error fetching all user blanks:', error)
    return []
  }
  return data as DeckBlank[]
}

export async function createDeckBlank(deckId: string, title: string, textContent: string): Promise<DeckBlank | null> {
  const supabase = createBrowserSupabase()
  
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id ?? null

  if (!userId) {
    console.error('Must be logged in to save blanks')
    return null
  }

  const { data, error } = await supabase
    .from('deck_blanks')
    .insert({
      deck_id: deckId,
      user_id: userId,
      title: title,
      text_content: textContent
    })
    .select()
    .single()
    
  if (error) {
    console.error('Error creating deck blank:', error)
    return null
  }
  
  return data as DeckBlank
}

export async function deleteDeckBlank(id: string): Promise<boolean> {
  const supabase = createBrowserSupabase()
  const { error } = await supabase
    .from('deck_blanks')
    .delete()
    .eq('id', id)
    
  if (error) {
    console.error('Error deleting deck blank:', error)
    return false
  }
  return true
}
