import { NextRequest, NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabaseServer"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { cardIds, deckId, cardFronts } = await request.json()

    if (!cardIds || !Array.isArray(cardIds) || cardIds.length === 0) {
      return NextResponse.json({ error: "cardIds required" }, { status: 400 })
    }

    const rows = (cardIds as string[]).map((id: string, i: number) => ({
      user_id: user.id,
      user_email: user.email ?? null,
      user_name:
        user.user_metadata?.full_name ||
        user.user_metadata?.display_name ||
        user.email?.split("@")[0] ||
        user.email ||
        "Unknown",
      card_id: id,
      card_front: (cardFronts as string[])?.[i] ?? null,
      deck_id: deckId ?? null,
      deleted_at: new Date().toISOString(),
    }))

    const { error } = await supabase.from("delete_log").insert(rows)

    if (error) {
      // Non-fatal: log but don't break the delete flow
      console.error("delete_log insert error:", error.message)
    }

    return NextResponse.json({ logged: rows.length })
  } catch (err) {
    console.error("delete-log route error:", err)
    return NextResponse.json({ error: "Failed to log deletion" }, { status: 500 })
  }
}
