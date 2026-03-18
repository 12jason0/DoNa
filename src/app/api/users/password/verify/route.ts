import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        if (!userId) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }
        const { currentPassword } = await request.json();
        if (!currentPassword) {
            return NextResponse.json({ error: "현재 비밀번호가 필요합니다." }, { status: 400 });
        }
        const user = await prisma.user.findUnique({ where: { id: Number(userId) } } as any);
        if (!user || !user.password) {
            return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
        }
        const ok = await bcrypt.compare(String(currentPassword), String(user.password));
        if (!ok) {
            return NextResponse.json({ ok: false, error: "현재 비밀번호가 올바르지 않습니다." }, { status: 401 });
        }
        return NextResponse.json({ ok: true });
    } catch (e) {

            captureApiError(e);
        return NextResponse.json({ error: "검증 중 오류가 발생했습니다." }, { status: 500 });
    }
}


