-- 이슈온 제출 테이블
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  org text not null,
  phone text,
  sns_url text,
  photo_urls text[] not null default '{}',
  drive_links text[] not null default '{}',
  hidden boolean not null default false
);

-- RLS: 서비스 롤 키(서버)만 접근 — 클라이언트 직접 접근 차단
alter table public.submissions enable row level security;

-- Storage 버킷: 대시보드에서 'issueon-photos' 버킷 생성 후 Public 으로 설정

-- 기존 테이블에 갤러리 숨김 컬럼 추가 (이미 운영 중인 경우 이 한 줄만 실행)
alter table public.submissions add column if not exists hidden boolean not null default false;

-- ── 서명운동 ──────────────────────────────────────────
create table if not exists public.signatures (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  district text not null,          -- 자치구
  phone text not null,
  phone_hash text not null unique, -- 중복 서명 차단
  org text,                        -- 소속 (선택)
  signature_url text,              -- 자필 서명 이미지 (비공개 보관)
  drive_link text
);

alter table public.signatures enable row level security;
create index if not exists signatures_district_idx on public.signatures (district);
