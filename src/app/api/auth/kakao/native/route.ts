import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import prisma from "@/lib/db";
import { getJwtSecret } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/kakao/native
 * Android 네이티브 카카오 SDK에서 발급된 accessToken으로 로그인
 */
export async function POST(request: NextRequest) {
    try {
        const { accessToken } = await request.json();
        const JWT_SECRET = getJwtSecret();

        if (!accessToken) {
            return NextResponse.json({ error: "accessToken이 필요합니다." }, { status: 400 });
        }

        // 카카오 사용자 정보 조회
        const userRes = await fetch("https://kapi.kakao.com/v2/user/me", {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!userRes.ok) {
            return NextResponse.json({ error: "카카오 사용자 정보 조회에 실패했습니다." }, { status: 400 });
        }

        const userData = await userRes.json();
        const socialId = String(userData.id);

        const nickname = userData.properties?.nickname || `user_${socialId}`;
        const email = userData.kakao_account?.email || null;
        let profileImageUrl =
            userData.properties?.profile_image ||
            userData.kakao_account?.profile?.profile_image_url ||
            null;
        if (profileImageUrl?.startsWith("http://")) {
            profileImageUrl = profileImageUrl.replace(/^http:\/\//, "https://");
        }

        let ageRange: string | null = null;
        if (userData.kakao_account?.age_range) {
            const k = userData.kakao_account.age_range;
            if (k.startsWith("10~")) ageRange = "10대";
            else if (k.startsWith("20~")) ageRange = "20대";
            else if (k.startsWith("30~")) ageRange = "30대";
            else if (k.startsWith("40~")) ageRange = "40대";
            else ageRange = "50대 이상";
        }

        let gender: string | null = null;
        if (userData.kakao_account?.gender) {
            const g = userData.kakao_account.gender.toLowerCase();
            if (g === "male") gender = "M";
            else if (g === "female") gender = "F";
        }

        const result = await (prisma as any).$transaction(async (tx: any) => {
            let user = await tx.user.findFirst({
                where: { socialId, provider: "kakao" },
                select: { id: true, email: true, username: true, profileImageUrl: true, ageRange: true, gender: true },
            });

            if (!user && email) {
                user = await tx.user.findUnique({
                    where: { email },
                    select: { id: true, email: true, username: true, profileImageUrl: true, ageRange: true, gender: true },
                });
            }

            if (user) {
                const updateData: any = {
                    username: nickname || user.username,
                    profileImageUrl: profileImageUrl || user.profileImageUrl,
                    socialId,
                    provider: "kakao",
                };
                if (email && !user.email) updateData.email = email;
                if (ageRange && !user.ageRange?.trim()) updateData.ageRange = ageRange;
                if (gender && !user.gender?.trim()) updateData.gender = gender;

                const updated = await tx.user.update({
                    where: { id: user.id },
                    data: updateData,
                    select: { id: true, email: true, username: true, profileImageUrl: true },
                });
                return { user: updated, isNew: false };
            } else {
                const newUser = await tx.user.create({
                    data: { username: nickname, email, profileImageUrl, socialId, provider: "kakao", ageRange, gender },
                    select: { id: true, email: true, username: true, profileImageUrl: true },
                });
                return { user: newUser, isNew: true };
            }
        });

        const user = result.user;
        const token = jwt.sign({ userId: user.id, name: user.username }, JWT_SECRET, { expiresIn: "365d" });

        const res = NextResponse.json({
            success: true,
            token,
            user: { id: user.id, email: user.email, name: user.username, nickname: user.username },
        });

        res.cookies.delete("auth");
        res.cookies.set("auth", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 365,
        });

        return res;
    } catch (err) {
        captureApiError(err);
        return NextResponse.json({ error: "카카오 로그인 중 오류가 발생했습니다." }, { status: 500 });
    }
}
