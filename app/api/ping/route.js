import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const revalidate = 0;

/** 무료 플랜은 7일간 요청이 없으면 프로젝트가 정지된다.
 *  vercel.json의 크론이 매일 이 엔드포인트를 호출해 깨어 있게 유지한다. */
export async function GET() {
  try {
    const sb = supabaseAdmin();
    await sb.from('submissions').select('id').limit(1);
    return NextResponse.json({ ok: true, at: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
