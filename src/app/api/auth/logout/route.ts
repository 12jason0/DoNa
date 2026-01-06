import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
    const res = NextResponse.json({ success: true });
    
    // 🟢 앱 환경 감지
    const userAgent = req.headers.get("user-agent") || "";
    const isApp = /ReactNative|Expo/i.test(userAgent);
    
    // 🟢 [Fix]: 쿠키 완전 삭제 (모든 옵션 명시)
    res.cookies.set("auth", "", { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/", 
        maxAge: 0,
        expires: new Date(0) // 🟢 만료일을 과거로 설정하여 확실히 삭제
    });
    
    // 🟢 [Fix]: 쿠키 삭제를 확실히 하기 위해 Set-Cookie 헤더 직접 설정
    // 앱 환경에서는 Secure 옵션을 제거하여 WebView에서도 확실히 삭제되도록 함
    const cookieHeader = isApp 
        ? "auth=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
        : `auth=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
    
    res.headers.set("Set-Cookie", cookieHeader);
    
    // 🟢 앱 환경에서는 캐시 방지 헤더 추가
    if (isApp) {
        res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        res.headers.set("Pragma", "no-cache");
    }
    
    return res;
}
