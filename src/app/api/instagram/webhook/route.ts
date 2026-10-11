// 인스타 DM 웹훅 (메타 앱 DoNa-Content → Webhooks → Instagram → messages)
// GET: 메타 확인 요청, POST: 서명 검증 후 바로 200 응답, DM 처리는 after()에서
import { NextRequest, NextResponse, after } from "next/server";
import { dmsFromPayload, handleInstagramDm, keepFailedWebhook, notifyAdminsOncePerDay, secretShape, signedBy } from "@/lib/instagramDm";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // 팁 후보 생성(Claude 1회, 최대 120초)까지

export async function GET(req: NextRequest) {
    const p = req.nextUrl.searchParams;
    const token = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN?.trim();
    if (token && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === token) {
        return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
    }
    return new NextResponse("forbidden", { status: 403 });
}

// 배포마다 실패 알림을 다시 받도록 (고친 뒤 테스트할 때 "오늘 이미 알림" 때문에 조용해지지 않게)
const DEPLOY = (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7);

export async function POST(req: NextRequest) {
    // 서명은 받은 바이트 그대로 계산 (문자열로 바꿨다 되돌리지 않음)
    const raw = Buffer.from(await req.arrayBuffer());
    const header = req.headers.get("x-hub-signature-256");
    // DoNa-Content 앱 시크릿(Facebook 로그인 방식). "API setup with Instagram login" 화면에 등록한 웹훅은
    // 인스타 앱 시크릿으로 서명될 수 있어서 INSTAGRAM_LOGIN_APP_SECRET도 인정하고 어느 쪽인지 알림
    const by = signedBy(raw, header);
    if (!by) {
        const cause = !header ? "no-header" : !process.env.META_CONTENT_APP_SECRET?.trim() ? "no-secret" : "mismatch";
        const text = {
            "no-header": "서명 헤더(X-Hub-Signature-256)가 없는 요청",
            "no-secret": "META_CONTENT_APP_SECRET 환경 변수가 비어 있음",
            mismatch: "서명이 META_CONTENT_APP_SECRET·INSTAGRAM_LOGIN_APP_SECRET 어느 쪽과도 안 맞음",
        }[cause];
        let source = "";
        try {
            const b = JSON.parse(raw.toString("utf8"));
            source = `\nobject: ${b.object ?? "?"} · entry id: ${(b.entry ?? []).map((e: { id?: string }) => e.id).join(", ") || "?"}`;
        } catch {}
        after(async () => {
            // 서명 헤더가 있는 요청만 보관 (아무나 보낸 빈 요청은 버림)
            if (header) await keepFailedWebhook(raw, header).catch(() => {});
            await notifyAdminsOncePerDay(
                `ig:sigfail:${DEPLOY}:${cause}`,
                `⚠️ 인스타 웹훅 서명 실패 (이 배포에서 같은 원인은 하루 한 번만 알려요)\n${text}\n본문 ${raw.length}바이트${source}\n${secretShape("META_CONTENT_APP_SECRET")}\n${secretShape("INSTAGRAM_LOGIN_APP_SECRET")}${header ? "\n본문은 30분 보관해요. 고친 뒤 텔레그램에 /igretry" : ""}`
            ).catch(() => {});
        });
        return new NextResponse("invalid signature", { status: 401 });
    }
    if (by === "instagram") after(() => notifyAdminsOncePerDay("ig:sig:instagram-app", "ℹ️ 인스타 웹훅이 인스타 앱 시크릿으로 서명돼 왔어요 (API setup with Instagram login 쪽 웹훅)").catch(() => {}));
    try {
        for (const dm of await dmsFromPayload(raw)) {
            after(() => handleInstagramDm(dm.igsid, dm.text).catch((e) => captureApiError(e)));
        }
    } catch (e) {
        captureApiError(e);
    }
    return NextResponse.json({ ok: true });
}
