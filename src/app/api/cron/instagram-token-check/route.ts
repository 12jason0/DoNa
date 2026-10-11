// 인스타 페이지 토큰 점검 (매일): 무효이거나 "데이터 액세스 만료"가 14·7·3·1일 남았을 때 텔레그램 알림
// 토큰 자체는 만료 없음(expires_at 0)이어도 데이터 액세스는 약 3개월마다 다시 로그인해 연장해야 함
import { NextRequest, NextResponse } from "next/server";
import { GRAPH, telegramAdminIds } from "@/lib/instagramDm";
import { sendTelegram } from "@/lib/telegram";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

const META_CONTENT_APP_ID = "2933829516822533"; // DoNa-Content (공개 값)
const ALERT_DAYS = [14, 7, 3, 1];
const DAY = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
    const cronSecret = process.env.CRON_SECRET ?? "default-secret-change-in-production";
    if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const token = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
        const appToken = `${META_CONTENT_APP_ID}|${process.env.META_CONTENT_APP_SECRET}`;
        const res = await fetch(`${GRAPH}/debug_token?input_token=${token}&access_token=${encodeURIComponent(appToken)}`);
        const d = ((await res.json()) as { data?: { is_valid?: boolean; expires_at?: number; data_access_expires_at?: number } }).data;

        const notify = (text: string) => Promise.all(telegramAdminIds().map((id) => sendTelegram(id, text)));
        const howTo = "\n\n연장: 그래프 API 탐색기에서 DoNa-Content로 다시 로그인 → 새 페이지 토큰 → Vercel INSTAGRAM_PAGE_ACCESS_TOKEN 교체";
        if (!d?.is_valid) {
            await notify(`⚠️ 인스타 페이지 토큰이 무효예요. 인스타 DM 팁이 멈춰요.${howTo}`);
            return NextResponse.json({ ok: true, valid: false });
        }
        const ends = [d.expires_at, d.data_access_expires_at].filter((t): t is number => !!t).map((t) => t * 1000);
        const daysLeft = ends.length ? Math.ceil((Math.min(...ends) - Date.now()) / DAY) : null;
        if (daysLeft !== null && (ALERT_DAYS.includes(daysLeft) || daysLeft <= 0)) {
            const when = new Date(Math.min(...ends)).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
            await notify(`⏰ 인스타 페이지 토큰 데이터 액세스가 ${daysLeft <= 0 ? "만료됐어요" : `${daysLeft}일 뒤 만료돼요`} (${when}).${howTo}`);
        }
        return NextResponse.json({ ok: true, valid: true, daysLeft });
    } catch (e) {
        captureApiError(e);
        return NextResponse.json({ error: "토큰 점검 실패" }, { status: 500 });
    }
}
