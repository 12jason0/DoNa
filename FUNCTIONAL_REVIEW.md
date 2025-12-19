# 기능적 검토 보고서

**검토 일자**: 2025-01-XX  
**검토 범위**: API 기능, 입력 검증, 권한 검증, 에러 처리, 데이터 일관성

---

## ✅ 수정 완료 항목

### 1. 리뷰 중복 체크 추가 ✅

**위치**: `src/app/api/reviews/route.ts`

**문제점**:

-   사용자가 같은 코스에 여러 리뷰를 작성할 수 있음
-   데이터 일관성 문제

**수정 내용**:

-   ✅ 중복 리뷰 체크 추가
-   ✅ 기존 리뷰가 있으면 업데이트하도록 변경
-   ✅ rating 범위 검증 추가 (1-5 정수만 허용)

---

### 2. 코스 수정/삭제 권한 검증 추가 ✅

**위치**: `src/app/api/courses/[id]/route.ts`

**문제점**:

-   코스 소유자 확인 없이 누구나 수정/삭제 가능
-   보안 취약점

**수정 내용**:

-   ✅ PATCH: 코스 소유자 확인 추가
-   ✅ DELETE: 코스 소유자 확인 추가
-   ✅ 소유자가 아니면 403 Forbidden 반환

---

### 3. JSON 파싱 에러 처리 개선 ✅

**위치**: `src/app/api/reviews/route.ts`, `src/app/api/courses/[id]/route.ts`

**문제점**:

-   `request.json()` 호출 시 에러 처리 미흡
-   잘못된 JSON 형식 시 500 에러 발생

**수정 내용**:

-   ✅ `.catch()` 추가하여 JSON 파싱 실패 시 400 에러 반환
-   ✅ 명확한 에러 메시지 제공

---

### 4. 에러 메시지 보안 개선 ✅

**위치**: `src/app/api/reviews/route.ts`

**문제점**:

-   상세한 에러 메시지가 클라이언트에 노출됨
-   내부 구조 정보 유출 가능

**수정 내용**:

-   ✅ 상세 에러는 서버 로그에만 기록
-   ✅ 클라이언트에는 일반적인 메시지만 반환
-   ✅ Prisma 에러는 적절히 변환하여 반환

---

## 🟡 개선 권장사항

### 5. Rate Limiting 부재 ⚠️

**문제점**:

-   API 호출 제한이 없어 DDoS 공격에 취약
-   무제한 요청으로 인한 서버 부하 가능

**권장 조치**:

```typescript
// 예시: next-rate-limit 또는 upstash/ratelimit 사용
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, "10 s"),
});
```

**우선순위**: 중간 (프로덕션 배포 전 권장)

---

### 6. 입력 길이 제한 부족 ⚠️

**위치**: 여러 API

**문제점**:

-   리뷰 코멘트, 코스 제목 등에 길이 제한 없음
-   DB 오버플로우 가능성

**권장 조치**:

```typescript
// 리뷰 코멘트 길이 제한
if (finalComment.length > 1000) {
    return NextResponse.json({ error: "리뷰는 1000자 이하로 작성해주세요." }, { status: 400 });
}

// 코스 제목 길이 제한
if (title && title.length > 100) {
    return NextResponse.json({ error: "제목은 100자 이하로 작성해주세요." }, { status: 400 });
}
```

**우선순위**: 낮음 (DB 스키마에 제한이 있지만, 명시적 검증 권장)

---

### 7. 관리자 권한 체크 부재 ⚠️

**위치**: `src/app/api/courses/[id]/route.ts`, `src/app/api/places/[id]/route.ts`

**문제점**:

-   관리자가 모든 코스/장소를 수정/삭제할 수 있어야 하는데, 현재는 소유자만 가능
-   관리자 체크 로직 없음

**권장 조치**:

```typescript
// 관리자 체크 헬퍼 함수 추가
async function isAdmin(userId: number): Promise<boolean> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true }, // role 필드 추가 필요
    });
    return user?.role === "ADMIN";
}

// 코스 수정 시
if (course.userId && course.userId !== Number(userIdStr) && !(await isAdmin(Number(userIdStr)))) {
    return NextResponse.json({ error: "코스를 수정할 권한이 없습니다." }, { status: 403 });
}
```

**우선순위**: 중간 (관리자 기능이 필요한 경우)

