import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { appendToSignSheet, uploadSignatureToDrive } from '@/lib/google';

export const runtime = 'nodejs';
export const revalidate = 0;

export const SEOUL_DISTRICTS = [
  '강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구',
  '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구',
  '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구',
];

/* 서울 외 지역 — 시·도 단위로 받는다 */
export const OTHER_REGIONS = [
  '경기도', '인천광역시', '강원특별자치도', '충청북도', '충청남도', '대전광역시',
  '세종특별자치시', '전북특별자치도', '전라남도', '광주광역시', '경상북도',
  '대구광역시', '경상남도', '부산광역시', '울산광역시', '제주특별자치도', '해외',
];

export const DISTRICTS = [...SEOUL_DISTRICTS, ...OTHER_REGIONS];

function kstNow() {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date());
}

const digits = (s) => (s || '').replace(/\D/g, '');
const hashPhone = (p) =>
  crypto.createHash('sha256').update(`issueon:${p}`).digest('hex');

/** 서명 현황 — 총 인원수만 공개 */
export async function GET() {
  try {
    const sb = supabaseAdmin();
    const { count, error } = await sb
      .from('signatures')
      .select('id', { count: 'exact', head: true });
    if (error) throw new Error(error.message);
    return NextResponse.json({
      ok: true,
      count: count || 0,
      goal: Number(process.env.SIGN_GOAL || 3000),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, count: 0, goal: 0 }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const name = String(body.name || '').trim();
    const district = String(body.district || '').trim();
    const phone = digits(body.phone);
    const org = String(body.org || '').trim();
    const signature = String(body.signature || ''); // data:image/png;base64,...

    if (!name || name.length > 20) {
      return NextResponse.json({ ok: false, error: '성명을 정확히 입력해 주세요.' }, { status: 400 });
    }
    if (!DISTRICTS.includes(district)) {
      return NextResponse.json({ ok: false, error: '거주 지역을 선택해 주세요.' }, { status: 400 });
    }
    if (phone.length < 10 || phone.length > 11) {
      return NextResponse.json({ ok: false, error: '연락처를 정확히 입력해 주세요.' }, { status: 400 });
    }
    if (!signature.startsWith('data:image/png;base64,')) {
      return NextResponse.json({ ok: false, error: '서명란에 서명해 주세요.' }, { status: 400 });
    }

    const buffer = Buffer.from(signature.split(',')[1], 'base64');
    if (buffer.length > 1024 * 1024) {
      return NextResponse.json({ ok: false, error: '서명 이미지가 너무 큽니다.' }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const phoneHash = hashPhone(phone);

    // 중복 서명 확인
    const { data: dup } = await sb
      .from('signatures')
      .select('id')
      .eq('phone_hash', phoneHash)
      .maybeSingle();
    if (dup) {
      return NextResponse.json(
        { ok: false, error: '이미 서명하셨습니다. 한 분당 한 번만 참여할 수 있어요.' },
        { status: 409 }
      );
    }

    const signedAt = kstNow();
    const day = signedAt.replace(/[^\d]/g, '').slice(0, 8);

    // 자필 서명은 개인정보 — 공개 권한을 주지 않는다 (share: false)
    let signatureUrl = null;
    let driveLink = null;
    try {
      const d = await uploadSignatureToDrive({
        name: `서명_${day}_${district}_${name}_${phone.slice(-4)}.png`,
        buffer,
      });
      signatureUrl = d.id;
      driveLink = d.webViewLink;
    } catch (e) {
      console.error('[sign-drive]', e.message);
    }

    const { error: dbErr } = await sb.from('signatures').insert({
      name, district, phone, phone_hash: phoneHash, org,
      signature_url: signatureUrl, drive_link: driveLink,
    });
    if (dbErr) {
      if (/duplicate key/i.test(dbErr.message)) {
        return NextResponse.json(
          { ok: false, error: '이미 서명하셨습니다. 한 분당 한 번만 참여할 수 있어요.' },
          { status: 409 }
        );
      }
      throw new Error(dbErr.message);
    }

    try {
      await appendToSignSheet([signedAt, name, district, body.phone || phone, org, driveLink || '']);
    } catch (e) {
      console.error('[sign-sheet]', e.message);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[sign]', e);
    return NextResponse.json(
      { ok: false, error: `서명 처리 중 문제가 발생했어요. ${e.message || ''}`.trim() },
      { status: 500 }
    );
  }
}
