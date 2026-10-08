import type { NextRequest } from "next/server";
import prisma from "@/lib/db";

/** middleware.ts FIRST_TOUCH_COOKIE와 같은 값 */
export const FIRST_TOUCH_COOKIE = "dona_ft";

const str = (v: unknown, max: number) => (typeof v === "string" && v ? v.slice(0, max) : null);

/** 가입 직후 호출: 처음 방문 쿠키를 새 사용자에 연결 (이미 연결돼 있으면 안 덮어씀). 실패해도 가입은 진행 */
export async function saveSignupAttribution(req: NextRequest, userId: number): Promise<void> {
    const raw = req.cookies.get(FIRST_TOUCH_COOKIE)?.value;
    if (!raw) return;
    try {
        const ft = JSON.parse(raw);
        await prisma.user.updateMany({
            where: { id: userId, signupLanding: null },
            data: {
                signupUtmSource: str(ft.s, 100),
                signupUtmCampaign: str(ft.c, 100),
                signupReferrer: str(ft.r, 255),
                signupLanding: str(ft.l, 255) ?? "/",
            },
        });
    } catch (e) {
        console.error("[signupAttribution]", e);
    }
}

/** 관리자 집계용 유입 채널: 공유 링크 > utm_source > 리퍼러 도메인 > 직접 */
export function signupChannel(u: {
    signupUtmSource: string | null;
    signupReferrer: string | null;
    signupLanding: string | null;
}): string {
    if (u.signupLanding?.startsWith("/share/")) return "공유 링크";
    if (u.signupUtmSource) return `utm:${u.signupUtmSource}`;
    if (u.signupReferrer) return u.signupReferrer.replace(/^www\./, "");
    if (u.signupLanding) return "직접 방문";
    return "기록 없음(앱·이전 가입)";
}

/** 가입 직후 질문 "두나 어디서 알게 됐어요?" 선택지 (skipped = 건너뛰기) */
export const SIGNUP_SOURCE_ANSWERS = ["instagram", "search", "friend", "share_link", "other", "skipped"] as const;
export type SignupSourceAnswer = (typeof SIGNUP_SOURCE_ANSWERS)[number];

/** 관리자 화면 표시용 */
export const SIGNUP_SOURCE_LABEL: Record<string, string> = {
    instagram: "인스타그램",
    search: "검색",
    friend: "지인 추천",
    share_link: "공유 링크",
    other: "기타",
    skipped: "건너뜀",
};

/** 가입 후 이 기간 안에만 묻는다 — 기존 사용자에게는 안 뜨게 */
export const SIGNUP_SOURCE_ASK_WINDOW_MS = 24 * 60 * 60 * 1000;
