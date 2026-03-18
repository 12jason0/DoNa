import * as Sentry from "@sentry/nextjs";

/**
 * API route catch 블록에서 에러를 Sentry로 전송합니다.
 * - 4xx 에러(클라이언트 잘못된 요청)는 Sentry에 보내지 않음
 * - 서버 에러(5xx), DB 에러, 예상치 못한 에러만 보고
 */
export function captureApiError(
    error: unknown,
    context?: Record<string, unknown>
): void {
    // 의도적으로 던진 에러 (비즈니스 로직) 필터링
    if (error instanceof Error) {
        const msg = error.message;
        // 인증 실패, 권한 없음 등 4xx 관련은 노이즈 제거
        if (
            msg === "ADMIN_ONLY" ||
            msg === "UNAUTHORIZED" ||
            msg === "RATE_LIMITED"
        ) {
            return;
        }
    }

    Sentry.captureException(error, {
        extra: context,
    });
}
