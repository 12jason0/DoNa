import prisma from "@/lib/db";

/** 공유 링크 열람권 유효 기간 */
export const SHARE_ACCESS_DAYS = 3;

/**
 * 사용자가 지금 이 코스를 열람할 수 있는지 — /api/courses/[id]의 hasAccess 규칙과 동일
 * (단, 만료일이 지난 구독은 cron 반영 전이라도 권한 없음으로 봄)
 */
export async function userHasCourseAccess(userId: number | null | undefined, courseId: number): Promise<boolean> {
    if (!userId) return false;
    const [course, user, unlock] = await Promise.all([
        prisma.course.findUnique({ where: { id: courseId }, select: { grade: true, isPublic: true } }),
        prisma.user.findUnique({
            where: { id: userId },
            select: { subscriptionTier: true, subscriptionExpiresAt: true },
        }),
        prisma.courseUnlock.findFirst({ where: { userId, courseId }, select: { id: true } }),
    ]);
    if (!course || !user) return false;
    if (unlock) return true;
    if (!course.isPublic) return false;
    const grade = course.grade || "FREE";
    if (grade === "FREE") return true;
    const subActive = !user.subscriptionExpiresAt || user.subscriptionExpiresAt > new Date();
    const tier = subActive ? user.subscriptionTier : "FREE";
    return tier === "PREMIUM" || (tier === "BASIC" && grade === "BASIC");
}

/** 같은 코스 공유 링크 생성 한도 (사람당, 한국 날짜 기준 하루) */
export const SHARE_DAILY_LIMIT = 5;

const KST_OFFSET_MS = 9 * 3600_000;

/** 한국 시간 기준 그날 0시 (UTC Date) */
export function kstDayStart(at: Date = new Date()): Date {
    const kst = new Date(at.getTime() + KST_OFFSET_MS);
    return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - KST_OFFSET_MS);
}

/** 링크당 열람 가능한 기기 수 */
export const SHARE_DEVICE_LIMIT = 5;

/** 공유 페이지 기기 구분 쿠키 (middleware에서 발급) */
export const SHARE_DEVICE_COOKIE = "dona_did";

const DEVICE_ID_RE = /^[0-9a-f-]{36}$/i;

/** 링크 미리보기·검색 크롤러 (기기 수에서 제외, 유료 내용도 안 보여줌) */
const CRAWLER_UA_RE =
    /bot\b|bot\/|crawl|spider|slurp|kakaotalk-scrap|facebookexternalhit|yeti|daumoa|whatsapp|telegrambot|discordbot|slackbot|linkedinbot|embedly|google-inspectiontool|googleother|headlesschrome|lighthouse/i;

export function isCrawlerUA(ua: string | null | undefined): boolean {
    return !ua || CRAWLER_UA_RE.test(ua);
}

/**
 * 이 기기를 링크에 등록하고 열람 가능 여부 반환. 이미 등록된 기기는 항상 true.
 * ponytail: 동시에 새 기기 여러 대가 열면 5대를 살짝 넘길 수 있음 — 문제되면 share 행 FOR UPDATE 잠금
 */
export async function claimShareDevice(shareId: string, deviceId: string | null | undefined): Promise<boolean> {
    if (!deviceId || !DEVICE_ID_RE.test(deviceId)) return false;
    await prisma.$executeRaw`
        INSERT INTO shared_course_devices (share_id, device_id)
        SELECT ${shareId}, ${deviceId}
        WHERE (SELECT count(*) FROM shared_course_devices WHERE share_id = ${shareId}) < ${SHARE_DEVICE_LIMIT}
        ON CONFLICT DO NOTHING`;
    const row = await prisma.sharedCourseDevice.findUnique({
        where: { shareId_deviceId: { shareId, deviceId } },
        select: { shareId: true },
    });
    return !!row;
}

/** 만료일까지 남은 일수 (한국 날짜 기준, 만료 당일 0) */
export function daysLeftKst(expiresAt: Date, now: Date = new Date()): number {
    return Math.max(0, Math.round((kstDayStart(expiresAt).getTime() - kstDayStart(now).getTime()) / 86400_000));
}
