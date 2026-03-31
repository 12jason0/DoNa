import type { PlaceStatus } from "./placeStatus";
import { PLACE_STATUS_NO_INFO } from "./placeStatus";

/** Tailwind 클래스 — 장소 상태 배지용 (다크 모드 포함) */
export const PLACE_STATUS_BADGE_CLASS: Record<PlaceStatus, string> = {
    영업중: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
    "곧 마감": "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
    "곧 브레이크": "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
    "브레이크 중": "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
    "오픈 준비중": "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
    휴무: "bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300",
    영업종료: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
    "정보 없음": "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400",
};

/** translation.json `courseDetail.placeStatus*` 키 접미사 */
export const PLACE_STATUS_I18N_KEY: Record<PlaceStatus, string> = {
    영업중: "courseDetail.placeStatusOpen",
    "곧 마감": "courseDetail.placeStatusClosingSoon",
    "곧 브레이크": "courseDetail.placeStatusBreakSoon",
    "브레이크 중": "courseDetail.placeStatusOnBreak",
    "오픈 준비중": "courseDetail.placeStatusOpeningSoon",
    휴무: "courseDetail.placeStatusClosed",
    영업종료: "courseDetail.placeStatusClosedToday",
    "정보 없음": "courseDetail.placeStatusNoInfo",
};

export function placeStatusBadgeClass(status: PlaceStatus): string {
    return PLACE_STATUS_BADGE_CLASS[status] ?? PLACE_STATUS_BADGE_CLASS[PLACE_STATUS_NO_INFO];
}

export function placeStatusTranslationKey(status: PlaceStatus): string {
    return PLACE_STATUS_I18N_KEY[status] ?? PLACE_STATUS_I18N_KEY[PLACE_STATUS_NO_INFO];
}
