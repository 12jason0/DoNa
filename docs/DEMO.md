# 관리자 체험 데모 (DEMO_MODE)

누구나 링크로 들어와 관리자 화면을 눌러볼 수 있는 데모. **운영과 완전히 따로** 돈다: 따로 만든 Neon 프로젝트(DB) + 따로 만든 Vercel 프로젝트.
`DEMO_MODE`가 없는 운영 배포는 지금과 똑같이 동작한다.

## 데모에서 달라지는 것

| | 어디서 | 내용 |
|---|---|---|
| 로그인 없이 `/admin` | `src/lib/auth.ts` `verifyAdminJwt`, `AdminAuthGuard` | 데모면 관리자 인증 통과 |
| 공개 화면 5개만 | 사이드바 `src/app/(admin)/layout.tsx`, 주소 `src/lib/demoMiddleware.ts` `PUBLIC_ADMIN_PREFIXES` | 대시보드·팁 검수(통계 포함)·코스 관리·카드뉴스·텔레그램 예시. 그 밖의 `/admin/*`는 `/admin`으로 보냄 |
| 위쪽 띠 "체험용 데모 · 일부 화면만 공개 · 저장되지 않음" | `src/components/DemoBanner.tsx` (루트 레이아웃) | 저장이 막히면 "데모에서는 저장되지 않아요" 토스트 |
| 저장·수정·삭제 차단 ① | 데모 빌드 미들웨어 `src/lib/demoMiddleware.ts` | `/api` 포함 모든 POST/PUT/PATCH/DELETE(서버 액션 포함) → 403. 크론·웹훅·결제·푸시·텔레그램·인스타·번역 경로는 GET도 403 |
| 저장·수정·삭제 차단 ② | `src/lib/demoDb.ts` | Prisma 쓰기 쿼리를 DB에 보내기 전에 거부 |
| 저장·수정·삭제 차단 ③ | Neon 읽기 전용 역할 `dona_demo_reader` | DB가 직접 거부 (`default_transaction_read_only`, SELECT 권한만) |
| 바깥 호출 차단 | `src/lib/demoFetchGuard.ts` + telegram·push·S3·Redis 가드 | Claude·토스·텔레그램·Expo·Resend·Slack·카카오·구글·네이버·인스타·Upstash 등 서버 fetch 전부 거부. Redis는 메모리만, S3는 예외, GTM 미로드 |
| 지도 경로 | `/api/directions` | 네이버 길찾기 대신 장소끼리 직선 |
| 텔레그램 등록 예시 | `/admin/telegram-demo` (데모 전용, 운영은 404) | 봇 대화와 들어온 임시저장 장소를 예시 데이터로 |

### 운영 DB에 닿지 않게 하는 장치
1. 데모 서버는 DB 주소를 **`DEMO_DATABASE_URL`에서만** 읽는다. `DATABASE_URL`·`PRISMA_DATABASE_URL`·`DIRECT_URL` 중 하나라도 환경에 있으면 **시작을 거부**한다.
2. 첫 쿼리 전에 `dona_demo.marker` 표를 확인한다. 이 표는 `npm run demo:seed`만 만든다 → 운영 DB 주소를 실수로 넣어도 모든 쿼리를 거부한다.
3. seed 스크립트는 `DEMO_SEED_DATABASE_URL`에서만 주소를 읽고, marker가 없는 DB는 **모든 표가 비어 있을 때만** 진행한다 (운영 DB면 아무것도 안 바꾸고 중단).
4. 데모 빌드(`npm run build:demo`)가 아니면 `DEMO_MODE`여도 DB를 열지 않는다 (`src/lib/demoBuildFlag.ts`).

## 처음 만들기 (순서대로)

### 1. Neon: 새 **프로젝트** 만들기
- console.neon.tech → **New Project** (예: `dona-demo`, 리전 `AWS Asia Pacific (Singapore)`).
- ⚠️ 운영 프로젝트 안에 **브랜치를 만들지 마세요.** Neon 브랜치는 부모의 데이터(실제 회원 정보)를 그대로 복사합니다.
- Connection string 두 개를 복사:
  - **직접 주소** (Connection pooling 끔, 호스트에 `-pooler` 없음) → seed용
  - **풀링 주소** (Connection pooling 켬, 호스트에 `-pooler`) → 앱용

