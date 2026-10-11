// 팝업·전시 목록 (웹 /popups 페이지와 앱용 /api/popups 가 같이 씀). 표시 문구는 popupFormat.ts
import prisma from "@/lib/db";
import { CLOSED_STATUS, kstToday, notExpiredCourseWhere, ymd } from "@/lib/placePeriod";
import type { PopupItem } from "@/lib/popupFormat";

const DAY = 24 * 60 * 60 * 1000;
export const POPUP_SOON_DAYS = 14;

/** 기간이 있고 위치가 있는 발행 장소 중 안 끝난 것 → 진행 중 / 곧 시작(14일 이내) */
export async function listPopups(now = new Date()): Promise<{ ongoing: PopupItem[]; upcoming: PopupItem[]; todayYear: number }> {
    const today = kstToday(now);
    const rows = await prisma.place.findMany({
        where: {
            status: { notIn: ["draft", CLOSED_STATUS] },
            latitude: { not: null },
            AND: [
                { OR: [{ start_date: { not: null } }, { end_date: { not: null } }] },
                { OR: [{ end_date: null }, { end_date: { gte: today } }] },
                { OR: [{ start_date: null }, { start_date: { lte: new Date(today.getTime() + POPUP_SOON_DAYS * DAY) } }] },
            ],
        },
        select: {
            id: true,
            name: true,
            name_en: true,
            name_ja: true,
            name_zh: true,
            imageUrl: true,
            address: true,
            address_en: true,
            address_ja: true,
            address_zh: true,
            start_date: true,
            end_date: true,
            coursePlaces: {
                where: { course: { isPublic: true, ...notExpiredCourseWhere(now) } },
                select: { course: { select: { id: true, title: true, title_en: true, title_ja: true, title_zh: true } } },
            },
        },
        orderBy: [{ end_date: "asc" }, { id: "desc" }],
    });

    const days = (d: Date | null) => (d ? Math.round((d.getTime() - today.getTime()) / DAY) : null);
    const items: PopupItem[] = rows.map(({ start_date, end_date, coursePlaces, ...p }) => ({
        ...p,
        startDate: ymd(start_date),
        endDate: ymd(end_date),
        daysToStart: days(start_date),
        daysToEnd: days(end_date),
        courses: [...new Map(coursePlaces.map((cp) => [cp.course.id, cp.course])).values()],
    }));
    const isUpcoming = (i: PopupItem) => i.daysToStart != null && i.daysToStart > 0;
    return {
        ongoing: items.filter((i) => !isUpcoming(i)),
        upcoming: items.filter(isUpcoming).sort((a, b) => a.daysToStart! - b.daysToStart!),
        todayYear: today.getUTCFullYear(),
    };
}
