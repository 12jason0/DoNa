import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/db";
import { resolveUserId, setAuthCookie, signAuthToken } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";
export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
    try {
        const userId = await resolveUserId(request);
        if (!userId) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }
        const { currentPassword, newPassword } = await request.json();
        if (!currentPassword || !newPassword) {
            return NextResponse.json({ error: "필수 값이 누락되었습니다." }, { status: 400 });
        }
        if (String(newPassword).length < 6) {
            return NextResponse.json({ error: "새 비밀번호는 최소 6자 이상이어야 합니다." }, { status: 400 });
        }
        const user = await prisma.user.findUnique({ where: { id: Number(userId) } } as any);
        if (!user || !user.password) {
            return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
        }
        const ok = await bcrypt.compare(String(currentPassword), String(user.password));
        if (!ok) {
            return NextResponse.json({ error: "현재 비밀번호가 올바르지 않습니다." }, { status: 401 });
        }
        const hashed = await bcrypt.hash(String(newPassword), 12);
        // token_version +1 → 다른 기기 토큰은 무효. 지금 기기는 새 토큰으로 계속 로그인
        const updated = await prisma.user.update({
            where: { id: Number(userId) },
            data: { password: hashed, tokenVersion: { increment: 1 } },
            select: { id: true, email: true, username: true, tokenVersion: true },
        });
        const token = signAuthToken(updated);
        const res = NextResponse.json({ success: true, token });
        setAuthCookie(res, token);
        return res;
    } catch (e) {

            captureApiError(e);
        return NextResponse.json({ error: "비밀번호 변경 중 오류가 발생했습니다." }, { status: 500 });
    }
}
