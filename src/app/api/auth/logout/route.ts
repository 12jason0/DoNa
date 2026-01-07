import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const res = NextResponse.json({ success: true });

    // 1. 삭제할 모든 쿠키 리스트 (사용자 스크린샷 기반)
    const cookieNames = ["authorization", "isLoggedIn", "admin_auth", "ko_e", "ko_id"];

    // 2. 표준 삭제 옵션 정의
    // Secure; SameSite=None 옵션이 생성 시와 일치해야 WebView에서 삭제됩니다.
    const baseOptions = "Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=None";

    cookieNames.forEach((name) => {
        // HttpOnly 옵션이 있는 경우와 없는 경우를 모두 대응하기 위해 두 번씩 보냅니다.
        res.headers.append("Set-Cookie", `${name}=; ${baseOptions}; HttpOnly`);
        res.headers.append("Set-Cookie", `${name}=; ${baseOptions}`);
    });

    // 3. 캐시 파괴 (로그아웃 후 뒤로가기 방지)
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    res.headers.set("Pragma", "no-cache");
    res.headers.set("Expires", "0");

    return res;
}
