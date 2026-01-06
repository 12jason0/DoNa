import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
    const res = NextResponse.json({ success: true });

    // 🟢 [긴급 Fix]: WebView 쿠키 삭제 "융단 폭격" - 모든 가능한 쿠키 삭제 명령을 보냄
    // WebView는 쿠키를 지울 때 생성 당시의 옵션(Secure, Path 등)과 하나라도 다르면 삭제 명령을 무시하는 경우가 많음
    const deleteOptions = "Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT";

    // 🟢 [핵심] 여러 버전의 Set-Cookie를 한 번에 보냄
    // 앱 WebView는 Secure 속성이 일치하지 않으면 삭제를 안 할 때가 많으므로 두 버전 다 보냄
    res.headers.append("Set-Cookie", `auth=; ${deleteOptions}`); // Non-Secure
    res.headers.append("Set-Cookie", `auth=; ${deleteOptions}; Secure`); // Secure 포함

    // 🟢 추가 삭제 시도 (Path만 있는 버전)
    res.headers.append("Set-Cookie", "auth=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT");

    // 🟢 강력한 캐시 방지 (WebView가 이전 로그인 정보를 기억하지 못하게 함)
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    res.headers.set("Pragma", "no-cache");
    res.headers.set("Expires", "0");

    return res;
}
