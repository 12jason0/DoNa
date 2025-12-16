# StyleMap - AI-Powered Travel Course Recommendation System

StyleMap은 초개인화(Hyper-Personalization)를 지향하는 여행 코스 추천 플랫폼입니다. 사용자 선호(온보딩), 실시간 컨텍스트(오늘 목적/동반자/분위기/지역), 최근 행동 데이터를 결합해 체감 품질 높은 추천을 제공합니다.

## 🚀 주요 기능

### 🎯 AI 추천 시스템 (현재 운영 로직)

-   **Rule-based Scoring**: 아래 4축 가중치로 점수화한 뒤 상위 N개 추천
    -   conceptMatch × 0.25
    -   moodMatch × 0.25
    -   regionMatch × 0.20
    -   goalMatch × 0.30
-   **장기 선호도(온보딩)**: `concept[]`, `mood[]`, `regions[]`, `companion`를 `user_preferences.preferences` JSON에 저장해 반영
-   **오늘의 컨텍스트(실시간)**: 쿼리 파라미터로 전달
    -   `goal`, `companion_today`, `mood_today`, `region_today`
-   **보너스 점수**: 최근 상호작용(개념/지역) + 인기도(view_count) + 평점(rating)
-   **폴백**: 가용 추천이 부족하면 인기 코스 반환
-   **ML 엔진(옵션)**: TensorFlow.js 기반 심층 모델이 준비되어 있으며, 필요 시 스위치-온 가능한 구조(현재 기본 경로는 Rule-based)

### 📊 A/B 테스트 시스템

-   **알고리즘 비교**: 다양한 추천 알고리즘의 성능 비교
-   **통계적 유의성**: 실시간 통계 분석 및 결과 해석
-   **트래픽 분할**: 사용자 그룹별 차별화된 테스트
-   **성과 모니터링**: CTR, 전환율, 수익 등 핵심 지표 추적

### 📈 실시간 성과 모니터링

-   **시스템 헬스**: CPU, 메모리, 응답시간 모니터링
-   **비즈니스 지표**: 수익, 사용자 만족도, 재방문율 추적
-   **알림 시스템**: 임계값 기반 실시간 알림
-   **트렌드 분석**: 시간별 성과 변화 추이

### 💬 피드백 시스템

-   **사용자 피드백**: 추천 품질에 대한 상세한 피드백 수집
-   **AI 학습**: 피드백 데이터를 활용한 모델 개선
-   **성과 분석**: 만족도, 정확도 등 품질 지표 분석
-   **개선 제안**: 사용자 의견 기반 시스템 개선

## 🏗️ 기술 스택

### Frontend

-   **Next.js 14**: React 기반 풀스택 프레임워크
-   **TypeScript**: 타입 안전성 보장
-   **Tailwind CSS**: 유틸리티 기반 스타일링
-   **Recharts**: 데이터 시각화 라이브러리

### AI/ML

-   **Rule-based 엔진**: 태그 매칭 기반 가중 합 점수
-   **TensorFlow.js 모델(옵션)**: 다층 신경망 추천기(해석 가능 사유 생성 지원)
-   **특성 엔지니어링**: 사용자/아이템/컨텍스트 특성
-   (운영) 기본 경로는 Rule-based, ML은 점진 도입 가능

### Backend

-   **Next.js API Routes**: 서버리스 API
-   **Prisma**: 데이터베이스 ORM
-   **PostgreSQL**: 관계형 데이터베이스

## 📁 프로젝트 구조

```
src/
├── app/
│   ├── api/                    # API 엔드포인트
│   │   ├── ab-tests/          # A/B 테스트 관리
│   │   ├── feedback/          # 피드백 시스템
│   │   └── notifications/     # 알림 시스템
│   ├── ab-testing/            # A/B 테스트 대시보드
│   ├── feedback/              # 피드백 페이지
│   ├── notifications/         # 알림 센터
│   ├── performance-monitoring/ # 성과 모니터링
│   └── personalized-home/     # AI 추천 홈
├── components/                # 재사용 가능한 컴포넌트
├── lib/
│   ├── db.ts                 # 데이터베이스 연결
│   └── ml/
│       └── deepLearningRecommender.ts # AI 추천 엔진
└── types/                    # TypeScript 타입 정의
```

## 🎯 AI 추천 시스템 아키텍처

### 1. 특성 엔지니어링

