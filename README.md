# 이슈온 ISSUE ON — 인증사진 제출 페이지

2026 서울사회복지사 등반대회 · 공정위원회 현안대응 캠페인 '이슈온'
판넬 인증사진을 제출받아 **Supabase(1차 저장) + 구글 시트/드라이브(자동 미러링)** 에 보관합니다.

## 아키텍처

```
참여자(QR → 모바일)
   │  사진 제출
   ▼
Vercel (Next.js /api/submit)
   ├─ ① Supabase Storage  ← 사진 원본 (동시 제출 안전)
   ├─ ② Supabase DB       ← 제출 기록 (submissions 테이블)
   ├─ ③ Google Drive      ← 사진 자동 복사 (미러)
   └─ ④ Google Sheets     ← 제출 목록 자동 행 추가 (미러)
```

- Supabase가 **원본(source of truth)** — 시트/드라이브가 순간 장애여도 제출은 유실되지 않습니다.
- 시트 `append`는 동시 호출에 안전해 여러 명이 동시에 제출해도 행이 겹치지 않습니다.

## 1. Supabase 설정 (5분)

1. [supabase.com](https://supabase.com) 새 프로젝트 생성
2. **SQL Editor**에서 `supabase/schema.sql` 실행
3. **Storage → New bucket** → 이름 `issueon-photos`, **Public bucket 체크**
4. **Settings → API**에서 `Project URL`, `service_role` 키 복사

## 2. 구글 설정

연결 대상은 코드에 기본값으로 들어가 있습니다.

| 항목 | ID |
|---|---|
| 스프레드시트 | `1mVZfJWcm5kfNxeAwqGoYp24Ok0Q9skZM3qxJL8p-pSw` |
| 드라이브 폴더 | `1U8Da_CIJcLsFFmiaa66nIkCHyU3G1tdA` |
| 서비스 계정 | `kosuk1231@clim-503123.iam.gserviceaccount.com` |

**해야 할 일은 하나뿐입니다**

> 위 시트와 드라이브 폴더를 **서비스 계정 이메일에 '편집자'로 공유**

탭과 헤더는 손으로 만들 필요 없습니다. 첫 제출이 들어오는 순간 `lib/google.js`의
`ensureSheet()`가 `제출목록` 탭이 없으면 만들고, 헤더 행을 채운 뒤 서식까지 잡습니다.

| 자동 처리 | 내용 |
|---|---|
| 탭 생성 | `제출목록` 탭이 없으면 생성 |
| 헤더 입력 | 제출일시 · 성함 · 소속 · 연락처 · SNS링크 · 사진URL · 드라이브링크 |
| 서식 | 헤더 틸색 배경 + 흰색 굵은 글씨, 1행 고정, 열 너비 조정 |

이미 헤더가 있으면 건드리지 않습니다. 점검은 서버 인스턴스당 1회만 돌아 매 제출마다
API를 더 부르지 않습니다.

> ⚠️ 서비스 계정은 자체 저장용량이 없어 **개인 '내 드라이브' 폴더에는 업로드가 거부될 수 있습니다**
> (`storageQuotaExceeded`). 해당 폴더가 개인 드라이브에 있다면 **공유 드라이브(Shared Drive)** 로
> 옮기고 서비스 계정을 콘텐츠 관리자로 추가하세요. 코드에는 `supportsAllDrives`가 적용돼 있습니다.

### 사전 점검

배포 전에 권한이 제대로 잡혔는지 확인:

```bash
npm install
export GOOGLE_SERVICE_ACCOUNT_EMAIL="kosuk1231@clim-503123.iam.gserviceaccount.com"
export GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
node scripts/check-google.mjs
```

시트 쓰기·드라이브 업로드를 실제로 한 번 시도하고, 실패 원인까지 한국어로 알려줍니다.

## 3. 배포 (GitHub → Vercel)

```bash
git init && git add . && git commit -m "issueon"
gh repo create issueon-2026 --private --push --source=.
```

Vercel에서 리포 Import → **Environment Variables**에 `.env.example`의 6개 값 입력 → Deploy.

> `GOOGLE_PRIVATE_KEY`는 JSON 키 파일의 `private_key` 값을 줄바꿈 포함 그대로(또는 `\n` 형태로) 붙여넣으면 됩니다.

## 4. QR코드

배포 URL(예: `https://issueon-2026.vercel.app`)로 QR 생성 → 현장 판넬·배너에 부착.
`/gallery`는 30초마다 자동 갱신되므로 **현장 스크린에 띄워두면 실시간 포토월**이 됩니다.

## 폼 항목

| 항목 | 필수 | 비고 |
|---|---|---|
| 성함 / 소속 | ✅ | |
| 연락처 | 선택 | 이벤트 안내용 |
| SNS 게시물 링크 | 선택 | |
| 사진 | ✅ | 최대 3장, 장당 10MB |
| 활용 동의 | ✅ | 협회 SNS·홈페이지·정책자료 활용 |

## 로컬 개발

```bash
npm install
cp .env.example .env.local   # 값 채우기
npm run dev
```
