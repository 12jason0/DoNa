import * as Sentry from "@sentry/nextjs";

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

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
