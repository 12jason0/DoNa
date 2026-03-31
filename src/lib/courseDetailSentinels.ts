/** 서버(page.tsx)와 클라이언트가 공유하는 기본값 마커 — UI에서는 t(courseDetail.defaults.*)로 치환 */

export const COURSE_DETAIL_SENTINELS = {
    duration: "CDF:duration",
    recommended_start_time: "CDF:recommended_start_time",
    season: "CDF:season",
    courseType: "CDF:courseType",
    transportation: "CDF:transportation",
} as const;

export type CourseDetailSentinelKey = keyof typeof COURSE_DETAIL_SENTINELS;
