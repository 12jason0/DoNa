import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "@/lib/db";
import { getJwtSecret } from "@/lib/auth";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
        const { email, password, nickname, phone, birthday, ageRange, isMarketingAgreed } = await request.json();
        console.log("회원가입 시도:", { email, nickname, phone, birthday, ageRange, isMarketingAgreed });

        // 입력 검증
        if (!email || !password || !nickname) {
            return NextResponse.json({ error: "이메일, 비밀번호, 닉네임을 모두 입력해주세요." }, { status: 400 });
        }

        // 이메일 형식 검증
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json({ error: "올바른 이메일 형식을 입력해주세요." }, { status: 400 });
        }

        // 비밀번호 길이 검증
        if (password.length < 6) {
            return NextResponse.json({ error: "비밀번호는 최소 6자 이상이어야 합니다." }, { status: 400 });
        }

        // 이메일 중복 확인
        const existing = await (prisma as any).user.findFirst({ where: { email }, select: { id: true } });
        if (existing) return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 409 });

        const hashedPassword = await bcrypt.hash(password, 12);

        // 선택 항목 정리 및 나이 계산
        const trimmedPhone = typeof phone === "string" && phone.trim() ? phone.trim() : undefined;
        const trimmedAgeRange = typeof ageRange === "string" && ageRange.trim() ? ageRange.trim() : undefined;
        const birthdayTs = typeof birthday === "string" && birthday.trim() ? Date.parse(birthday.trim()) : NaN;
        const birthdayDate = Number.isNaN(birthdayTs) ? undefined : new Date(birthdayTs);

        let computedAge: number | undefined = undefined;
        if (birthdayDate) {
            const now = new Date();
            let age = now.getFullYear() - birthdayDate.getFullYear();
            const m = now.getMonth() - birthdayDate.getMonth();
            if (m < 0 || (m === 0 && now.getDate() < birthdayDate.getDate())) age--;
            if (Number.isFinite(age) && age >= 0 && age <= 120) computedAge = age;
        }

        // ⚠️ [시간대 수정] 서버가 UTC일 수 있으므로 한국 시간(KST)으로 변환하여 비교
        const now = new Date();
        const utc = now.getTime() + now.getTimezoneOffset() * 60000;
        const kstNow = new Date(utc + 9 * 60 * 60 * 1000); // 한국 시간(UTC+9)

        const eventEndDate = new Date("2026-01-10T23:59:59+09:00");
        const initialCoupons = kstNow <= eventEndDate ? 3 : 1;

        // 트랜잭션으로 사용자 생성 및 보상 기록
        const created = await (prisma as any).$transaction(async (tx) => {
            // 사용자 생성
            const newUser = await tx.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    username: nickname,
                    provider: "local",
                    phone: trimmedPhone,
                    ageRange: trimmedAgeRange,
                    birthday: birthdayDate,
                    age: computedAge,
                    couponCount: initialCoupons, // 🎁 이벤트 기간이면 3개, 아니면 1개
                    // [법적 필수] 마케팅 수신 동의
                    isMarketingAgreed: isMarketingAgreed === true,
                    marketingAgreedAt: isMarketingAgreed === true ? new Date() : null,
                },
                select: { id: true, email: true, username: true },
            });

            // 보상 기록 남기기
            try {
                await tx.userReward.create({
                    data: {
                        userId: newUser.id,
                        type: "signup",
                        amount: initialCoupons,
                        unit: "coupon",
                    },
                });
            } catch (rewardError) {
                console.error("보상 기록 실패 (무시하고 진행):", rewardError);
                // 보상 기록 실패해도 회원가입은 성공 처리
            }

            return newUser;
        });

        const JWT_SECRET = getJwtSecret();
        if (!JWT_SECRET) {
            throw new Error("JWT_SECRET이 설정되지 않았습니다.");
        }

        const token = jwt.sign({ userId: created.id, email, nickname }, JWT_SECRET, { expiresIn: "7d" });

        return NextResponse.json({
            success: true,
            message: `회원가입이 완료되었습니다. 쿠폰 ${initialCoupons}개가 지급되었습니다.`,
            token,
            user: { id: created.id, email, nickname },
        });
    } catch (error: any) {
        console.error("[회원가입 API] 오류 발생:", error);
        console.error("[회원가입 API] 에러 상세:", {
            message: error?.message || "Unknown error",
            stack: error?.stack,
            code: error?.code,
            meta: error?.meta,
        });

        // Prisma 에러 처리
        if (error?.code === "P2002") {
            const field = error?.meta?.target?.[0] || "필드";
            return NextResponse.json(
                {
                    error: `이미 사용 중인 ${field === "email" ? "이메일" : field}입니다.`,
                },
                { status: 409 }
            );
        }

        return NextResponse.json(
            {
                error: "회원가입 중 오류가 발생했습니다.",
                details: error?.message || "알 수 없는 오류",
            },
            { status: 500 }
        );
    }
}
