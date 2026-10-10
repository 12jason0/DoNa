// 팝업·전시 목록 (웹 /popups 페이지와 앱용 /api/popups 가 같이 씀)
import prisma from "@/lib/db";
import { kstToday, notExpiredCourseWhere, ymd } from "@/lib/placePeriod";

const DAY = 24 * 60 * 60 * 1000;
export const POPUP_SOON_DAYS = 14;

export type PopupItem = {
    id: number;
    name: string;
    imageUrl: string | null;
    address: string | null;
    region: string; // "성동구"
    startDate: string | null; // "2026-10-17"
    endDate: string | null;
    period: string; // "10.17 ~ 2027.1.24" (올해면 연도 생략)
    badge: string | null; // "D-3 종료", "오늘 종료", "5일 후 시작"
    courses: { id: number; title: string }[];
};

const fmt = (d: Date, year: number) => `${d.getUTCFullYear() !== year ? `${d.getUTCFullYear()}.` : ""}${d.getUTCMonth() + 1}.${d.getUTCDate()}`;

/** 기간이 있고 위치가 있는 발행 장소 중 안 끝난 것 → 진행 중 / 곧 시작(14일 이내) */
export async function listPopups(now = new Date()): Promise<{ ongoing: PopupItem[]; upcoming: PopupItem[] }> {
    const today = kstToday(now);
    const rows = await prisma.place.findMany({
        where: {
            status: { not: "draft" },
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
            imageUrl: true,
            address: true,
            start_date: true,
            end_date: true,
            coursePlaces: {
                where: { course: { isPublic: true, ...notExpiredCourseWhere(now) } },
                select: { course: { select: { id: true, title: true } } },
            },
        },
        orderBy: [{ end_date: "asc" }, { id: "desc" }],
    });

    const days = (d: Date) => Math.round((d.getTime() - today.getTime()) / DAY);
    const year = today.getUTCFullYear();
    const toItem = (p: (typeof rows)[number]): PopupItem => {
        const upcoming = !!p.start_date && p.start_date > today;
        const left = p.end_date ? days(p.end_date) : null;
        const s = p.start_date ? fmt(p.start_date, year) : "";
        const e = p.end_date ? fmt(p.end_date, year) : "";
        return {
            id: p.id,
            name: p.name,
            imageUrl: p.imageUrl,
            address: p.address,
            region: p.address?.split(" ")[1] ?? "",
            startDate: ymd(p.start_date),
            endDate: ymd(p.end_date),
            period: s && e ? `${s} ~ ${e}` : s ? `${s} ~` : `~ ${e}`,
            badge: upcoming
                ? `${days(p.start_date!)}일 후 시작`
                : left === 0
                  ? "오늘 종료"
                  : left != null && left <= 7
                    ? `D-${left} 종료`
                    : null,
            courses: [...new Map(p.coursePlaces.map((cp) => [cp.course.id, cp.course])).values()],
        };
    };

    const items = rows.map(toItem);
    const isUpcoming = (i: PopupItem) => !!i.startDate && i.startDate > ymd(today)!;
    return {
        ongoing: items.filter((i) => !isUpcoming(i)),
        upcoming: items.filter(isUpcoming).sort((a, b) => a.startDate!.localeCompare(b.startDate!)),
    };
}
