"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
    error,
}: {
    error: Error & { digest?: string };
}) {
    useEffect(() => {
        if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
            Sentry.captureException(error);
        }
    }, [error]);

    return (
        <html lang="ko">
            <body>
                <h1>문제가 발생했습니다</h1>
                <p>잠시 후 다시 시도해 주세요.</p>
            </body>
        </html>
    );
}