-   **사용자 특성**: 나이, 선호도, 행동 패턴, 위치, 시간
-   **아이템 특성**: 카테고리, 가격, 평점, 인기도, 콘텐츠
-   **컨텍스트 특성**: 날씨, 요일, 계절, 공휴일

### 2. 딥러닝 모델

```
사용자 임베딩 (32차원)
    ↓
아이템 임베딩 (32차원) → 결합 → 심층 신경망 → 다중 출력
    ↓
컨텍스트 임베딩 (16차원)
```

### 3. 다중 목표 최적화

-   **평점 예측**: 사용자 만족도 예측
-   **클릭 예측**: 관심도 예측
-   **전환 예측**: 예약 확률 예측

## 📊 A/B 테스트 시스템

### 테스트 구성

-   **컨트롤 그룹**: 기존 알고리즘
-   **실험 그룹**: 새로운 알고리즘
-   **트래픽 분할**: 50:50 또는 사용자 정의 비율
-   **지속 기간**: 설정 가능한 테스트 기간

### 성과 지표

-   **CTR (Click-Through Rate)**: 클릭률
-   **전환율**: 예약 완료율
-   **수익**: 매출액
-   **통계적 유의성**: p-value 기반 결과 검증

## 🔧 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.local` 파일을 생성하고 다음 내용을 추가하세요:

```bash
# .env.local

# 데이터베이스 설정 (Neon PostgreSQL 권장)
# 자세한 설정 방법은 DATABASE_URL_SETUP.md 참고
DATABASE_URL="postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require"

# 기타 설정
NEXT_PUBLIC_KAKAO_MAP_API_KEY="your_kakao_map_api_key"

# Expo Push Notification (선택사항, 프로덕션 권장)
# Expo 대시보드에서 Access Token 발급: https://expo.dev/accounts/[your-account]/settings/access-tokens
EXPO_ACCESS_TOKEN="your_expo_access_token_here"
```

⚠️ **중요**: `DATABASE_URL`에는 `&pgbouncer=true`를 추가하고, `DIRECT_URL`에는 추가하지 마세요.
자세한 내용은 `DATABASE_URL_SETUP.md` 파일을 참고하세요.

### 3. 데이터베이스 설정

```bash
npx prisma generate
npx prisma db push
```

### 4. 개발 서버 실행

```bash
npm run dev
```

## 🚀 배포

### Vercel 배포

```bash
npm run build
vercel --prod
```

### 환경 변수 설정

-   Vercel 대시보드에서 환경 변수 설정
-   데이터베이스 연결 정보 구성
-   API 키 설정

## 📈 성능 최적화

### 모델 최적화

-   **배치 처리**: 대량 데이터 효율적 처리
-   **메모리 관리**: TensorFlow.js 메모리 정리
-   **캐싱**: 추천 결과 캐싱으로 응답 속도 향상

### 프론트엔드 최적화

-   **코드 스플리팅**: 페이지별 번들 분리
-   **이미지 최적화**: Next.js Image 컴포넌트 활용
-   **SSR/SSG**: 서버 사이드 렌더링 최적화

### 로그인/라우팅 최적화

-   **Prefetch**: 주요 페이지 사전 로드
-   **로딩 상태 UX**: 로그인 중 오버레이, 빠른 `router.replace`/`prefetch` 기반 전환
-   **이미지 LCP 최적화**: 첫 1~2장 `priority`, `fetchPriority="high"`, `sizes`/`quality` 최적 설정

## 🔒 보안

### 데이터 보호

-   **개인정보 암호화**: 사용자 데이터 보안
-   **API 인증**: JWT 기반 인증 시스템
-   **입력 검증**: XSS, SQL Injection 방지

### AI 모델 보안

-   **모델 검증**: 입력 데이터 검증
-   **결과 필터링**: 부적절한 추천 필터링
-   **접근 제어**: 모델 접근 권한 관리

## 🤝 기여하기

### 개발 환경 설정

1. 프로젝트 포크
2. 로컬 환경 설정
3. 기능 브랜치 생성
4. 코드 작성 및 테스트
5. Pull Request 생성

### 코딩 컨벤션

-   **TypeScript**: 엄격한 타입 체크
-   **ESLint**: 코드 품질 관리
-   **Prettier**: 코드 포맷팅
-   **커밋 메시지**: Conventional Commits

## 📝 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 📞 지원

