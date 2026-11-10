import { createBrowserSupabase } from '@/lib/supabase'

export interface CardDocument {
  id: string
  card_id: string
  user_id: string | null
  text_content: string
  created_at: string
}

export async function getCardDocuments(cardId: string): Promise<CardDocument[]> {
  const supabase = createBrowserSupabase()
  const { data, error } = await supabase
    .from('card_documents')
    .select('*')
    .eq('card_id', cardId)
    .order('created_at', { ascending: false })
    
  if (error) {
    console.error('Error fetching card documents:', error)
    return []
  }
  return data as CardDocument[]
}

export async function uploadCardDocument(cardId: string, text: string): Promise<CardDocument | null> {
  const supabase = createBrowserSupabase()
  
  // Try to get user, but don't fail if anonymous
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id ?? null

  const { data, error } = await supabase
    .from('card_documents')
    .insert({
      card_id: cardId,
      user_id: userId,
      text_content: text
    })
    .select()
    .single()
    
  if (error) {
    console.error('Error uploading card document:', error)
    return null
  }
  
  return data as CardDocument
}
