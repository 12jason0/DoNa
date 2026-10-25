import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { verifyAuthToken } from "@/lib/auth";
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

        // JWT 토큰 검증 + token_version 비교
        if (!(await verifyAuthToken(token))) {
            return NextResponse.json({ error: "유효하지 않은 토큰입니다." }, { status: 401 });
        }
        const decoded = jwt.decode(token) as { userId: string; email: string; nickname: string };

        return NextResponse.json({
            valid: true,
            user: {
                userId: decoded.userId,
                email: decoded.email,
                nickname: decoded.nickname,
            },
        });
    } catch (error) {
            captureApiError(error);
        console.error("토큰 검증 오류:", error);
        return NextResponse.json({ error: "토큰 검증 중 오류가 발생했습니다." }, { status: 500 });
    }
}
