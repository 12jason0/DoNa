"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "@/context/LocaleContext";
import TranslatedCourseTitle from "@/components/TranslatedCourseTitle";
import TapFeedback from "@/components/TapFeedback";

export type ReportedSuggestion = {
    id: number;
    placeName: string;
    placeAddress?: string | null;
    description?: string | null;
    note?: string | null;
    status: "PENDING" | "PUBLISHED" | "REJECTED";
    createdAt: string;
    course?: {
        id: number;
        title: string;
        title_en?: string | null;
        title_ja?: string | null;
        title_zh?: string | null;
        imageUrl?: string | null;
        region?: string | null;
        duration?: string | null;
    } | null;
};

type Props = {
    suggestions: ReportedSuggestion[];
    isLoading: boolean;
};

const STATUS_STYLE: Record<ReportedSuggestion["status"], string> = {
    PENDING: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
    PUBLISHED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    REJECTED: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

export default function ReportedCoursesCTA({ suggestions, isLoading }: Props) {
    const router = useRouter();
    const { t } = useLocale();

    if (isLoading) return null;

    return (
        <section className="px-5 py-4 space-y-3">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-[14px] font-bold text-slate-900 dark:text-white">
                        {t("home.myReportedCourses.title")}
                    </p>
                    {suggestions.length > 0 && (
                        <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {t("home.myReportedCourses.subtitle")}
                        </p>
                    )}
                </div>
                <TapFeedback>
                    <button
                        onClick={() => router.push("/suggest")}
                        className="text-xs font-semibold text-[#7FCC9F] active:opacity-70 transition-opacity"
                    >
                        {t("home.myReportedCourses.suggestBtn")}
                    </button>
                </TapFeedback>
            </div>

            {suggestions.length === 0 ? (
                /* 빈 상태 */
                <TapFeedback className="w-full">
                    <button
                        onClick={() => router.push("/suggest")}
                        className="w-full text-left p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-0.5 active:scale-[0.99] transition-transform"
                    >
                        <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">
                            {t("home.myReportedCourses.emptyTitle")}
                        </p>
                        <p className="text-[12px] text-slate-400 dark:text-slate-500">
                            {t("home.myReportedCourses.emptySubtitle")}
                        </p>
                    </button>
                </TapFeedback>
            ) : (
                /* 제보 목록 */
                <div className="space-y-2">
                    {suggestions.map((s) => (
                        <TapFeedback key={s.id} className="w-full">
                            <button
                                onClick={() => s.course && router.push(`/courses/${s.course.id}`)}
                                className="w-full text-left flex items-center gap-3 p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl active:scale-[0.99] transition-transform disabled:cursor-default"
                                disabled={!s.course}
                            >
                                {/* 코스 이미지 또는 장소 플레이스홀더 */}
                                <div className="w-12 h-12 shrink-0 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                    {s.course?.imageUrl ? (
                                        <img
                                            src={s.course.imageUrl}
                                            alt=""
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-xl">📍</span>
                                    )}
                                </div>

                                {/* 텍스트 */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-200 truncate">
                                        {s.course ? (
                                            <TranslatedCourseTitle
                                                title={s.course.title}
                                                title_en={s.course.title_en ?? undefined}
                                                title_ja={s.course.title_ja ?? undefined}
                                                title_zh={s.course.title_zh ?? undefined}
                                            />
                                        ) : (
                                            s.placeName
                                        )}
                                    </p>
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                                        {s.course
                                            ? [s.course.region, s.course.duration].filter(Boolean).join(" · ")
                                            : s.placeAddress ?? ""}
                                    </p>
                                </div>

                                {/* 상태 뱃지 */}
                                <span
                                    className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[s.status]}`}
                                >
                                    {t(`home.myReportedCourses.status.${s.status}`)}
                                </span>
                            </button>
                        </TapFeedback>
                    ))}
                </div>
            )}
        </section>
    );
}
