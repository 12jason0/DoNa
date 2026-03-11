/**
 * courses/nearby 페이지용 시간대 매칭 점수 (segment 기반 정렬)
 * 메인 추천 API는 timeOfDay를 보내지 않으므로 사용하지 않음.
 */
export function getTimeMatchScore(
    course: { coursePlaces?: Array<{ segment?: string | null }> },
    timeOfDay: string | null
): number {
    if (!timeOfDay) return 0.5;
    const segments = course.coursePlaces?.map((p) => p.segment).filter(Boolean) || [];
    if (timeOfDay === "점심" && segments.includes("brunch")) return 1.0;
    if (timeOfDay === "저녁" && segments.includes("dinner")) return 1.0;
    if (timeOfDay === "야간" && segments.some((s) => s?.includes("night") || s === "dinner")) return 0.9;
    return 0.6;
}

/** timeOfDay가 있을 때 코스 배열을 시간대 매칭 순으로 정렬 (변경 적용) */
export function sortCoursesByTimeMatch(
    courses: Array<{ coursePlaces?: Array<{ segment?: string | null }> }>,
    timeOfDay: string | null
): void {
    if (!timeOfDay) return;
    courses.sort((a, b) => getTimeMatchScore(b, timeOfDay) - getTimeMatchScore(a, timeOfDay));
}
