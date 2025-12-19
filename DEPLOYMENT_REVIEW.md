# 배포 전 법적/기능적 검토 보고서

**검토 일자**: 2025-01-XX  
**검토 범위**: 법적 준수사항, 보안, 기능적 안정성

---

## 🔴 긴급 수정 필요 (배포 전 필수)

### 1. 마케팅 수신 동의 체크 누락 ⚠️ **법적 위반 가능**

**위치**: `src/lib/push-notifications.ts`, `src/app/api/push/send/route.ts`

**문제점**:

-   푸시 알림 전송 시 `isMarketingAgreed` 체크가 누락되어 있음
-   정보통신망법 위반 가능 (과태료 최대 3천만원)

**수정 완료**:

-   ✅ `sendPushNotificationToAll()`: 마케팅 동의 사용자만 필터링 추가
-   ✅ `sendPushNotificationToUsers()`: 마케팅 동의 사용자만 필터링 추가
-   ✅ `sendPushNotificationToEveryone()`: 마케팅 동의 사용자만 필터링 추가
-   ✅ `/api/push/send`: 개별 전송 시 마케팅 동의 체크 추가

**추가 권장사항**:

-   서비스 알림(거래/서비스 안내)과 마케팅 알림을 구분하여 처리
-   마케팅 알림은 반드시 `isMarketingAgreed: true` 사용자에게만 전송

---

### 2. 테스트 계정 하드코딩 ⚠️ **보안 위험**

**위치**: `src/app/(home)/courses/[id]/start/page.tsx`

**문제점**:

-   `test@test.com` 계정이 하드코딩되어 GPS 체크를 건너뜀
-   배포 환경에서도 특정 계정에 대한 특별 처리 가능

**수정 완료**:

-   ✅ 환경변수(`NEXT_PUBLIC_TEST_ACCOUNTS`)로 관리하도록 변경
-   ⚠️ **배포 전 반드시 환경변수 설정 또는 해당 코드 제거 필요**

**권장 조치**:

```bash
# .env.production에 추가 (또는 제거)
NEXT_PUBLIC_TEST_ACCOUNTS=test@test.com,dev@example.com
```

---

## 🟡 중요 개선 권장사항

### 3. JWT 토큰 localStorage 저장 ⚠️ **XSS 공격 취약**

**위치**: 전체 프론트엔드 코드 (160개 이상의 `localStorage.getItem("authToken")`)

**문제점**:

-   JWT 토큰이 `localStorage`에 저장되어 XSS 공격에 취약
-   현재 `httpOnly` 쿠키도 함께 사용 중이지만, localStorage 사용은 위험

**현재 상태**:

-   ✅ 로그인 시 `httpOnly` 쿠키에 토큰 저장 (보안)
-   ⚠️ 프론트엔드에서 `localStorage`에도 저장 (위험)

**권장 조치**:

1. **단기**: localStorage 사용을 최소화하고 쿠키 기반 인증으로 전환
2. **장기**: 모든 인증을 `httpOnly` 쿠키로 통일

**참고**: 현재 `middleware.ts`에서 쿠키 기반 인증을 사용 중이므로, 프론트엔드도 쿠키 기반으로 전환 가능

---

### 4. 위치정보 처리 ✅ **법적 준수 확인**

**위치**: `prisma/schema.prisma`, `src/app/api/map/route.ts` 등

**현재 상태**:

-   ✅ `LocationLog` 테이블에 GPS 좌표는 저장하지 않음 (법적 준수)
-   ✅ 위치정보 이용 사실만 기록 (위치정보법 제16조 준수)
-   ✅ 개인정보처리방침에 위치정보 처리 명시

**권장사항**:

-   위치 로그 자동 삭제 스케줄러 구현 (6개월 보관 후 삭제)

---

### 5. 개인정보처리방침 및 이용약관 ✅ **준수 확인**

**위치**: `src/app/(home)/privacy/page.tsx`, `src/app/(home)/terms/page.tsx`

**현재 상태**:

-   ✅ 개인정보처리방침 페이지 존재
-   ✅ 이용약관 페이지 존재
-   ✅ 쿠키 정책 페이지 존재
-   ✅ 데이터 삭제 안내 페이지 존재

**권장사항**:

-   정식 서비스 전환 시 법무팀 검토 권장

---

## 🟢 확인 완료 항목

### 6. 로그인 로그 저장 ✅

-   ✅ `LoginLog` 테이블에 IP 주소 저장 (개인정보보호법 안전조치의무)
-   ✅ 로그인 시 자동 기록

### 7. 마케팅 수신 동의 저장 ✅

-   ✅ 회원가입 시 `isMarketingAgreed`, `marketingAgreedAt` 저장
-   ✅ 동의 철회 시 `marketingAgreedAt`을 null로 변경 가능

### 8. 입력 검증 ✅

-   ✅ 이메일 형식 검증
-   ✅ 비밀번호 길이 검증 (최소 6자)
-   ✅ 이메일 중복 확인

### 9. 에러 처리 ✅

-   ✅ 대부분의 API에서 try-catch 처리
-   ✅ 적절한 HTTP 상태 코드 반환

---

## 📋 배포 전 체크리스트

### 법적 준수

-   [x] 마케팅 수신 동의 체크 추가 (푸시 알림)
-   [x] 위치정보 로그 처리 (GPS 좌표 미저장)
-   [x] 로그인 로그 저장
-   [x] 개인정보처리방침 페이지
-   [x] 이용약관 페이지
-   [x] 쿠키 정책 페이지

### 보안

-   [x] JWT 시크릿 환경변수 설정 확인
-   [x] httpOnly 쿠키 사용
-   [ ] 테스트 계정 하드코딩 제거 또는 환경변수화
-   [ ] XSS 방지를 위한 localStorage 사용 최소화 (장기)

### 기능 안정성

-   [x] 에러 처리 구현
-   [x] 입력 검증 구현
-   [x] API 인증 검증

---

## 🚀 배포 전 최종 확인사항

1. **환경변수 설정 확인**:

    ```bash
    JWT_SECRET=32자 이상의 강력한 시크릿
    DATABASE_URL=프로덕션 DB URL
    NEXT_PUBLIC_TEST_ACCOUNTS=테스트 계정 목록 (또는 제거)
    ```

2. **데이터베이스 마이그레이션**:

    ```bash
    npm run db:migrate
    ```

3. **프로덕션 빌드 테스트**:

    ```bash
    npm run build
    ```

4. **법적 문서 최종 검토**:
    - 개인정보처리방침 최신화 확인
    - 이용약관 최신화 확인

---

## 📞 문의사항

법적 검토가 필요한 경우:

-   개인정보보호위원회 가이드라인 참고
-   법무팀 검토 권장

---

**작성자**: AI Assistant  
**최종 업데이트**: 2025-01-XX
