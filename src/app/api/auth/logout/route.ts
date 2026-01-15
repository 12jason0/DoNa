import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
    const res = NextResponse.json({ success: true });

    // 🔴 [핵심]: IP 환경에서도 쿠키 삭제가 확실히 되도록 Domain 설정을 제거하고 가장 단순한 형태로 삭제
    // IP 주소 환경에서는 Domain 설정이 포함되면 쿠키 삭제가 실패할 수 있음
    const cookiesToClear = ["authorization", "auth", "isLoggedIn", "admin_auth"];

    cookiesToClear.forEach((name) => {
        // 🔴 [핵심]: HTTP 환경 테스트를 위해 'Secure; SameSite=None'을 제거합니다.
        // IP 주소(http://192.168...)에서는 Secure가 있으면 삭제가 작동하지 않습니다.
        res.headers.append(
            "Set-Cookie",
            `${name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly`
        );
        res.headers.append("Set-Cookie", `${name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
    });

    // 🟢 캐시를 완전히 날려서 ?t= 루프를 방지합니다.
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    res.headers.set("Pragma", "no-cache");
    res.headers.set("Expires", "0");

    return res;
}
