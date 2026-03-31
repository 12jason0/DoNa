"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect, useState } from "react";

const LOCALE_KEY = "dona-locale";

type AppLocale = "ko" | "en" | "ja" | "zh";

const MESSAGES: Record<AppLocale, { title: string; description: string }> = {
    ko: {
        title: "문제가 발생했습니다",
        description: "잠시 후 다시 시도해 주세요.",
    },
    en: {
        title: "Something went wrong",
        description: "Please try again in a moment.",
    },
    ja: {
        title: "問題が発生しました",
        description: "しばらくしてからもう一度お試しください。",
    },
    zh: {
        title: "出现了问题",
        description: "请稍后再试。",
    },
};

function readStoredLocale(): AppLocale {
    if (typeof window === "undefined") return "ko";
    try {
        const v = window.localStorage.getItem(LOCALE_KEY);
        if (v === "en" || v === "ja" || v === "zh" || v === "ko") return v;
    } catch {
        /* ignore */
    }
    return "ko";
}

export default function GlobalError({
    error,
}: {
    error: Error & { digest?: string };
}) {
    const [locale, setLocale] = useState<AppLocale>("ko");

    useEffect(() => {
        setLocale(readStoredLocale());
    }, []);

    useEffect(() => {
        if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
            Sentry.captureException(error);
        }
    }, [error]);

    const m = MESSAGES[locale];
    const htmlLang = locale === "zh" ? "zh-CN" : locale;

    return (
        <html lang={htmlLang}>
            <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: "32rem" }}>
                <h1 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>{m.title}</h1>
                <p style={{ color: "#555", lineHeight: 1.5 }}>{m.description}</p>
            </body>
        </html>
    );
}
