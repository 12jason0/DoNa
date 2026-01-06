import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function POST() {
    const res = NextResponse.json({ success: true });
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
    res.headers.set("Set-Cookie", "auth=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    return res;
}
