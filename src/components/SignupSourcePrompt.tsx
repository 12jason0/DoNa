"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLocale } from "@/context/LocaleContext";

const OPTIONS = [
    { value: "instagram", key: "authPage.signup.sourceInstagram" },
    { value: "search", key: "authPage.signup.sourceSearch" },
    { value: "friend", key: "authPage.signup.sourceFriend" },
    { value: "share_link", key: "authPage.signup.sourceShareLink" },
    { value: "other", key: "authPage.signup.sourceOther" },
] as const;

// 가입·로그인·온보딩 화면 위에는 안 띄움 (흐름 끝나고 다음 화면에서)
const HIDDEN_PATHS = ["/login", "/signup", "/onboarding"];

/** 가입 직후 한 번만: "두나 어디서 알게 됐어요?" (서버가 띄울지 결정) */
export default function SignupSourcePrompt() {
    const { isAuthenticated, user } = useAuth();
    const { t } = useLocale();
    const pathname = usePathname() || "";
    const [open, setOpen] = useState(false);
    const hidden = HIDDEN_PATHS.some((p) => pathname.startsWith(p));

    useEffect(() => {
        if (!isAuthenticated || hidden) return;
        let cancelled = false;
        fetch("/api/users/me/signup-source", { credentials: "include", cache: "no-store" })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => !cancelled && d?.ask && setOpen(true))
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [isAuthenticated, user?.id, hidden]);

    const answer = (value: string) => {
        setOpen(false);
        fetch("/api/users/me/signup-source", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ answer: value }),
        }).catch(() => {});
    };

    if (!open) return null;
    return (
        <div className="fixed inset-0 z-2000 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-end justify-center">
            <div className="w-full max-w-md bg-white dark:bg-[#1a241b] rounded-t-2xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight text-center">
                    {t("authPage.signup.sourceTitle")}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1 mb-5">
                    {t("authPage.signup.sourceSub")}
                </p>
                <div className="grid grid-cols-2 gap-2">
                    {OPTIONS.map((o) => (
                        <button
                            key={o.value}
                            onClick={() => answer(o.value)}
                            className="px-4 py-3.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-bold text-[15px] hover:bg-emerald-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            {t(o.key)}
                        </button>
                    ))}
                </div>
                <button
                    onClick={() => answer("skipped")}
                    className="w-full mt-3 py-3 text-sm font-semibold text-gray-500 dark:text-gray-400"
                >
                    {t("authPage.signup.sourceSkip")}
                </button>
            </div>
        </div>
    );
}