-   **이슈 리포트**: GitHub Issues
-   **문서**: 프로젝트 Wiki
-   **이메일**: support@stylemap.com

---

**StyleMap** - AI로 더 스마트한 여행을 경험하세요! 🎯✈️

## 🗄️ 데이터베이스 스키마 (칼럼 상세)

아래는 `prisma/schema.prisma` 기준 실제 DB 모델과 컬럼 정의입니다. `@@map()`이 지정된 경우 DB의 실제 테이블명도 함께 표기했습니다.

### User (`users`)

| 컬럼            | 타입      | 기본값/제약      | 설명              |
| --------------- | --------- | ---------------- | ----------------- |
| id              | Int       | PK, auto         | 사용자 ID         |
| email           | String?   | unique           | 이메일            |
| password        | String?   |                  | 해시 비밀번호     |
| username        | String    | map("nickname")  | 닉네임            |
| profileImageUrl | String?   |                  | 프로필 이미지     |
| socialId        | String?   |                  | 소셜 로그인 ID    |
| provider        | String    | default("local") | 로그인 제공자     |
| createdAt       | DateTime  | now()            | 생성일            |
| updatedAt       | DateTime  | @updatedAt       | 수정일            |
| mbti            | String?   |                  | MBTI              |
| age             | Int?      |                  | 나이              |
| coinBalance     | Int       | default(0)       | 코인 잔액         |
| couponCount     | Int       | default(0)       | AI 쿠폰 개수      |
| gender          | String?   |                  | 성별              |
| lastActiveAt    | DateTime? |                  | 최근 활동         |
| level           | Int       | default(1)       | 레벨              |
| location        | String?   |                  | 선호 지역         |
| preferredTags   | String[]  |                  | 선호 태그(레거시) |
| totalWaterGiven | Int       | default(0)       | 누적 물 주기      |
| waterStock      | Int       | default(0)       | 보유 물           |
| ageRange        | String?   |                  | 연령대            |
| birthday        | DateTime? |                  | 생일              |
| phone           | String?   |                  | 전화번호          |

연관: completedCourses, completedEscapes, bookings, courses, reviews, trees, userFavorites, interactions, userPreference, rewards, userBadges, checkins, UserCollage, waterLogs, userStoryProgress, pushTokens, garden 등

### UserPreference (`user_preferences`)

| 컬럼        | 타입     | 제약                   | 설명                                                                                                  |
| ----------- | -------- | ---------------------- | ----------------------------------------------------------------------------------------------------- |
| id          | Int      | PK, auto               | ID                                                                                                    |
| userId      | Int      | unique, map("user_id") | `users.id` FK                                                                                         |
| preferences | Json     |                        | 온보딩/설정 값 저장: `{ concept: string[], companion: string, mood: string[], regions: string[] }` 등 |
| createdAt   | DateTime | now()                  |                                                                                                       |
| updatedAt   | DateTime | @updatedAt             |                                                                                                       |

### PushToken (`push_tokens`)

| 컬럼       | 타입     | 제약            | 설명      |
| ---------- | -------- | --------------- | --------- |
| id         | String   | PK, cuid()      | 토큰 ID   |
| userId     | Int      | unique          | 사용자    |
| token      | String   |                 | 푸시 토큰 |
| platform   | String   | default("expo") | 플랫폼    |
| subscribed | Boolean  | default(true)   | 구독 여부 |
| createdAt  | DateTime | now()           |           |
| updatedAt  | DateTime | @updatedAt      |           |

### Course (`courses`)

| 컬럼                 | 타입           | 설명                                                                 |
| -------------------- | -------------- | -------------------------------------------------------------------- |
| id                   | Int (PK, auto) | 코스 ID                                                              |
| userId               | Int?           | 작성자                                                               |
| title                | String         | 제목                                                                 |
| description          | String?        | 설명                                                                 |
| imageUrl             | String?        | 대표 이미지                                                          |
| region               | String?        | 지역                                                                 |
| duration             | String?        | 소요시간                                                             |
| concept              | String?        | 콘셉트 키워드                                                        |
| tags                 | Json?          | AI 추천용 태그 JSON `{ concept, mood, target, time, budget, theme }` |
| isPopular            | Boolean        | default(false)                                                       |
| rating               | Float          | default(0)                                                           |
| current_participants | Int            | default(0)                                                           |
| max_participants     | Int            | default(0)                                                           |
| view_count           | Int            | default(0)                                                           |
| createdAt            | DateTime       | now()                                                                |
| updatedAt            | DateTime       | @updatedAt                                                           |

