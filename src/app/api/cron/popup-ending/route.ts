import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { captureApiError } from "@/lib/sentry";
import { kstToday } from "@/lib/placePeriod";
import { sendTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DAY = 24 * 60 * 60 * 1000;
const ALERT_DAYS = [7, 1];

/** 매일 오전 9시(KST, Hobby는 9시대 안에서 실행): 종료 D-7·D-1 팝업 장소를 관리자 텔레그램으로 알림 */
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
            return `⏰ ${p.name} ${end.getUTCMonth() + 1}/${end.getUTCDate()} 종료 (D-${dDay}) / 영향 코스: ${courses.join(", ") || "없음"}`;
        });

        if (lines.length > 0) {
            const adminIds = (process.env.TELEGRAM_ADMIN_IDS || "").split(",").map((s) => Number(s.trim())).filter(Boolean);
            await Promise.all(adminIds.map((id) => sendTelegram(id, lines.join("\n\n"))));
        }
        return NextResponse.json({ success: true, alerted: lines.length });
    } catch (error) {
        captureApiError(error);
        return NextResponse.json({ error: "팝업 종료 알림 실패" }, { status: 500 });
    }
}
