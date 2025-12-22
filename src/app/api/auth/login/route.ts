import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "@/lib/db";
export const dynamic = "force-dynamic";
import { getJwtSecret } from "@/lib/auth";

export async function POST(request: NextRequest) {
    try {
        const { email, password } = await request.json();

        // 입력 검증
        if (!email || !password) {
            return NextResponse.json({ error: "이메일과 비밀번호를 입력해주세요." }, { status: 400 });
        }

        // 🟢 디버깅 로그
        console.log("[로그인 API] 요청 받음:", { email, passwordLength: password?.length });

        // 사용자 조회 (Prisma)
        const found = await prisma.user.findUnique({ where: { email } } as any);
        if (!found) {
            console.log("[로그인 API] 사용자를 찾을 수 없음:", email);
            return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
        }

        console.log("[로그인 API] 사용자 찾음:", {
            id: found.id,
            email: found.email,
            hasPassword: !!found.password,
            passwordPrefix: found.password?.substring(0, 10),
        });

        // 🟢 비밀번호가 없는 경우 체크 (소셜 로그인 계정 등)
        if (!found.password) {
            console.log("[로그인 API] 비밀번호가 없음");
            return NextResponse.json(
                { error: "이 계정은 비밀번호로 로그인할 수 없습니다. 소셜 로그인을 사용해주세요." },
                { status: 401 }
            );
        }

        const user = { id: found.id, email: found.email, password: found.password, nickname: found.username } as any;

        // 🟢 비밀번호 검증 (null 체크 추가)
        if (!user.password) {
            console.log("[로그인 API] user.password가 null");
            return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
        }

        console.log("[로그인 API] 비밀번호 비교 시작:", {
            inputPassword: password,
            storedPasswordPrefix: user.password.substring(0, 20),
            storedPasswordLength: user.password.length,
        });

        const isPasswordValid = await bcrypt.compare(password, user.password);

        console.log("[로그인 API] 비밀번호 비교 결과:", isPasswordValid);

        if (!isPasswordValid) {
            console.log("[로그인 API] 비밀번호 불일치");
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
            { expiresIn: "7d" }
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

        const response = {
            success: true,
            message: "로그인이 완료되었습니다.",
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.nickname,
                nickname: user.nickname,
            },
        };
        // httpOnly 쿠키에 토큰 저장
        const res = NextResponse.json(response);
        res.cookies.set("auth", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
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
