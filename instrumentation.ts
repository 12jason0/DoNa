import * as Sentry from "@sentry/nextjs";

export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        // 체험 데모: 서버의 바깥 호출을 전부 막음 (운영은 DEMO_MODE가 없어 건너뜀)
        if (process.env.DEMO_MODE === "true") (await import("@/lib/demoFetchGuard")).installDemoFetchGuard();
        await import("./sentry.server.config");
    }
    if (process.env.NEXT_RUNTIME === "edge") {
        await import("./sentry.edge.config");
    }
}

export const onRequestError = Sentry.captureRequestError;
