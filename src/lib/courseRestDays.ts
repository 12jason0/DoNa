// 코스 "쉬는 날" — 웹 코스 상세·앱 코스 상세가 같이 씀

type ClosedDayLike = { day_of_week?: number | null };
type CoursePlaceLike = { segment?: string | null; place?: { closed_days?: ClosedDayLike[] | null } | null };
type Translate = (key: any, params?: Record<string, string | number>) => string;

/**
 * 코스 쉬는 요일 (0=일, 월→일 순). 정기 휴무(day_of_week)만 보고 특정 날짜 휴무는 뺌.
 * 고정 장소(segment 없음)는 그 장소 휴무 요일 그대로, 선택형 구간은 선택지가 모두 쉬는 요일만 (하나라도 열면 갈 수 있음)
 */
export function courseRestDays(coursePlaces: CoursePlaceLike[]): number[] {
    const weekly = (cp: CoursePlaceLike) =>
        new Set((cp.place?.closed_days ?? []).map((d) => d.day_of_week).filter((d): d is number => d != null));
    const groups: Set<number>[] = [];
    const segments = new Map<string, Set<number>[]>();
    for (const cp of coursePlaces) {
        if (!cp.place) continue;
        if (cp.segment) segments.set(cp.segment, [...(segments.get(cp.segment) ?? []), weekly(cp)]);
        else groups.push(weekly(cp));
    }
    for (const opts of segments.values()) groups.push(new Set([...opts[0]].filter((d) => opts.every((o) => o.has(d)))));
    return [1, 2, 3, 4, 5, 6, 0].filter((d) => groups.some((g) => g.has(d)));
}

/** "쉬는 날: 월·화" / 없으면 "매일 갈 수 있어요" */
export function courseRestDaysLabel(coursePlaces: CoursePlaceLike[], t: Translate): string {
    const days = courseRestDays(coursePlaces);
    if (days.length === 0) return t("courseDetail.openEveryDay");
    return t("courseDetail.restDays", { days: days.map((d) => t(`courseDetail.dayShort${d}`)).join("·") });
}