### 2. 내 컴퓨터에서 seed (PowerShell)
```powershell
$env:DEMO_SEED_DATABASE_URL = "postgresql://neondb_owner:...@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"   # 직접 주소
$env:DEMO_READER_PASSWORD = "<32자 이상 랜덤 문자열>"   # 읽기 전용 역할 비밀번호. 따로 적어 두기
npm run demo:seed
```
끝에 `처리 장소 14곳, 평균 26.0초, 장소당 Claude 58원`이 나오면 성공. 읽기 전용 주소 형식도 같이 출력된다.

### 3. 앱용 주소 만들기
풀링 주소에서 사용자·비밀번호만 바꾸고 끝에 `&pgbouncer=true`:
```
postgresql://dona_demo_reader:<DEMO_READER_PASSWORD>@ep-xxxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true
```

### 4. Vercel: 새 프로젝트
1. Add New → Project → 같은 GitHub 저장소(`12jason0/DoNa`) Import. 이름 예: `dona-admin-demo`
2. **Build Command**: `npm run build:demo` (Override 켜기)
3. Environment Variables (Production·Preview 둘 다):

   | 이름 | 값 |
   |---|---|
   | `DEMO_MODE` | `true` |
   | `DEMO_DATABASE_URL` | 3번의 읽기 전용 주소 |
   | `JWT_SECRET` | 32자 이상 랜덤 (운영과 다른 값) |
   | `ADMIN_JWT_SECRET` | 32자 이상 랜덤 (운영과 다른 값) |
   | `RESEND_API_KEY` | `re_demo_dummy` (빌드 때 값이 비면 안 돼서 넣는 가짜 값. 실제 발송은 막힘) |
   | `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID` | (선택) 지도 표시용. 네이버 클라우드 콘솔 → Maps 앱 → Web 서비스 URL에 데모 도메인 추가 |

   **넣지 말 것**: `DATABASE_URL`, `PRISMA_DATABASE_URL`, `DIRECT_URL`, `ANTHROPIC_API_KEY`, `TELEGRAM_*`, `TOSS_*`, `EXPO_ACCESS_TOKEN`, `AWS_*`/`S3_*`, `UPSTASH_*`, `SENTRY_*`, `RESEND` 실제 키, `KAKAO_*`, `GOOGLE_*`, `NAVER_*`(지도 Client ID 제외), `CRON_SECRET`, `ADMIN_PASSWORD`.
   팀 공유 환경변수(Shared Environment Variables)가 이 프로젝트에 연결돼 있지 않은지도 확인.
4. Deploy. 처음 배포는 `main` 기준이라 데모 코드가 없으니, Settings → Git → **Production Branch**를 `demo/admin-demo`로 바꾸고 다시 배포 (Deployments → … → Redeploy).
5. 배포 로그에 `[demo] 데모 미들웨어(/api 저장 차단) 설치 완료`가 있는지 확인.

### 5. 배포 확인
- `https://<데모 도메인>/admin` → 로그인 없이 대시보드, 위쪽 노란 띠
- 아무 저장 버튼 → "데모에서는 저장되지 않아요"
- `https://<데모 도메인>/admin/refunds` → `/admin`으로 이동
- `curl -X POST https://<데모 도메인>/api/admin/regions` → 403, 헤더 `x-dona-demo-blocked: 1`
- `curl https://<데모 도메인>/api/cron/send-daily-recommendation` → 403

## 유지
- 날짜는 seed 실행 시점 기준. "최근 7일" 그래프가 비어 보이면 2번 seed를 다시 실행 (marker가 있는 데모 DB라 비우고 다시 채움. 읽기 전용 역할 비밀번호도 같은 값으로 다시 넣기).
- `vercel.json`의 크론이 데모 프로젝트에도 등록되지만 미들웨어가 403으로 막는다 (크론 로그에 실패로 보이는 건 정상).
- 로컬에서 `node scripts/demo/prepare.mjs`를 돌렸다면 커밋 전에 `node scripts/demo/prepare.mjs --restore`.
- 예시 이미지(`public/demo/places/*.svg`)는 `node scripts/demo/make-images.mjs`로 다시 만든다.
