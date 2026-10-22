import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    sendDefaultPii: false,
    tracesSampleRate:
        process.env.NODE_ENV === "production"
            ? 0.1
            : process.env.NEXT_PUBLIC_SENTRY_DEBUG_TRACE === "1"
              ? 1.0
              : 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [Sentry.replayIntegration()],
    debug: process.env.NEXT_PUBLIC_SENTRY_DEBUG === "true",
});

// 키가 없거나 개발 모드면 끔 (앱도 __DEV__에서 끔)
if (process.env.NEXT_PUBLIC_POSTHOG_KEY && process.env.NODE_ENV === "production") {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        defaults: "2025-05-24", // App Router 페이지 이동도 $pageview로 잡힘
    });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