---

### 8. 트랜잭션 처리 부족 ⚠️

**위치**: 여러 API

**문제점**:

-   여러 DB 작업이 원자적으로 처리되지 않음
-   부분 실패 시 데이터 불일치 가능

**예시**:

```typescript
// 리뷰 생성 시 코스 평점 업데이트도 함께 처리해야 함
await prisma.$transaction([
  prisma.review.create({ ... }),
  prisma.course.update({
    where: { id: courseId },
    data: { rating: newAverageRating },
  }),
]);
```

**우선순위**: 낮음 (현재는 큰 문제 없지만, 향후 개선 권장)

---

### 9. 입력 Sanitization 부족 ⚠️

**문제점**:

-   XSS 공격 방지를 위한 HTML 이스케이프 처리 없음
-   사용자 입력이 그대로 저장됨

**권장 조치**:

```typescript
import DOMPurify from "isomorphic-dompurify";

// 리뷰 코멘트 sanitize
const sanitizedComment = DOMPurify.sanitize(finalComment, {
    ALLOWED_TAGS: [], // HTML 태그 모두 제거
    ALLOWED_ATTR: [],
});
```

**우선순위**: 중간 (사용자 입력이 표시되는 경우 필수)

---

### 10. 파일 업로드 검증 부족 ⚠️

**위치**: `src/app/api/upload/route.ts`

**문제점**:

-   파일 크기, 타입 검증이 충분하지 않을 수 있음
-   악성 파일 업로드 가능성

**권장 조치**:

```typescript
// 파일 크기 제한 (예: 5MB)
if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "파일 크기는 5MB 이하여야 합니다." }, { status: 400 });
}

// 파일 타입 검증
const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "지원하지 않는 파일 형식입니다." }, { status: 400 });
}
```

**우선순위**: 높음 (보안 관련)

---

## 🟢 확인 완료 항목

### 11. 인증 검증 ✅

-   ✅ 대부분의 API에서 `resolveUserId()` 또는 `getUserIdFromRequest()` 사용
-   ✅ 인증 실패 시 401 반환

### 12. 입력 타입 검증 ✅

-   ✅ 숫자 타입 검증 (`Number.isFinite()`)
-   ✅ 필수 필드 검증

### 13. 에러 처리 ✅

-   ✅ 대부분의 API에서 try-catch 사용
-   ✅ 적절한 HTTP 상태 코드 반환

### 14. 데이터베이스 제약 조건 ✅

-   ✅ Unique 제약 조건 활용 (UserFavorite, SavedCourse 등)
-   ✅ Foreign Key 제약 조건으로 데이터 무결성 보장

---

## 📋 추가 확인 필요 항목

### 15. 로깅 및 모니터링

-   [ ] API 호출 로깅 (성공/실패)
-   [ ] 느린 쿼리 감지
-   [ ] 에러 알림 시스템

### 16. 캐싱 전략

-   [ ] 자주 조회되는 데이터 캐싱 (코스 목록, 리뷰 등)
-   [ ] Redis 또는 Next.js 캐싱 활용

### 17. API 문서화

-   [ ] OpenAPI/Swagger 문서 생성
-   [ ] API 엔드포인트 명세서 작성

---

## 🚀 배포 전 최종 체크리스트

### 기능 안정성

-   [x] 리뷰 중복 체크
-   [x] 권한 검증
-   [x] 입력 검증
-   [x] 에러 처리
-   [ ] Rate limiting (권장)
-   [ ] 입력 길이 제한 (권장)
-   [ ] XSS 방지 (권장)

### 성능

-   [ ] 데이터베이스 인덱스 확인
-   [ ] N+1 쿼리 문제 확인
-   [ ] 캐싱 전략 수립

### 보안

-   [x] 인증 검증
-   [x] 권한 검증
-   [ ] Rate limiting
-   [ ] 입력 Sanitization
-   [ ] 파일 업로드 검증

---

## 📞 다음 단계

1. **즉시 수정**: Rate limiting, 파일 업로드 검증
2. **단기 개선**: 입력 길이 제한, XSS 방지
3. **중기 개선**: 관리자 권한 체크, 트랜잭션 처리
4. **장기 개선**: 로깅/모니터링, 캐싱 전략

---

**작성자**: AI Assistant  
**최종 업데이트**: 2025-01-XX
