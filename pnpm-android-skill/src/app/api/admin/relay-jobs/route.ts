import { NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabaseServer';

// GET /api/admin/relay-jobs → returns all relay jobs (admin view)
export async function GET() {
  // Use the service‑role client; this bypasses RLS
  const supabase = createAdminSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase service role key not configured' }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-relay-sha, x-active-jobs, x-worker-id' } });
  }

  // Adjust the table name if your schema uses a different one
  const { data, error } = await supabase.from('relay_jobs').select('*');
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-relay-sha, x-active-jobs, x-worker-id' } });
  }

  return NextResponse.json({ jobs: data }, { status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-relay-sha, x-active-jobs, x-worker-id' } });
}

export async function OPTIONS() {
  // CORS preflight – same headers as other routes
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-relay-sha, x-active-jobs, x-worker-id',
    },
  });
}

export const dynamic = 'force-dynamic';
