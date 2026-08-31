import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { appendToSheet, uploadToDrive } from '@/lib/google';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_FILES = 3;
const MAX_SIZE = 4 * 1024 * 1024; // 4MB (Vercel 요청 본문 상한 4.5MB 고려)

function kstNow() {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date());
}

function safeName(s) {
  return (s || '').replace(/[^\uAC00-\uD7A3a-zA-Z0-9._-]/g, '_').slice(0, 40);
}

export async function POST(req) {
  try {
    const form = await req.formData();
    const name = String(form.get('name') || '').trim();
    const org = String(form.get('org') || '').trim();
    const phone = String(form.get('phone') || '').trim();
    const snsUrl = String(form.get('snsUrl') || '').trim();
    const files = form.getAll('photos').filter((f) => typeof f === 'object' && f.size > 0);

    if (!name || !org) {
      return NextResponse.json({ ok: false, error: '이름과 소속을 입력해 주세요.' }, { status: 400 });
    }
    if (files.length === 0) {
      return NextResponse.json({ ok: false, error: '사진을 1장 이상 첨부해 주세요.' }, { status: 400 });
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ ok: false, error: `사진은 최대 ${MAX_FILES}장까지 제출할 수 있어요.` }, { status: 400 });
    }
    for (const f of files) {
      if (f.size > MAX_SIZE) {
        return NextResponse.json({ ok: false, error: '사진 용량이 너무 커요. 다시 선택해 주세요.' }, { status: 400 });
      }
      if (!f.type.startsWith('image/')) {
        return NextResponse.json({ ok: false, error: '이미지 파일만 업로드할 수 있어요.' }, { status: 400 });
      }
    }

    const sb = supabaseAdmin();
    const submittedAt = kstNow();
    const stamp = Date.now();
    const photoUrls = [];
    const driveLinks = [];

    // 1) Supabase Storage 업로드 (1차 저장소 — 동시 제출 안전)
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${stamp}_${safeName(name)}_${i + 1}.${ext}`;
      const buffer = Buffer.from(await f.arrayBuffer());

      const { error: upErr } = await sb.storage
        .from('issueon-photos')
        .upload(path, buffer, { contentType: f.type, upsert: false });
      if (upErr) throw new Error(`스토리지 업로드 실패: ${upErr.message}`);

      const { data: pub } = sb.storage.from('issueon-photos').getPublicUrl(path);
      photoUrls.push(pub.publicUrl);

      // 2) 구글 드라이브 미러링 (실패해도 제출은 유지)
      try {
        const d = await uploadToDrive({
          name: `${submittedAt.replace(/[^\d]/g, '').slice(0, 8)}_${safeName(name)}_${safeName(org)}_${i + 1}.${ext}`,
          mimeType: f.type,
          buffer,
        });
        driveLinks.push(d.webViewLink || d.id);
      } catch (e) {
        console.error('Drive mirror failed:', e.message);
        driveLinks.push('(드라이브 저장 실패)');
      }
    }

    // 3) Supabase DB 기록
    const { error: dbErr } = await sb.from('submissions').insert({
      name, org, phone, sns_url: snsUrl, photo_urls: photoUrls, drive_links: driveLinks,
    });
    if (dbErr) throw new Error(`DB 저장 실패: ${dbErr.message}`);

    // 4) 구글 시트 미러링 (실패해도 제출은 유지)
    try {
      await appendToSheet([
        submittedAt, name, org, phone, snsUrl,
        photoUrls.join('\n'), driveLinks.join('\n'),
      ]);
    } catch (e) {
      console.error('Sheet mirror failed:', e.message);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { ok: false, error: '제출 처리 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    );
  }
}
