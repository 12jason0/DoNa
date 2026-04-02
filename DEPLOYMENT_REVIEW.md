# 배포 검토 보고서

**최종 업데이트**: 2026-03-28 (v1.2.2 기준)

---

## 현재 배포 상태

| 항목 | 상태 |
|------|------|
| Android (Google Play) | v1.2.2 프로덕션 배포 완료 |
| iOS (App Store) | v1.2.2 (buildNumber 37) 배포 완료 |
| 웹 (Vercel/Next.js) | dona.io.kr 운영 중 |
| DB | Neon PostgreSQL (프로덕션) |
| 이미지 | S3 + CloudFront (d13xx6k6chk2in.cloudfront.net) |

---

## v1.2.2에서 수정된 사항

### Android 카카오 로그인
- 기존 `WebBrowser.openAuthSessionAsync` → Chrome Custom Tab → 딥링크 방식은 Android에서 URL 캡처 실패
- `@react-native-kakao/user`의 `login()` 네이티브 SDK로 교체
- 서버 엔드포인트 추가: `POST /api/auth/kakao/native`
- signup.tsx에서 `saveAuthToken` 누락 버그 수정

### Android 코스 상세 지도 모달
- `<Modal transparent>` 안에 NaverMapView → Android에서 지도 검은 화면
- Android에서 `transparent={false}`, 루트 View에 `rgba(0,0,0,0.6)` 배경 적용

### 전체 렉 개선
- `_layout.tsx`에서 `lazy: false` → `lazy: true`
- 기존에는 앱 시작 시 5개 탭 전부 동시 마운트 (mypage 3000줄 등 JS 과부하)
- 수정 후 해당 탭 첫 방문 시에만 로딩

### 스플래시
- 네이티브 스플래시를 마운트 즉시 `hideAsync()`로 제거
- JS `DonaSplashAnimation` 4초 애니메이션으로 대체
- 초기화(RevenueCat, MMKV)는 JS 애니메이션 도는 동안 백그라운드 실행

### 로그인/회원가입 UI
- 카카오/Apple 텍스트 버튼 → 원형 아이콘 버튼 (`KakaoMark`, `AppleMark` SVG)

---

## 법적 준수 현황

| 항목 | 상태 |
|------|------|
| 마케팅 수신 동의 체크 (푸시 알림) | ✅ `isMarketingAgreed` 필터링 적용 |
| 위치정보 GPS 좌표 미저장 | ✅ `LocationLog`에 좌표 저장 안 함 |
| 개인정보처리방침 | ✅ 앱 내 NativeLegalModal + 웹 `/privacy` |
| 이용약관 | ✅ 앱 내 NativeLegalModal + 웹 `/terms` |
| 로그인 이력 저장 | ✅ `LoginLog` 테이블 (IP 포함) |
| 마케팅 동의 저장/철회 | ✅ `isMarketingAgreed`, `marketingAgreedAt` |

---

## 보안 현황

| 항목 | 상태 |
|------|------|
| JWT 인증 | ✅ 모든 API에 `resolveUserId()` 적용 |
| 권한 검증 | ✅ 코스/리뷰 소유자 확인 |
| 입력 검증 | ✅ 타입/범위 검증 |
| Rate Limiting | ⚠️ 미적용 (권장) |
| XSS 방지 | ⚠️ 입력 Sanitization 미적용 |
| 파일 업로드 검증 | ✅ `POST /api/upload/presign` — 타입/크기 확인 |

---

## 다음 배포 전 체크리스트

### 네이티브 빌드 필요 시
- [ ] `app.json` version, buildNumber(iOS), versionCode(Android) 증가
- [ ] `runtimeVersion` 업데이트
- [ ] EAS build 후 스토어 업로드

### OTA 업데이트 가능 시 (JS 변경만)
- [ ] `eas update --branch production` 실행
- [ ] 업데이트 메시지 명시

### 공통
- [ ] 환경 변수 최신 상태 확인
- [ ] Prisma 마이그레이션 적용 여부 확인 (`npx prisma migrate deploy`)
