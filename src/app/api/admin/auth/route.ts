import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { signAdminToken, verifyAdminJwt } from "@/lib/auth";

const COOKIE_NAME = "admin_auth";
const COOKIE_TTL_SEC = 60 * 60 * 12; // 12h

export async function GET(req: NextRequest) {
    const authenticated = verifyAdminJwt(req);
    return NextResponse.json({ authenticated });
}

export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}));
    const password = String(body?.password || "");
    const expected = process.env.ADMIN_PASSWORD || "";

    if (!expected) {
        return NextResponse.json({ error: "Server password not configured" }, { status: 500 });
    }

    if (password !== expected) {
        return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    const token = signAdminToken();
    const res = NextResponse.json({ ok: true });
    res.cookies.set({
        name: COOKIE_NAME,
        value: token,
        httpOnly: true,
        path: "/",
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: COOKIE_TTL_SEC,
    });
    return res;
}

export async function DELETE() {
    const res = NextResponse.json({ ok: true });
    res.cookies.set({ name: COOKIE_NAME, value: "", maxAge: 0, path: "/" });
    return res;
}
