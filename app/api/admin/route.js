import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SEOUL_DISTRICTS } from '@/app/api/sign/route';

export const runtime = 'nodejs';
export const revalidate = 0;

function authorized(req) {
  const key = process.env.ADMIN_KEY;
  if (!key) return 'unset';
  return req.headers.get('x-admin-key') === key ? true : false;
}

/** 관리자용 전체 목록 (숨김 포함) */
export async function GET(req) {
  const auth = authorized(req);
  if (auth === 'unset') {
    return NextResponse.json({ ok: false, error: 'ADMIN_KEY 환경변수를 설정한 뒤 재배포하세요.' }, { status: 503 });
  }
  if (!auth) return NextResponse.json({ ok: false, error: '관리자 키가 올바르지 않습니다.' }, { status: 401 });

  const sb = supabaseAdmin();
  const kind = new URL(req.url).searchParams.get('kind') || 'photos';

  if (kind === 'signatures') {
    const { data, error } = await sb
      .from('signatures')
      .select('id, created_at, name, district, phone, org, drive_link')
      .order('district', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(20000);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    const seoul = {};
    const other = {};
    for (const r of data) {
      const bucket = SEOUL_DISTRICTS.includes(r.district) ? seoul : other;
      bucket[r.district] = (bucket[r.district] || 0) + 1;
    }
    const seoulTotal = Object.values(seoul).reduce((a, b) => a + b, 0);

    return NextResponse.json({
      ok: true,
      rows: data,
      seoul,
      other,
      seoulTotal,
      otherTotal: data.length - seoulTotal,
      total: data.length,
    });
  }

  const { data, error } = await sb
    .from('submissions')
    .select('id, created_at, name, org, phone, sns_url, photo_urls, drive_links, hidden')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rows: data });
}

/** 숨김/표시 전환 */
export async function POST(req) {
  const auth = authorized(req);
  if (auth !== true) {
    return NextResponse.json({ ok: false, error: '관리자 키가 올바르지 않습니다.' }, { status: 401 });
  }
  const { id, hidden } = await req.json();
  if (!id || typeof hidden !== 'boolean') {
    return NextResponse.json({ ok: false, error: '잘못된 요청입니다.' }, { status: 400 });
  }
  const sb = supabaseAdmin();
  const { error } = await sb.from('submissions').update({ hidden }).eq('id', id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
