import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { captureApiError } from "@/lib/sentry";
import { defaultCache } from "@/lib/cache";
import { kstToday } from "@/lib/placePeriod";
import { sendPushToUser } from "@/lib/push";
import { sendTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const DAY = 24 * 60 * 60 * 1000;
const ALERT_DAYS = [7, 1]; // 관리자 텔레그램
const PUSH_DAYS = 3; // 저장한 유저 푸시
const PUSH_SENT_TTL = 60 * DAY;

const md = (d: Date) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
/** 받침 있으면 "이", 없으면 "가" (한글이 아니면 "이") */
const iGa = (word: string) => {
    const c = word.charCodeAt(word.length - 1) - 0xac00;
    return c >= 0 && c <= 11171 && c % 28 === 0 ? "가" : "이";
};

/**
 * 저장한 코스의 고정 장소가 D-3이면 그 유저에게 푸시 (마케팅 동의 조건은 sendPushToUser 그대로).
 * 중복 방지: 하루 1번 도는 크론이 "정확히 D-3"인 날에만 보내고, 보낸 유저·코스는 Redis에 60일 기록해 재실행·종료일 수정에도 다시 안 보냄
 */
async function pushSavedUsers(today: Date) {
    const end = new Date(today.getTime() + PUSH_DAYS * DAY);
    const saved = await prisma.savedCourse.findMany({
        where: { course: { coursePlaces: { some: { segment: null, place: { end_date: end } } } } },
        select: {
            userId: true,
            courseId: true,
            course: { select: { coursePlaces: { where: { segment: null, place: { end_date: end } }, select: { place: { select: { name: true } } } } } },
        },
    });

    // 같은 유저·같은 코스는 1번 (코스를 여러 번 저장했거나 끝나는 장소가 2곳이어도)
    const targets = new Map<string, { userId: number; courseId: number; placeName: string }>();
    for (const s of saved) {
        if (!s.courseId || !s.course) continue;
        const key = `${s.userId}:${s.courseId}`;
        if (!targets.has(key)) targets.set(key, { userId: s.userId, courseId: s.courseId, placeName: s.course.coursePlaces[0]?.place.name ?? "장소" });
    }

    const sentUsers = new Set<number>();
    const list = [...targets.entries()];
    for (let i = 0; i < list.length; i += 10) {
        await Promise.all(
            list.slice(i, i + 10).map(async ([key, t]) => {
                const sentKey = `push:popup-ending:${key}`;
                if (await defaultCache.get(sentKey)) return;
                const result = await sendPushToUser(
                    t.userId,
                    "곧 끝나는 장소가 있어요",
                    `저장한 코스의 ${t.placeName}${iGa(t.placeName)} ${md(end)} 끝나요. 이번 주에 다녀오세요`,
                    { screen: "course_detail", courseId: String(t.courseId), url: `/courses/${t.courseId}` }
                );
                if (result.ok) {
                    sentUsers.add(t.userId);
                    await defaultCache.set(sentKey, 1, PUSH_SENT_TTL);
                }
            })
        );
    }
    return { targets: targets.size, sentUsers: sentUsers.size };
}

/** 매일 오전 9시(KST, Hobby는 9시대 안에서 실행): 종료 D-7·D-1 관리자 알림 + D-3 저장 유저 푸시 */
export async function GET(req: NextRequest) {
    try {
        const cronSecret = process.env.CRON_SECRET ?? "default-secret-change-in-production";
        if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const today = kstToday();
        const places = await prisma.place.findMany({
            where: { end_date: { in: ALERT_DAYS.map((d) => new Date(today.getTime() + d * DAY)) } },
            select: {
                name: true,
                end_date: true,
                coursePlaces: { select: { course: { select: { id: true, title: true } } } },
            },
            orderBy: { end_date: "asc" },
        });

        const lines = places.map((p) => {
            const end = p.end_date!;
            const dDay = Math.round((end.getTime() - today.getTime()) / DAY);
            const courses = [...new Map(p.coursePlaces.map((cp) => [cp.course.id, cp.course.title])).values()];
            return `⏰ ${p.name} ${md(end)} 종료 (D-${dDay}) / 영향 코스: ${courses.join(", ") || "없음"}`;
        });

        const push = await pushSavedUsers(today);
        if (push.targets > 0) lines.push(`📲 D-${PUSH_DAYS} 저장 유저 푸시 ${push.sentUsers}명 발송 (대상 ${push.targets}건, 미동의·토큰 없음 제외)`);

        if (lines.length > 0) {
            const adminIds = (process.env.TELEGRAM_ADMIN_IDS || "").split(",").map((s) => Number(s.trim())).filter(Boolean);
            await Promise.all(adminIds.map((id) => sendTelegram(id, lines.join("\n\n"))));
        }
        return NextResponse.json({ success: true, alerted: places.length, push });
    } catch (error) {
        captureApiError(error);
        return NextResponse.json({ error: "팝업 종료 알림 실패" }, { status: 500 });
    }
}
