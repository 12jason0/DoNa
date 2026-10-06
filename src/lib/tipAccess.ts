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
