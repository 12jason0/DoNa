import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",

    // 프로덕션에서는 10% 트레이스 샘플링, 개발에서는 전부
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // 에러 샘플링: 프로덕션 100% (에러는 전부 수집)
    sampleRate: 1.0,

    // 민감 정보 필터링
    beforeSend(event) {
        // 인증 실패(401/403) 같은 비즈니스 예외는 노이즈로 제거
        if (event.exception?.values) {
            const msg = event.exception.values[0]?.value ?? "";
            if (msg === "ADMIN_ONLY" || msg === "UNAUTHORIZED" || msg === "RATE_LIMITED") {
                return null;
            }
        }
        return event;
    },

    // 개발 환경에서는 콘솔 출력
    debug: process.env.NODE_ENV === "development",
});
