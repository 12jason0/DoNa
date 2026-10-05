import { COURSE_DETAIL_SENTINELS } from "@/lib/courseDetailSentinels";

/** 유료(BASIC·PREMIUM) 코스 공유 설명: 장소 이름을 숨기고 "지역 · 시간 · 장소 N곳"만 (서버 OG·클라이언트 카카오 공유 공용) */
export function paidCourseShareDescription(course: {
    region?: string | null;
    duration?: string | null;
    placeCount: number;
}): string {
    return [
        course.region?.trim(),
        course.duration !== COURSE_DETAIL_SENTINELS.duration && course.duration?.trim(),
        course.placeCount > 0 && `장소 ${course.placeCount}곳`,
    ]
        .filter(Boolean)
        .join(" · ");
}
