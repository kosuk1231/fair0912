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

/** 드라이브 파일명용 — 한글 허용 */
function safeName(s) {
  return (s || '').replace(/[^\uAC00-\uD7A3a-zA-Z0-9._-]/g, '_').slice(0, 40);
}

/** Supabase Storage 키용 — 한글·공백 불가(Invalid key), ASCII만 남긴다 */
function asciiKey(s) {
  const out = (s || '').replace(/[^a-zA-Z0-9._-]/g, '');
  return out.slice(0, 24) || 'x';
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
      return NextResponse.json({ ok: false, error: '성함과 소속을 입력해 주세요.' }, { status: 400 });
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
    const day = submittedAt.replace(/[^\d]/g, '').slice(0, 8);

    const photoUrls = [];   // 갤러리 표시용
    const driveLinks = [];  // 시트 기록용
    let driveFailed = 0;
    let driveError = null;

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
      const buffer = Buffer.from(await f.arrayBuffer());
      const fileName = `${day}_${safeName(name)}_${safeName(org)}_${i + 1}.${ext}`;

      // ① 1차 저장소: 구글 드라이브 (협회 계정 용량 사용)
      try {
        const d = await uploadToDrive({ name: fileName, mimeType: f.type, buffer });
        photoUrls.push(d.thumbnailUrl);
        driveLinks.push(d.webViewLink);
        continue;
      } catch (e) {
        console.error('[drive]', e.message);
        driveFailed++;
        driveError = e.message;
      }

      // ② 드라이브 실패 시에만 Supabase Storage로 대피 (사진 유실 방지)
      const path = `${stamp}_${asciiKey(name)}_${i + 1}.${asciiKey(ext) || 'jpg'}`;
      const { error: upErr } = await sb.storage
        .from('issueon-photos')
        .upload(path, buffer, { contentType: f.type, upsert: false });
      if (upErr) throw new Error(`사진 저장 실패: ${upErr.message}`);

      const { data: pub } = sb.storage.from('issueon-photos').getPublicUrl(path);
      photoUrls.push(pub.publicUrl);
      driveLinks.push('(드라이브 실패 — Supabase 임시 보관)');
    }

    // ③ Supabase DB: 텍스트 행만 기록 (용량 부담 없음)
    const { error: dbErr } = await sb.from('submissions').insert({
      name, org, phone, sns_url: snsUrl, photo_urls: photoUrls, drive_links: driveLinks,
    });
    if (dbErr) throw new Error(`DB 저장 실패: ${dbErr.message}`);

    // ④ 구글 시트 기록 (실패해도 제출은 유지)
    try {
      await appendToSheet([
        submittedAt, name, org, phone, snsUrl,
        photoUrls.join('\n'), driveLinks.join('\n'),
      ]);
    } catch (e) {
      console.error('[sheet]', e.message);
    }

    return NextResponse.json({ ok: true, driveFailed, driveError });
  } catch (e) {
    console.error('[submit]', e);
    const m = e.message || '';
    let hint = '제출 처리 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.';

    if (/Bucket not found/i.test(m)) {
      hint = '설정 오류: Supabase에 issueon-photos 버킷이 없습니다. (관리자 확인 필요)';
    } else if (/환경변수/.test(m)) {
      hint = '설정 오류: 서버 환경변수가 누락됐습니다. (관리자 확인 필요)';
    } else if (/relation .* does not exist|schema cache/i.test(m)) {
      hint = '설정 오류: submissions 테이블이 없습니다. (관리자 확인 필요)';
    } else if (/row-level security|permission denied/i.test(m)) {
      hint = '설정 오류: Supabase 권한(service_role 키)을 확인해 주세요.';
    } else if (m) {
      hint = `제출 실패: ${m}`;
    }

    return NextResponse.json({ ok: false, error: hint }, { status: 500 });
  }
}
