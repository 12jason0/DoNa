import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "@/lib/db";
import { getJwtSecret } from "@/lib/auth";
import { getSafeRedirectPath } from "@/lib/redirect";

export const dynamic = "force-dynamic";

/**
 * 🟢 회원가입 및 자동 로그인 처리 (보안 쿠키 기반)
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, password, nickname, phone, birthday, ageRange, gender, isMarketingAgreed, next } = body;

        // 리다이렉트 경로 검증
        const safeNext = getSafeRedirectPath(next, "/");

        // 1. 필수 입력값 검증 (백엔드 이중 체크)
        if (!email || !password || !nickname || !ageRange || !gender) {
            return NextResponse.json({ error: "필수 정보를 모두 입력해주세요." }, { status: 400 });
        }

        // 2. 이메일 형식 검증
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json({ error: "올바른 이메일 형식을 입력해주세요." }, { status: 400 });
        }

        // 3. 이메일 중복 확인
        const existing = await (prisma as any).user.findFirst({
            where: { email },
            select: { id: true },
        });
        if (existing) {
            return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 409 });
        }

        // 4. 비밀번호 암호화
        const hashedPassword = await bcrypt.hash(password, 12);

        // 5. 나이 계산 및 데이터 정제
        const birthdayDate = birthday ? new Date(birthday) : undefined;
        let computedAge: number | undefined = undefined;
        if (birthdayDate && !isNaN(birthdayDate.getTime())) {
            const now = new Date();
            let age = now.getFullYear() - birthdayDate.getFullYear();
            const m = now.getMonth() - birthdayDate.getMonth();
            if (m < 0 || (m === 0 && now.getDate() < birthdayDate.getDate())) age--;
            computedAge = age;
        }

        // 6. 🎁 이벤트 쿠키 지급 로직 (KST 기준)
        const now = new Date();
        const utc = now.getTime() + now.getTimezoneOffset() * 60000;
        const kstNow = new Date(utc + 9 * 60 * 60 * 1000);
        const eventEndDate = new Date("2026-01-10T23:59:59+09:00");
        const initialCoupons = kstNow <= eventEndDate ? 3 : 1;

        // 7. Prisma 트랜잭션: 유저 생성 + 보상 기록 (성능 최적화) [cite: 2025-12-24]
        const createdUser = await (prisma as any).$transaction(async (tx: any) => {
            // 사용자 생성
            const newUser = await tx.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    username: nickname,
                    provider: "local",
                    phone: phone || undefined,
                    ageRange: ageRange.trim(),
                    gender,
                    birthday: birthdayDate,
                    age: computedAge,
                    couponCount: initialCoupons,
                    isMarketingAgreed: isMarketingAgreed === true,
                    marketingAgreedAt: isMarketingAgreed === true ? new Date() : null,
                },
                select: { id: true, email: true, username: true },
            });

            // 보상 로그 생성
            await tx.userReward.create({
                data: {
                    userId: newUser.id,
                    type: "signup",
                    amount: initialCoupons,
                    unit: "coupon",
                },
            });

            return newUser;
        });

        // 8. JWT 토큰 생성
        const JWT_SECRET = getJwtSecret();
        if (!JWT_SECRET) throw new Error("JWT_SECRET missing");

        const token = jwt.sign(
            { userId: createdUser.id, email: createdUser.email, name: createdUser.username },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        // 9. 🟢 JSON 응답 및 보안 쿠키 설정 [cite: 2025-12-24]
        // 클라이언트 fetch에서 credentials: "include"를 사용하므로 쿠키가 저장됩니다.
        const res = NextResponse.json({
            success: true,
            message: "회원가입이 완료되었습니다.",
            next: safeNext,
        });

        res.cookies.set("auth", token, {
            httpOnly: true, // XSS 공격 방지 [cite: 2025-12-24]
            secure: process.env.NODE_ENV === "production", // HTTPS 환경 강제
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 7, // 7일 유지
        });

        return res;
    } catch (error: any) {
        console.error("[Signup API Error]:", error);

        // Prisma 유니크 제약 조건 에러 처리 (이중 방어)
        if (error?.code === "P2002") {
            return NextResponse.json({ error: "이미 사용 중인 이메일 또는 정보입니다." }, { status: 409 });
        }

        return NextResponse.json(
            { error: "회원가입 처리 중 서버 오류가 발생했습니다.", details: error?.message },
            { status: 500 }
        );
    }
}
