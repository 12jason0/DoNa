import type { NextRequest } from "next/server";
import { resolveUserId, verifyAdminJwt } from "@/lib/auth";
import { userHasCourseAccess } from "@/lib/shareAccess";

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
        name_en: null,
        name_ja: null,
        name_zh: null,
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
