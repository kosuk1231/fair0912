import { NextResponse } from 'next/server';
import { downloadDriveFile } from '@/lib/google';

export const runtime = 'nodejs';
export const revalidate = 0;

/** 비공개 서명 이미지를 관리자에게만 중계한다.
 *  드라이브 파일에는 공개 권한이 없으므로 서버가 서비스 계정으로 받아 전달한다. */
export async function GET(req) {
  const key = process.env.ADMIN_KEY;
  if (!key || req.headers.get('x-admin-key') !== key) {
    return NextResponse.json({ ok: false, error: '권한이 없습니다.' }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: 'id가 필요합니다.' }, { status: 400 });

  try {
    const buf = await downloadDriveFile(id);
    return new NextResponse(buf, {
      headers: { 'content-type': 'image/png', 'cache-control': 'private, max-age=600' },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
