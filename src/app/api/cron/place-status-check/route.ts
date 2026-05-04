import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { Resend } from "resend";
import { captureApiError } from "@/lib/sentry";

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

async function fetchBusinessStatus(googlePlaceId: string): Promise<string | null> {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${googlePlaceId}&fields=business_status&key=${GOOGLE_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.result?.business_status ?? null;
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

        const places = await (prisma as any).place.findMany({
            where: { google_place_id: { not: null } },
            select: { id: true, name: true, address: true, google_place_id: true, place_status: true },
        });

        const now = new Date();
        const changed: { name: string; address: string; prev: string; next: string }[] = [];

        for (const place of places) {
            const newStatus = await fetchBusinessStatus(place.google_place_id);
            if (!newStatus) { await sleep(DELAY_MS); continue; }

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
