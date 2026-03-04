"use client";

import { memo, useMemo } from "react";
import { useLocale } from "@/context/LocaleContext";
import type { TranslationKeys } from "@/types/i18n";

/**
 * 페이지 전환 시 공통 로딩 UI (loading.tsx에서 사용)
 */
function PageLoadingSpinner({
    messageKey,
    message,
}: {
    messageKey?: Extract<TranslationKeys, `loading.${string}`>;
    message?: string;
}) {
    const { t } = useLocale();
    const displayMessage = useMemo(
        () => (messageKey ? t(messageKey) : message ?? t("loading.findingCourses")),
        [messageKey, message, t],
    );

    return (
        <main className="min-h-screen bg-white/80 dark:bg-[#0f1710]/90 backdrop-blur-sm flex flex-col items-center justify-center fixed inset-0 z-9999 pointer-events-none">
            <div className="flex flex-col items-center gap-6 animate-fadeIn">
                <div className="relative">
                    <div className="h-16 w-16 rounded-full border-[6px] border-emerald-100 dark:border-emerald-900/30" />
                    <div className="absolute top-0 left-0 h-16 w-16 rounded-full border-[6px] border-t-emerald-500 dark:border-t-emerald-400 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-2xl animate-pulse">📍</div>
                </div>
                <div className="text-center space-y-1">
                    <h3 className="text-emerald-900 dark:text-emerald-400 font-extrabold text-lg tracking-tight">DoNa</h3>
                    <p className="text-emerald-600/80 dark:text-emerald-400/80 text-xs font-medium tracking-wide animate-pulse">{displayMessage}</p>
                </div>
            </div>
        </main>
    );
}

export default memo(PageLoadingSpinner);
