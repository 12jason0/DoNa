"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLocale } from "@/context/LocaleContext";
import { apiFetch } from "@/lib/authClient";

export default function SuggestCoursePage() {
    const router = useRouter();
    const { isAuthenticated, isLoading, user } = useAuth();
    const { t } = useLocale();

    const CONCEPT_KEYS = [
        "healing", "emotional", "romantic", "cafe", "photo",
        "photoSpot", "nightView", "food", "indoor", "outdoor",
        "culture", "unique", "hotPlace", "activity",
    ] as const;

    const [placeName, setPlaceName] = useState("");
    const [concept, setConcept] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        router.prefetch("/");
    }, [router]);

    const handleSubmit = async () => {
        if (!placeName.trim()) {
            alert(t("suggest.validationAlert"));
            return;
        }
        setSubmitting(true);
        try {
            const { response, data } = await apiFetch("/api/course-suggestions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    placeName: placeName.trim(),
                    concept: concept || undefined,
                }),
            });

            if (response.ok) {
                alert(t("suggest.successAlert"));
                router.push("/mypage?tab=footprint&view=suggestions");
            } else {
                const err = (data as any)?.error;
                alert(err || t("suggest.errorFallback"));
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (isLoading) return null;

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-6">
                <div className="text-center space-y-4 max-w-xs">
                    <p className="text-base text-slate-600 dark:text-slate-400">
                        {t("suggest.loginRequired")}
                    </p>
                    <button
                        onClick={() => router.push("/login")}
                        className="w-full py-3 bg-[#7FCC9F] text-white font-semibold rounded-2xl active:scale-95 transition-transform"
                    >
                        {t("nav.login")}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <div className="max-w-lg mx-auto px-5 py-10 space-y-8">
                {/* 헤더 */}
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        {t("suggest.pageTitle")}
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {t("suggest.pageSubtitle")}
                    </p>
                </div>

                {/* 폼 */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                    {/* 장소 이름 */}
                    <div className="px-5 py-4 space-y-1.5">
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                            {t("suggest.labelPlaceNameSimple")} <span className="text-rose-500">*</span>
                        </label>
                        <input
                            value={placeName}
                            onChange={(e) => setPlaceName(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#7FCC9F] transition-colors"
                            placeholder={t("suggest.placeholderPlaceNameSimple")}
                        />
                    </div>

                    {/* 원하는 컨셉 */}
                    <div className="px-5 py-4 space-y-2.5">
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                            {t("suggest.labelConceptSimple")}
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {CONCEPT_KEYS.map((key) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setConcept(concept === key ? "" : key)}
                                    className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all active:scale-95 ${
                                        concept === key
                                            ? "bg-[#7FCC9F] border-[#7FCC9F] text-white"
                                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                                    }`}
                                >
                                    {t(`courseConcept.${key}`)}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 버튼 */}
                <div className="flex gap-3">
                    <button
                        onClick={() => window.history.back()}
                        disabled={submitting}
                        className="flex-1 py-3.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 active:scale-95 transition-all"
                    >
                        {t("suggest.cancel")}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || !placeName.trim()}
                        className="flex-1 py-3.5 bg-[#7FCC9F] text-white font-semibold rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
                    >
                        {submitting ? t("suggest.submitting") : t("suggest.submit")}
                    </button>
                </div>
            </div>
        </div>
    );
}