인덱스: concept, region, title  
연관: courseDetail(1:1), CourseTagToCourses(N:M), benefits, bookings, coursePlaces, highlights, reviews, userFavorites, interactions 등

> 참고: `/api/courses` 응답의 `tags`(문자열 배열)는 `CourseTagToCourses` 조인 결과이며, 추천 점수에서 사용하는 `Course.tags`(JSON)과는 별개입니다. 추천은 `Course.tags` JSON을 활용합니다.

### CourseDetail (`course_details`)

| 컬럼                   | 타입           | 설명              |
| ---------------------- | -------------- | ----------------- |
| id                     | Int (PK, auto) |                   |
| course_id              | Int (unique)   | `courses.id` FK   |
| recommended_start_time | String?        | 추천 시작 시간    |
| season                 | String?        | 추천 계절         |
| course_type            | String?        | 유형(액티비티 등) |
| transportation         | String?        | 교통              |

### CoursePlace (`course_places`)

| 컬럼               | 타입           | 설명              |
| ------------------ | -------------- | ----------------- |
| id                 | Int (PK, auto) |                   |
| course_id          | Int            | 코스              |
| place_id           | Int            | 장소              |
| order_index        | Int            | 코스 내 순서      |
| estimated_duration | Int?           | 추정 소요시간(분) |
| recommended_time   | String?        | 추천 시간대       |
| notes              | String?        | 메모              |

### Place (`places`)

| 컬럼                 | 타입           | 설명            |
| -------------------- | -------------- | --------------- |
| id                   | Int (PK, auto) | 장소 ID         |
| name                 | String         | 장소명          |
| address              | String?        | 주소            |
| description          | String?        | 설명            |
| category             | String?        | 카테고리        |
| avg_cost_range       | String?        | 평균 비용대     |
| opening_hours        | String?        | 영업시간        |
| phone                | String?        | 전화            |
| website              | String?        | 웹사이트        |
| parking_available    | Boolean?       | 주차 가능       |
| reservation_required | Boolean?       | 예약 필요       |
| latitude             | Float?         | 위도            |
| longitude            | Float?         | 경도            |
| imageUrl             | String?        | 이미지          |
| tags                 | Json?          | 장소 태그(JSON) |
| created_at           | DateTime       | now()           |
| updated_at           | DateTime       | @updatedAt      |

> 현재 추천 점수는 기본적으로 코스 단위의 `Course.tags`를 사용합니다. `Place.tags`는 장소 검색/메타 용도로 보관되며, 필요 시 코스 구성 시점에 집계해 `Course.tags`로 병합하는 확장을 고려할 수 있습니다.

### PlaceClosedDay (`place_closed_days`)

| 컬럼          | 타입           | 설명        |
| ------------- | -------------- | ----------- |
| id            | Int (PK, auto) |             |
| place_id      | Int            | 장소        |
| day_of_week   | Int?           | 요일(0-6)   |
| specific_date | DateTime?      | 특정 휴무일 |
| note          | String?        | 비고        |

### CourseTag (`course_tags`) / CourseTagToCourses (`_CourseTagToCourses`)

-   `CourseTag`는 태그 마스터 테이블(name unique)
-   `CourseTagToCourses`는 코스-태그 연결 테이블(복합 PK [A, B])

### Review (`reviews`)

| 컬럼      | 타입           | 설명       |
| --------- | -------------- | ---------- |
| id        | Int (PK, auto) |            |
| userId    | Int            | 사용자     |
| courseId  | Int            | 코스       |
| rating    | Int            | 평점(1~5)  |
| comment   | String?        | 코멘트     |
| createdAt | DateTime       | now()      |
| updatedAt | DateTime       | @updatedAt |

### Booking (`bookings`)

| 컬럼         | 타입           | 설명              |
| ------------ | -------------- | ----------------- |
| id           | Int (PK, auto) |                   |
| user_id      | Int            | 사용자            |
| course_title | String         | 예약 제목(스냅샷) |
| booking_date | Date           | 예약일            |
| status       | String         | 상태              |
| price        | String         | 가격              |
| participants | Int            | 인원              |
| created_at   | DateTime       | now()             |
| updated_at   | DateTime       | @updatedAt        |
| course_id    | Int            | 코스              |

