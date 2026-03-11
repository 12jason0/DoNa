import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "@/lib/db";
export const dynamic = "force-dynamic";
import { getJwtSecret } from "@/lib/auth";
import { checkRateLimit, getIdentifierFromRequest } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
    try {
        // 🟢 [보안] Rate limiting: 로그인 시도 남용 방지
        const identifier = getIdentifierFromRequest(request);
        const rl = await checkRateLimit("auth_login", identifier);
        if (!rl.success) {
            return NextResponse.json(
                { error: "너무 많은 로그인 시도입니다. 잠시 후 다시 시도해주세요." },
                { status: 429, headers: { "X-RateLimit-Limit": String(rl.limit), "X-RateLimit-Remaining": String(rl.remaining) } }
            );
        }

        const { email, password } = await request.json();

        // 입력 검증
        if (!email || !password) {
            return NextResponse.json({ error: "이메일과 비밀번호를 입력해주세요." }, { status: 400 });
        }

        // 사용자 조회 (Prisma)
        const found = await prisma.user.findUnique({ where: { email } } as any);
        if (!found) {
            return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
        }

        // 🟢 비밀번호가 없는 경우 체크 (소셜 로그인 계정 등)
        if (!found.password) {
            return NextResponse.json(
                { error: "이 계정은 비밀번호로 로그인할 수 없습니다. 소셜 로그인을 사용해주세요." },
                { status: 401 }
            );
        }

        const user = { id: found.id, email: found.email, password: found.password, nickname: found.username } as any;

        // 🟢 비밀번호 검증 (null 체크 추가)
        if (!user.password) {
            return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
        }

        // JWT 토큰 생성
        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                name: user.nickname,
            },
            getJwtSecret(),
            { expiresIn: "365d" }
        );

        // [법적 필수] 로그인 로그 저장
        try {
            const ip =
                request.headers.get("x-forwarded-for") ||
                request.headers.get("x-real-ip") ||
                (request as any).socket?.remoteAddress ||
                "unknown";
            const ipAddress = Array.isArray(ip) ? ip[0] : ip;

            await (prisma as any).loginLog.create({
                data: {
                    userId: user.id,
                    ipAddress: ipAddress,
                },
            });
        } catch (logError) {
            // 로그 저장 실패해도 로그인은 성공 처리
            console.error("로그인 로그 저장 실패:", logError);
        }

        // 🟢 쿠키 기반 인증: httpOnly 쿠키에 토큰 저장
        const res = NextResponse.json({
            success: true,
            message: "로그인이 완료되었습니다.",
            // 🟢 token은 제거 (쿠키만 사용)
            // 기존 코드 호환성을 위해 선택적으로 반환 (앱에서 필요할 수 있음)
            ...(process.env.ENABLE_TOKEN_RESPONSE === "true" && { token }),
            user: {
                id: user.id,
                email: user.email,
                name: user.nickname,
                nickname: user.nickname,
            },
        });
        
        // 🟢 [Fix]: 이전 세션 파편 완전 제거 (로컬/카카오 로그인 통합)
        res.cookies.delete("auth");
        res.cookies.delete("authorization");
        
        // 새로운 보안 쿠키 설정
        res.cookies.set("auth", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 365, // 1년
        });
        
        return res;
    } catch (error) {
        console.error("로그인 오류:", error);
        console.error("에러 상세:", {
            message: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined,
        });
        return NextResponse.json(
            {
                error: "로그인 중 오류가 발생했습니다.",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
