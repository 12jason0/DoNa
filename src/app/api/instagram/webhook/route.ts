// 인스타 DM 웹훅 (메타 앱 DoNa-Content → Webhooks → Instagram → messages)
// GET: 메타 확인 요청, POST: 서명 검증 후 바로 200 응답, DM 처리는 after()에서
import { NextRequest, NextResponse, after } from "next/server";
import { defaultCache } from "@/lib/cache";
import { handleInstagramDm, notifyAdminsOncePerDay, validMetaSignature } from "@/lib/instagramDm";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // 팁 후보 생성(Claude 1회, 최대 120초)까지

export async function GET(req: NextRequest) {
    const p = req.nextUrl.searchParams;
    const token = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;
    if (token && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === token) {
        return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
    }
    return new NextResponse("forbidden", { status: 403 });
}

type Messaging = { sender?: { id?: string }; message?: { mid?: string; text?: string; is_echo?: boolean; is_deleted?: boolean } };

export async function POST(req: NextRequest) {
    const raw = await req.text();
    const header = req.headers.get("x-hub-signature-256");
    // 메타 앱 시크릿(DoNa-Content, Facebook 로그인 방식 웹훅). "API setup with Instagram login" 화면에 등록한 웹훅은
    // 인스타 앱 시크릿으로 서명될 수 있어서, INSTAGRAM_LOGIN_APP_SECRET이 있으면 그것도 인정하고 어느 쪽인지 알림
    const byMetaApp = validMetaSignature(raw, header, process.env.META_CONTENT_APP_SECRET);
    const byInstagramApp = !byMetaApp && validMetaSignature(raw, header, process.env.INSTAGRAM_LOGIN_APP_SECRET);
    if (!byMetaApp && !byInstagramApp) {
        const cause = !header ? "no-header" : !process.env.META_CONTENT_APP_SECRET ? "no-secret" : "mismatch";
        const text = {
            "no-header": "서명 헤더(X-Hub-Signature-256)가 없는 요청",
            "no-secret": "META_CONTENT_APP_SECRET 환경 변수가 비어 있음",
            mismatch: "서명이 META_CONTENT_APP_SECRET·INSTAGRAM_LOGIN_APP_SECRET 어느 쪽과도 안 맞음",
        }[cause];
        after(() => notifyAdminsOncePerDay(`ig:sigfail:${cause}`, `⚠️ 인스타 웹훅 서명 실패 (오늘 같은 원인은 이번 한 번만 알려요)
${text}
본문 ${raw.length}바이트`).catch(() => {}));
        return new NextResponse("invalid signature", { status: 401 });
    }
    if (byInstagramApp) after(() => notifyAdminsOncePerDay("ig:sig:instagram-app", "ℹ️ 인스타 웹훅이 인스타 앱 시크릿으로 서명돼 왔어요 (API setup with Instagram login 쪽 웹훅)").catch(() => {}));
    try {
        const body = JSON.parse(raw);
        if (body.object !== "instagram") return NextResponse.json({ ok: true });
        for (const entry of body.entry ?? []) {
            for (const m of (entry.messaging ?? []) as Messaging[]) {
                const msg = m.message;
                const sender = m.sender?.id;
                // 우리 계정이 보낸 메시지(echo)·삭제·글자 없는 메시지(사진·스티커 등)는 건너뜀
                if (!msg?.mid || !msg.text?.trim() || msg.is_echo || msg.is_deleted || !sender || sender === entry.id) continue;
                // 메타는 응답이 늦으면 같은 DM을 다시 보냄 → 메시지 ID로 한 번만 처리 (3일 보관)
                if (await defaultCache.get(`ig:mid:${msg.mid}`)) continue;
                await defaultCache.set(`ig:mid:${msg.mid}`, 1, 3 * 24 * 60 * 60 * 1000);
                const text = msg.text.trim();
                after(() => handleInstagramDm(sender, text).catch((e) => captureApiError(e)));
            }
        }
    } catch (e) {
        captureApiError(e);
    }
    return NextResponse.json({ ok: true });
}
