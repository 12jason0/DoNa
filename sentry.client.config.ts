import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",

    // 클라이언트 트레이스 샘플링
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 1.0,

    // 개발 중 너무 많은 이벤트 방지
    sampleRate: process.env.NODE_ENV === "production" ? 1.0 : 0.5,

    // 로컬호스트에서는 Sentry로 전송하지 않음
    enabled: process.env.NODE_ENV === "production",

    beforeSend(event) {
        // 네트워크 오류, ResizeObserver 등 노이즈 필터링
        if (event.exception?.values) {
            const msg = event.exception.values[0]?.value ?? "";
            if (
                msg.includes("ResizeObserver loop") ||
                msg.includes("Non-Error promise rejection") ||
                msg.includes("NetworkError") ||
                msg.includes("Load failed")
            ) {
                return null;
            }
        }
        return event;
    },
});
