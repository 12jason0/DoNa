import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "@/lib/db";
import { getJwtSecret } from "@/lib/auth";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
        const { email, password, nickname, phone, birthday, ageRange } = await request.json();
        console.log("회원가입 시도:", { email, nickname, phone, birthday, ageRange });

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

        const created = await (prisma as any).user.create({
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
            },
            select: { id: true, email: true, username: true },
        });

        const JWT_SECRET = getJwtSecret();
        const token = jwt.sign({ userId: created.id, email, nickname }, JWT_SECRET, { expiresIn: "7d" });

        return NextResponse.json({
            success: true,
            message: "회원가입이 완료되었습니다.",
            token,
            user: { id: created.id, email, nickname },
        });
    } catch (error) {
        console.error("회원가입 오류:", error);
        console.error("에러 상세:", {
            message: error instanceof Error ? error.message : "Unknown error",
            stack: error instanceof Error ? error.stack : undefined,
        });
        return NextResponse.json(
            {
                error: "회원가입 중 오류가 발생했습니다.",
                details: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}
