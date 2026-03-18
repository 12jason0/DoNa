import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
    try {
        // Authorization 헤더에서 토큰 추출
        const authHeader = request.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json({ error: "인증 토큰이 필요합니다." }, { status: 401 });
        }

        const token = authHeader.substring(7);
        const JWT_SECRET = getJwtSecret();

        try {
            // JWT 토큰 검증
            const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; nickname: string };

            return NextResponse.json({
                valid: true,
                user: {
                    userId: decoded.userId,
                    email: decoded.email,
                    nickname: decoded.nickname,
                },
            });
        } catch {
            return NextResponse.json({ error: "유효하지 않은 토큰입니다." }, { status: 401 });
        }
    } catch (error) {
            captureApiError(error);
        console.error("토큰 검증 오류:", error);
        return NextResponse.json({ error: "토큰 검증 중 오류가 발생했습니다." }, { status: 500 });
    }
}
