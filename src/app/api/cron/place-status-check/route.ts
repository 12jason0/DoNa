import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { Resend } from "resend";
import { captureApiError } from "@/lib/sentry";
import { sendTelegram } from "@/lib/telegram";
import { telegramAdminIds } from "@/lib/instagramDm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? "";
const DELAY_MS = 150;
const ADMIN_EMAIL = "12jason@donacouse.com";

const resend = new Resend(process.env.RESEND_API_KEY);

const STATUS_LABEL: Record<string, string> = {
    OPERATIONAL: "🟢 운영중",
    CLOSED_PERMANENTLY: "🔴 폐업",
    CLOSED_TEMPORARILY: "🟡 임시휴업",
};

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

/** status: 구글 business_status (못 받으면 null), reason: 못 받은 이유 (구글 응답 status 또는 HTTP 코드) */
async function fetchBusinessStatus(googlePlaceId: string): Promise<{ status: string | null; reason: string }> {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${googlePlaceId}&fields=business_status&key=${GOOGLE_API_KEY}`;
    const res = await fetch(url).catch(() => null);
    if (!res?.ok) return { status: null, reason: `HTTP ${res?.status ?? "실패"}` };
    const data = await res.json();
    return { status: data.result?.business_status ?? null, reason: data.status ?? "상태 없음" };
}

const courseLine = (cps: { course: { id: number; title: string } }[]) =>
    cps.length ? cps.map((cp) => `${cp.course.id} ${cp.course.title}`).join(", ") : "없음";

/**
 * 점검 뒤 텔레그램: 구글은 폐업인데 우리는 published인 장소를 해결될 때까지 매주 한 곳씩 [폐업 처리] 버튼과 함께,
 * 이번에 상태를 못 받은 장소·구글 ID 없는 장소는 목록 한 번에
 */
async function notifyTelegram(checkedAt: Date, failReasons: Map<number, string>) {
    const adminIds = telegramAdminIds();
    if (adminIds.length === 0) return;
    const send = (text: string, buttons?: { text: string; data: string }[][]) => Promise.all(adminIds.map((id) => sendTelegram(id, text, buttons)));
    const courses = { select: { course: { select: { id: true, title: true } } } };

    const gap = await prisma.place.findMany({
        where: { place_status: "CLOSED_PERMANENTLY", status: "published" },
        select: { id: true, name: true, address: true, coursePlaces: courses },
        orderBy: { id: "asc" },
    });
    for (const p of gap) {
        await send(
            `🔴 구글은 폐업, 우리는 운영 중\nID ${p.id} ${p.name}\n${p.address ?? "주소 없음"}\n코스: ${courseLine(p.coursePlaces)}`,
            [[{ text: "폐업 처리", data: `close:${p.id}` }]]
        );
    }

    // 이번 점검에서 status_checked_at이 안 바뀐 곳 = 구글이 상태를 안 돌려줌 / 구글 ID 없음
    const unchecked = await prisma.place.findMany({
        where: { status: "published", OR: [{ google_place_id: null }, { status_checked_at: null }, { status_checked_at: { lt: checkedAt } }] },
        select: { id: true, name: true, google_place_id: true, status_checked_at: true, coursePlaces: courses },
        orderBy: { id: "asc" },
    });
    if (unchecked.length === 0) return;
    const lines = unchecked.map((p) => {
        const why = !p.google_place_id
            ? "구글 ID 없음"
            : `${failReasons.get(p.id) ?? "응답 없음"}, 마지막 점검 ${p.status_checked_at ? p.status_checked_at.toISOString().slice(0, 10) : "없음"}`;
        return `· ${p.id} ${p.name} (${why}) 코스: ${courseLine(p.coursePlaces)}`;
    });
    // ponytail: 텔레그램 한 메시지 4096자 → 앞 40곳만, 넘으면 관리자 장소 화면에서
    await send(`⚪ 폐업 점검을 못 한 장소 ${unchecked.length}곳\n${lines.slice(0, 40).join("\n")}${lines.length > 40 ? `\n…외 ${lines.length - 40}곳` : ""}`);
}

export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET ?? "default-secret-change-in-production";
        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (!GOOGLE_API_KEY) {
            return NextResponse.json({ error: "GOOGLE_PLACES_API_KEY 없음" }, { status: 500 });
        }

        // 구글 약관: Places 내용은 장기 보관 불가 → 30일 지난 구글 자료는 내용만 비우고 링크·날짜 유지
        await prisma.tipSource.updateMany({
            where: { source_type: { in: ["google_review", "google_info"] }, collected_at: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, content: { not: null } },
            data: { content: null, author: null },
        });

        const places = await (prisma as any).place.findMany({
            where: { google_place_id: { not: null } },
            select: { id: true, name: true, address: true, google_place_id: true, place_status: true },
        });

        const now = new Date();
        const changed: { name: string; address: string; prev: string; next: string }[] = [];
        const failReasons = new Map<number, string>();

        for (const place of places) {
            const { status: newStatus, reason } = await fetchBusinessStatus(place.google_place_id);
            if (!newStatus) { failReasons.set(place.id, reason); await sleep(DELAY_MS); continue; }

            const prevStatus = place.place_status ?? "OPERATIONAL";
            if (newStatus !== prevStatus) {
                changed.push({
                    name: place.name,
                    address: place.address ?? "",
                    prev: prevStatus,
                    next: newStatus,
                });
            }

            await (prisma as any).place.update({
                where: { id: place.id },
                data: { place_status: newStatus, status_checked_at: now },
            });
            await sleep(DELAY_MS);
        }

        if (changed.length > 0) {
            const rows = changed
                .map((c) => `<tr>
                    <td style="padding:8px 12px;border-bottom:1px solid #eee;">${c.name}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#6b7280;">${c.address}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #eee;">${STATUS_LABEL[c.prev] ?? c.prev}</td>
                    <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;">${STATUS_LABEL[c.next] ?? c.next}</td>
                </tr>`)
                .join("");

            await resend.emails.send({
                from: "DoNa <noreply@donacouse.com>",
                to: ADMIN_EMAIL,
                subject: `[DoNa] 장소 상태 변경 감지 - ${changed.length}건`,
                html: `
                    <h2 style="color:#111;">DoNa 장소 상태 변경 알림</h2>
                    <p style="color:#6b7280;">체크 시각: ${now.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</p>
                    <table style="border-collapse:collapse;width:100%;font-size:14px;">
                        <thead>
                            <tr style="background:#f9fafb;">
                                <th style="padding:8px 12px;text-align:left;">장소명</th>
                                <th style="padding:8px 12px;text-align:left;">주소</th>
                                <th style="padding:8px 12px;text-align:left;">기존</th>
                                <th style="padding:8px 12px;text-align:left;">변경</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                `,
            });
        }

        await notifyTelegram(now, failReasons).catch((e) => captureApiError(e));

        return NextResponse.json({
            success: true,
            checked: places.length,
            changed: changed.length,
        });
    } catch (error) {
        captureApiError(error);
        return NextResponse.json({ error: "상태 체크 실패" }, { status: 500 });
    }
}