### UserFavorite (`user_favorites`)

| 컬럼       | 타입           | 제약                       |
| ---------- | -------------- | -------------------------- |
| id         | Int (PK, auto) |                            |
| user_id    | Int            |                            |
| course_id  | Int            | unique(user_id, course_id) |
| created_at | DateTime       | now()                      |

### UserInteraction (`user_interactions`)

| 컬럼      | 타입           | 설명                                |
| --------- | -------------- | ----------------------------------- |
| id        | Int (PK, auto) |                                     |
| userId    | Int            | 사용자                              |
| courseId  | Int            | 코스                                |
| action    | String         | view/click/like/share/time_spent 등 |
| createdAt | DateTime       | now()                               |

### Highlight (`highlights`)

| 컬럼        | 타입           | 설명            |
| ----------- | -------------- | --------------- |
| id          | Int (PK, auto) |                 |
| course_id   | Int            | 코스            |
| title       | String         | 하이라이트 제목 |
| description | String?        | 설명            |
| icon        | String?        | 아이콘          |
| created_at  | DateTime       | now()           |

### Benefit (`benefits`)

| 컬럼          | 타입           | 설명        |
| ------------- | -------------- | ----------- |
| id            | Int (PK, auto) |             |
| course_id     | Int            | 코스        |
| benefit_text  | String         | 혜택 텍스트 |
| category      | String?        | 카테고리    |
| display_order | Int?           | 표시 순서   |
| created_at    | DateTime       | now()       |

### CourseNotice (`course_notices`)

| 컬럼          | 타입           | 설명            |
| ------------- | -------------- | --------------- |
| id            | Int (PK, auto) |                 |
| course_id     | Int            | 코스            |
| notice_text   | String         | 공지 텍스트     |
| type          | String?        | default("info") |
| display_order | Int?           | default(0)      |
| created_at    | DateTime       | now()           |
| updatedAt     | DateTime       | @updatedAt      |

### UserReward (`user_rewards`)

| 컬럼      | 타입           | 설명               |
| --------- | -------------- | ------------------ |
| id        | Int (PK, auto) |                    |
| userId    | Int            | 사용자             |
| amount    | Int            | 수량               |
| type      | RewardType     | signup/checkin/... |
| unit      | RewardUnit     | coin/coupon/water  |
| createdAt | DateTime       | now()              |
| placeId   | Int?           | 장소 기반 보상용   |

### UserCheckin (`user_checkins`)

| 컬럼      | 타입           | 설명        |
| --------- | -------------- | ----------- |
| id        | Int (PK, auto) |             |
| userId    | Int            | 사용자      |
| date      | DateTime       | 체크인 일자 |
| rewarded  | Boolean        | 보상 여부   |
| createdAt | DateTime       | now()       |

### Story (`stories`) / StoryUI (`story_ui`)

스토리 메타와 UI 토큰/플로우 JSON을 분리 저장. `StoryUI`는 스토리와 1:1.

### PlaceOption, PlaceDialogue, PlaceMission, PlaceStory

이스케이프/스토리 플레이를 위한 장소/대화/미션/연출 테이블.

### UserCollage (`user_collages`) / CollageTemplate (`collage_templates`)

유저 콜라주 결과와 템플릿 정의.

### Badge (`badges`) / UserBadge (`user_badges`)

뱃지 정의와 사용자 보유 뱃지 연결.

### CompletedCourse (`CompletedCourses`) / CompletedEscape (`CompletedEscapes`)

완료 기록.

### Tree (`trees`) / WaterLog (`water_logs`) / Garden (`gardens`) / GardenTree (`garden_trees`)

가든/나무/물주기 기능을 위한 테이블.

### MissionSubmission (`mission_submissions`)

이스케이프 미션 제출(사진/텍스트/정답 등) 기록.

---

### Enums

-   ChapterType: intro, restaurant, cafe, spot, final_spot, ending
-   MissionType: quiz, photo, gps, puzzle, text, choice
-   RewardType: signup, checkin, ad_watch, purchase, event, escape_place_clear
-   RewardUnit: coin, coupon, water
-   SpeakerRole: user, npc, system, clear_place, mission_start
-   TreeStatus: seedling, growing, completed
-   WaterSource: course, escape, admin, bonus
-   PlaceTheme: footsteps, history, time, location
