import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { appendToSheet, uploadToDrive, normalizePrivateKey } from '@/lib/google';

export const runtime = 'nodejs';
export const revalidate = 0;

/** /api/health 로 접속하면 모든 연결을 점검한다 (배포 후 1회 확인용) */
export async function GET() {
  const checks = {};

  checks.env = {
    SUPABASE_URL: !!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || false,
    GOOGLE_PRIVATE_KEY: !!process.env.GOOGLE_PRIVATE_KEY,
  };

  // 키 자체는 노출하지 않고 형태만 진단
  {
    const raw = process.env.GOOGLE_PRIVATE_KEY || '';
    const fixed = normalizePrivateKey(raw);
    checks.privateKeyShape = {
      원본길이: raw.length,
      따옴표포함: raw.trim().startsWith('"') || raw.trim().startsWith("'"),
      실제줄바꿈: (raw.match(/\n/g) || []).length,
      이스케이프줄바꿈: (raw.match(/\\n/g) || []).length,
      BEGIN포함: raw.includes('BEGIN PRIVATE KEY'),
      정규화후줄수: fixed ? fixed.trim().split('\n').length : 0,
      정규화성공: !!fixed && fixed.includes('BEGIN PRIVATE KEY'),
    };
  }

  try {
    const sb = supabaseAdmin();

    try {
      const { error } = await sb.from('submissions').select('id').limit(1);
      checks.table = error ? `실패: ${error.message}` : 'ok';
    } catch (e) {
      checks.table = `실패: ${e.message}`;
    }

    try {
      const { data, error } = await sb.storage.listBuckets();
      if (error) {
        checks.bucket = `실패: ${error.message}`;
      } else {
        const found = (data || []).find((b) => b.name === 'issueon-photos');
        checks.bucket = found
          ? found.public
            ? 'ok (public)'
            : '주의: 버킷이 public이 아닙니다. 갤러리 사진이 보이지 않습니다.'
          : "실패: 'issueon-photos' 버킷이 없습니다.";
      }
    } catch (e) {
      checks.bucket = `실패: ${e.message}`;
    }

    try {
      const probe = Buffer.from('health');
      const path = `_health_${Date.now()}.txt`;
      const { error } = await sb.storage
        .from('issueon-photos')
        .upload(path, probe, { contentType: 'text/plain' });
      if (error) {
        checks.storageWrite = `실패: ${error.message}`;
      } else {
        await sb.storage.from('issueon-photos').remove([path]);
        checks.storageWrite = 'ok';
      }
    } catch (e) {
      checks.storageWrite = `실패: ${e.message}`;
    }
  } catch (e) {
    checks.supabase = `실패: ${e.message}`;
  }

  try {
    await appendToSheet(['[점검]', '자동점검', '삭제해도 됨', '', '', '', '']);
    checks.sheet = 'ok (시트에 [점검] 행이 추가됐습니다 — 지우세요)';
  } catch (e) {
    checks.sheet = `실패: ${e.message}`;
  }

  try {
    const f = await uploadToDrive({
      name: `_점검_${Date.now()}.txt`,
      mimeType: 'text/plain',
      buffer: Buffer.from('health'),
    });
    checks.drive = `ok (${f.webViewLink} — 지우세요)`;
  } catch (e) {
    checks.drive = /storageQuota/i.test(e.message)
      ? '실패: 서비스 계정 용량 문제 — 폴더를 공유 드라이브로 옮기세요.'
      : `실패: ${e.message}`;
  }

  return NextResponse.json(checks, { status: 200 });
}
