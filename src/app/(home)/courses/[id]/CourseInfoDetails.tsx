"use client";

import { COURSE_DETAIL_SENTINELS } from "@/lib/courseDetailSentinels";
import { pickPlaceName } from "@/lib/placeLocalized";
import type { CourseData } from "./CourseDetailClient";

type Translate = (key: any, params?: Record<string, string | number>) => string;

/** 요일 짧은 이름 (0=일) — 2026-10-04는 일요일 */
function weekdayName(day: number, locale: string): string {
    return new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(
        new Date(Date.UTC(2026, 9, 4 + day)),
    );
}

/**
 * 코스 상세 하단 접힌 '코스 정보' (SEO). <details>라 접혀 있어도 HTML에 들어감 — 봇·사람 동일.
 * FREE: 소요시간·예산·장소별 영업시간·예약 여부·마지막 수정일 / 유료: 소요시간·예산·마지막 수정일만 (장소·팁 없음)
 */
export default function CourseInfoDetails({
    course,
    locale,
    t,
}: {
    course: CourseData;
    locale: string;
    t: Translate;
}) {
    const isFree = (course.grade || "FREE").toUpperCase() === "FREE";
    const duration = course.duration && course.duration !== COURSE_DETAIL_SENTINELS.duration ? course.duration : null;
    // 한국 날짜 기준 (서버·클라이언트 시간대가 달라도 같은 값 → hydration 일치)
    const updated = course.updatedAt
        ? new Date(new Date(course.updatedAt).getTime() + 9 * 3600_000).toISOString().slice(0, 10).replace(/-/g, ".")
        : null;
    const rows: [string, string | null][] = [
        [t("courseDetail.info.duration"), duration],
        [t("courseDetail.info.budget"), course.budget_range || null],
        [t("courseDetail.info.updated"), updated],
    ];
    const places = isFree ? (course.coursePlaces || []).filter((cp: any) => cp.place) : [];

    return (
        <details className="group rounded-2xl border border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-900/60 mb-24">
            <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-4 text-base font-bold text-gray-900 dark:text-white">
                {t("courseDetail.info.title")}
                <span className="text-gray-400 transition-transform group-open:rotate-180" aria-hidden>
                    ▾
                </span>
            </summary>
            <div className="px-6 pb-5 text-sm text-gray-700 dark:text-gray-300">
                <dl className="space-y-1.5">
                    {rows
                        .filter(([, v]) => v)
                        .map(([k, v]) => (
                            <div key={k} className="flex gap-3">
                                <dt className="w-24 shrink-0 text-gray-500 dark:text-gray-400">{k}</dt>
                                <dd>{v}</dd>
                            </div>
                        ))}
                </dl>
                {places.length > 0 && (
                    <>
                        <h3 className="mt-4 mb-2 font-semibold text-gray-900 dark:text-white">
                            {t("courseDetail.info.placeHours")}
                        </h3>
                        <ul className="space-y-2">
                            {places.map((cp: any) => {
                                const weekly = [
                                    ...new Set(
                                        (cp.place.closed_days || [])
                                            .map((d: any) => d.day_of_week)
                                            .filter((d: any) => d != null),
                                    ),
                                ] as number[];
                                return (
                                    <li key={cp.id}>
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {pickPlaceName(cp.place, locale as any)}
                                        </span>
                                        <span className="block text-gray-600 dark:text-gray-400">
                                            {cp.place.opening_hours || t("courseDetail.info.hoursUnknown")}
                                            {weekly.length > 0 &&
                                                ` · ${t("courseDetail.info.closedWeekly", {
                                                    days: weekly
                                                        .sort()
                                                        .map((d) => weekdayName(d, locale))
                                                        .join(", "),
                                                })}`}
                                            {` · ${
                                                cp.place.reservation_required
                                                    ? t("courseDetail.info.reservationNeeded")
                                                    : t("courseDetail.info.reservationNotNeeded")
                                            }`}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    </>
                )}
            </div>
        </details>
    );
}
