# 이슈온 ISSUE ON — 인증사진 제출 페이지

2026 서울사회복지사 등반대회 · 공정위원회 현안대응 캠페인 '이슈온'
판넬 인증사진을 제출받아 **Supabase(1차 저장) + 구글 시트/드라이브(자동 미러링)** 에 보관합니다.

## 아키텍처

```
참여자(QR → 모바일)
   │  브라우저에서 1600px·JPEG로 압축 후 전송
   ▼
Vercel (Next.js /api/submit)
   ├─ ① Google Drive   ← 사진 원본 (주 저장소, 협회 계정 용량)
   ├─ ② Supabase Storage ← 드라이브 실패 시에만 대피
   ├─ ③ Supabase DB    ← 제출 기록 텍스트 행만
   └─ ④ Google Sheets  ← 제출 목록 자동 행 추가
```

**왜 드라이브가 주 저장소인가**

Supabase 무료 플랜은 파일 저장소 1GB, 대역폭 10GB가 상한입니다. 등반대회 1,200명이
장당 300KB로 3장씩 올리면 최대 1.08GB로 한도를 넘깁니다. 갤러리를 현장 스크린에
띄우면 대역폭도 빠르게 소모되고요. 한도 초과 시 유예기간 뒤 업로드가 차단되므로
행사 당일 위험합니다.

그래서 사진은 협회 구글 계정 용량을 쓰는 드라이브에 저장하고, 갤러리도
`drive.google.com/thumbnail` 로 드라이브가 직접 서빙합니다. Supabase는 텍스트 행만
담아 500MB DB 한도에 사실상 닿지 않습니다.

드라이브 업로드가 실패하면 그때만 Supabase Storage로 대피시켜 사진 유실을 막고,
시트에 `(드라이브 실패 — Supabase 임시 보관)` 으로 표시합니다.

### 프로젝트 자동 정지 방지

무료 플랜은 7일간 요청이 없으면 프로젝트가 정지됩니다. `vercel.json` 에 매일 03:00
`/api/ping` 을 호출하는 크론을 넣어 깨어 있게 유지합니다. 행사 전날 한 번
`/api/health` 로 확인해 두면 확실합니다.

## 1. Supabase 설정 (5분)

1. [supabase.com](https://supabase.com) 새 프로젝트 생성
2. **SQL Editor**에서 `supabase/schema.sql` 실행
3. **Storage → New bucket** → 이름 `issueon-photos`, **Public bucket 체크**
   (드라이브 실패 시 대피용이라 평소에는 비어 있습니다)
4. **Settings → API**에서 `Project URL`, `service_role` 키 복사

## 환경변수 (Vercel)

| Key | Type | 값 |
|---|---|---|
| `SUPABASE_URL` | Config | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** | service_role 키 |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Config | `kosuk1231@clim-503123.iam.gserviceaccount.com` |
| `GOOGLE_PRIVATE_KEY` | **Secret** | `-----BEGIN PRIVATE KEY-----\n…` |
| `SHEET_ID` | Config | 생략 가능 (코드 기본값 있음) |
| `SHEET_TAB` | Config | 생략 가능 |
| `DRIVE_FOLDER_ID` | Config | 생략 가능 |

> ⚠️ **`NEXT_PUBLIC_` 접두사를 붙이지 마세요.** 붙이면 값이 브라우저 번들에 그대로
> 노출되고, Vercel도 Secret으로 저장하지 못하게 막습니다. 이 프로젝트는 Supabase를
> 서버(API 라우트)에서만 호출하므로 접두사가 필요 없습니다.

> Environments는 **Production · Preview · Development 세 개 모두** 체크하세요.
> Production만 체크하면 미리보기 배포에서 제출이 실패합니다.

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

## 문제가 생기면 — /api/health

배포 URL 뒤에 `/api/health` 를 붙여 브라우저로 열면 모든 연결을 실제로 시도해 보고
어디가 막혔는지 JSON으로 알려줍니다.

```
https://<배포주소>/api/health
```

| 항목 | 확인 내용 |
|---|---|
| `env` | 환경변수 4개가 들어와 있는지 |
| `table` | `submissions` 테이블 존재·권한 |
| `bucket` | `issueon-photos` 버킷 존재·public 여부 |
| `storageWrite` | 실제 업로드 가능 여부 |
| `sheet` | 시트에 행 추가 가능 여부 |
| `drive` | 드라이브 업로드 가능 여부 |

시트에 `[점검]` 행, 드라이브에 `_점검_*.txt` 가 남으니 확인 후 지우세요.

### 자주 나오는 실패

| 증상 | 원인 | 조치 |
|---|---|---|
| `Bucket not found` | 버킷 미생성 | Storage에서 `issueon-photos` 생성 (Public) |
| `relation ... does not exist` | 테이블 미생성 | `supabase/schema.sql` 실행 |
| `Request Entity Too Large` | 요청 4.5MB 초과 | 사진 자동 압축이 적용됐는지 확인 |
| `storageQuotaExceeded` | 서비스 계정 용량 없음 | 드라이브 폴더를 공유 드라이브로 이동 |
| 환경변수 누락 | Vercel 저장 후 재배포 안 함 | 저장 뒤 **Redeploy** 필요 |

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
