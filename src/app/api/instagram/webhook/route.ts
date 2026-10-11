// 인스타 DM 웹훅 (메타 앱 DoNa-Content → Webhooks → Instagram → messages)
// GET: 메타 확인 요청, POST: 서명 검증 후 바로 200 응답, DM 처리는 after()에서
import { NextRequest, NextResponse, after } from "next/server";
import { defaultCache } from "@/lib/cache";
import { handleInstagramDm, validMetaSignature } from "@/lib/instagramDm";
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
    if (!validMetaSignature(raw, req.headers.get("x-hub-signature-256"), process.env.META_CONTENT_APP_SECRET)) {
        return new NextResponse("invalid signature", { status: 401 });
    }
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
