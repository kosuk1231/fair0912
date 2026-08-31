import { createClient } from '@supabase/supabase-js';

/* 서버 전용 클라이언트 — 브라우저에서 절대 import 하지 말 것.
   URL은 NEXT_PUBLIC_ 접두사 없이 SUPABASE_URL 로 둔다. */
const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

export function supabaseAdmin() {
  if (!URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.');
  }
  return createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}
