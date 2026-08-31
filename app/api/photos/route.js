import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const revalidate = 0;

export async function GET() {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from('submissions')
    .select('id, name, org, photo_urls, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ ok: false, photos: [] }, { status: 500 });

  const photos = [];
  for (const row of data || []) {
    for (const url of row.photo_urls || []) {
      photos.push({ id: `${row.id}-${photos.length}`, url, name: row.name, org: row.org });
    }
  }
  return NextResponse.json({ ok: true, photos });
}
