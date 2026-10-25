import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    // token_version +1 → 이 사용자에게 발급된 모든 토큰(다른 기기 포함)이 무효. 실패해도 쿠키는 지운다
    try {
        const userId = await resolveUserId(request);
        if (userId) await prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
    } catch (e) {
        captureApiError(e);
    }

    const res = NextResponse.json({ success: true });

    // 🟢 [Fix]: 로컬/카카오 로그인 통합을 위한 모든 인증 관련 쿠키 완전 삭제
    // IP 환경에서도 쿠키 삭제가 확실히 되도록 Domain 설정을 제거하고 가장 단순한 형태로 삭제
    const cookiesToClear = ["authorization", "auth", "isLoggedIn", "admin_auth"];

    cookiesToClear.forEach((name) => {
        // 🟢 delete 메서드로 먼저 삭제 시도
        res.cookies.delete(name);
        
        // 🔴 [핵심]: HTTP 환경 테스트를 위해 'Secure; SameSite=None'을 제거합니다.
        // IP 주소(http://192.168...)에서는 Secure가 있으면 삭제가 작동하지 않습니다.
        // 여러 방식으로 삭제하여 확실히 처리
        res.headers.append(
            "Set-Cookie",
            `${name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly`
        );
        res.headers.append("Set-Cookie", `${name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
        res.headers.append("Set-Cookie", `${name}=; Path=/; Domain=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
    });

    // 🟢 캐시를 완전히 날려서 ?t= 루프를 방지합니다.
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    res.headers.set("Pragma", "no-cache");
    res.headers.set("Expires", "0");

    return res;
}
