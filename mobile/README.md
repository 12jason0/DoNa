# DoNa 모바일 앱 (React Native / Expo)

Expo Router 기반 풀 네이티브 앱. WebView 구조에서 완전 전환 완료.

- **Bundle ID**: kr.io.dona.dona
- **Expo SDK**: ~54.0.33 / RN: 0.81.5
- **웹 도메인**: dona.io.kr
- **EAS Project ID**: 78b14f63-823b-4fb6-ba4a-8c5a8528a204

---

## 실행 방법

```bash
cd mobile
npm install
npx expo start
```

> 네이티브 모듈(MMKV, 네이버 지도, 카카오 SDK) 포함으로 **Expo Go 사용 불가**.
> 반드시 EAS dev build 기기에서 실행해야 함.

### EAS 빌드

```bash
# 개발 빌드
eas build --profile development --platform android
eas build --profile development --platform ios

# 프로덕션 빌드
eas build --profile production --platform android
eas build --profile production --platform ios

# OTA 업데이트 (JS 변경만)
eas update --branch production --message "설명"
```

---

## 앱 구조

```
mobile/
├── app/                        # Expo Router 화면
│   ├── (tabs)/
│   │   ├── index.tsx           # 홈 (활성코스 배너, 오늘의 추천, AI CTA, 추억 갤러리)
│   │   ├── courses.tsx         # 코스 목록 (히어로 슬라이더, 컨셉 필터, 무한스크롤)
│   │   ├── explore.tsx         # 주변 탐색 (네이버 지도, 마커/폴리라인, 바텀시트)
│   │   ├── ai.tsx              # AI 추천 (FLOW 채팅, 하루 1회 제한)
│   │   └── mypage.tsx          # 마이페이지 (프로필/발자취/기록/활동 4탭)
│   ├── (auth)/
│   │   ├── login.tsx           # 이메일 + 카카오 + Apple 로그인
│   │   └── signup.tsx          # 회원가입 + 소셜
│   ├── courses/[id]/
│   │   ├── index.tsx           # 코스 상세 (지도, 장소 순환, 예약/찜/공유, 리뷰)
│   │   └── start.tsx           # 추억 기록 (사진 최대 10장, 별점, 설명, 태그, S3 업로드)
│   ├── escape/
│   │   ├── index.tsx           # 이스케이프 게임 목록
│   │   └── [id].tsx            # 이스케이프 게임 상세 + 플레이
│   ├── nearby.tsx              # 오늘 뭐하지 (검색, 무한스크롤, 찜)
│   └── shop.tsx                # 구독/결제 (RevenueCat)
└── src/
    ├── components/             # 공통 컴포넌트 23개
    ├── constants/theme.ts      # 디자인 토큰
    ├── hooks/                  # useAuth, useThemeColors 등
    ├── lib/                    # api.ts, mmkv.ts, imageUrl.ts 등
    └── types/api.ts            # API 타입 정의
```

---

## 주요 패키지

| 패키지 | 용도 |
|--------|------|
| `expo-router ~5.0.0` | 파일 기반 라우팅 |
| `@tanstack/react-query ^5.62.0` | 서버 상태 관리 |
| `react-native-mmkv ^3.1.0` | 로컬 스토리지 (토큰, userId) |
| `@mj-studio/react-native-naver-map ^2.7.0` | 네이버 지도 |
| `@react-native-kakao/core+user ^2.4.2` | 카카오 네이티브 로그인 |
| `expo-apple-authentication` | Apple 로그인 (iOS 전용) |
| `react-native-purchases ^8.2.1` | RevenueCat 인앱 결제 |
| `expo-notifications` | 푸시 알림 |
| `expo-location` | 위치 정보 |
| `expo-image-picker` | 사진 선택 |
| `react-native-reanimated ~4.1.1` | 애니메이션 |

---

## 인증 구조

- **토큰 저장**: MMKV (`authToken`, `userId`)
- **카카오 로그인**: `@react-native-kakao/user`의 `login()` 네이티브 SDK → 서버 `/api/auth/kakao/native` (POST)
- **Apple 로그인**: `expo-apple-authentication` → iOS 전용
- **이메일 로그인**: `/api/auth/login` (POST)
- **세션 관리**: TanStack Query `AUTH_QUERY_KEY` 캐시

---

## 딥링크 / Universal Link

- **커스텀 스킴**: `duna://`, `kakaoa6c31213198b3d562121ddace8d1b65f://`
- **Universal Link**: `dona.io.kr` → `app/courses/[id]/view.tsx`에서 네이티브로 리다이렉트

---

## 의도적으로 미구현 (나중에 추가 예정)

- 앱 시작 시 자동 현위치 탐색 (현재 서울시청 고정, 버튼으로 이동)
- AI 채팅 대화 히스토리 저장 (추천 결과 코스만 마이페이지에 저장)
- 완전 오프라인 지원 (TanStack Query 캐시만)

---

## 스타일 규칙

- NativeWind 미사용 → **`StyleSheet.create()` + `src/constants/theme.ts` 토큰 사용**
- 폰트: LINESeedKR
