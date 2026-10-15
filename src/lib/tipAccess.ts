import type { NextRequest } from "next/server";
import { resolveUserId, verifyAdminJwt } from "@/lib/auth";
import { userHasCourseAccess } from "@/lib/shareAccess";
import { getPlaceStatus, PLACE_STATUS_CLOSED } from "@/lib/placeStatus";

/** 팁 필드 4개 언어 모두 비움 */
export const NO_TIPS = { tips: null, tips_en: null, tips_ja: null, tips_zh: null } as const;

/** 이 요청이 코스 팁(모든 언어)을 받아도 되는지: 관리자이거나 코스 열람 권한이 있는 사용자 */
export async function canSeeCourseTips(request: NextRequest, courseId: number): Promise<boolean> {
    if (verifyAdminJwt(request)) return true;
    return userHasCourseAccess(resolveUserId(request), courseId);
}

/**
 * 열람 권한 없는 요청에 주는 장소 자리표시: 카테고리만 (앱 잠금 요약 "카페 · 야경 6곳"용), 이름은 고정 문구,
 * id·좌표·사진 없음 (place id만으로도 /places/{id}에서 이름이 보이므로). 구버전 앱이 장소 카드를 그려도 죽지 않게 모양은 유지
 */
export const LOCKED_PLACE_NAME = "잠긴 장소";
export function lockedPlace(category: string | null | undefined) {
    return {
        id: null,
        name: LOCKED_PLACE_NAME,
        name_en: "Locked place",
        name_ja: "ロックされた場所",
        name_zh: "已鎖定的地點",
        address: null,
        description: null,
        category: category ?? null,
        avg_cost_range: null,
        opening_hours: null,
        phone: null,
        parking_available: null,
        reservation_required: null,
        reservationUrl: null,
        latitude: null,
        longitude: null,
        imageUrl: null,
        closed_days: [],
        start_date: null,
        end_date: null,
    };
}

/**
 * 목록·추천 카드용: isLocked 코스의 장소를 자리표시로. 카드에 필요한 것만 서버에서 먼저 계산해 둠
 * - imageUrl: 코스 대표 사진이 없으면 첫 장소 사진 (카드 썸네일, 기존 목록 API와 같음)
 * - hasReservation / closedPlaceCount: "예약"·"영업 종료 N곳" 배지 (장소 이름 없이 값만)
 * 캐시에는 가리기 전 데이터를 두고 응답 직전에만 부를 것 (잠금은 사용자마다 다름)
 */
export function maskLockedCourse<T extends { isLocked?: boolean; imageUrl?: string | null; coursePlaces?: any[] }>(course: T): T {
    if (!course?.isLocked || !Array.isArray(course.coursePlaces)) return course;
    const cps = course.coursePlaces;
    return {
        ...course,
        imageUrl: course.imageUrl || cps.find((cp) => cp?.place?.imageUrl)?.place?.imageUrl || course.imageUrl,
        hasReservation: cps.some((cp) => cp?.place?.reservationUrl || cp?.place?.reservation_required),
        closedPlaceCount: cps.filter(
            (cp) =>
                cp?.place &&
                getPlaceStatus(cp.place.opening_hours ?? null, cp.place.closed_days ?? []).status === PLACE_STATUS_CLOSED,
        ).length,
        coursePlaces: cps.map((cp) => (cp?.place ? { ...cp, place: lockedPlace(cp.place.category) } : cp)),
    };
}
