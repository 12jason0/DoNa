// src/app/api/auth/kakao/route.ts

import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import prisma from "@/lib/db";
import { getJwtSecret } from "@/lib/auth";

export const dynamic = "force-dynamic";

// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// 1. 이 GET 함수가 로그인 시작을 위해 필요합니다! (추가)
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
export async function GET(request: NextRequest) {
    const KAKAO_CLIENT_ID = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID;

    if (!KAKAO_CLIENT_ID) {
        console.error("KAKAO_CLIENT_ID가 설정되지 않았습니다.");
        return NextResponse.json({ error: "카카오 로그인 설정이 누락되었습니다." }, { status: 500 });
    }

    // 현재 요청이 들어온 호스트(도메인)를 확인합니다.
    const host = request.headers.get("host");
    // Vercel 배포 환경은 'https', 로컬은 'http'를 사용합니다.
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";

    // 동적으로 Redirect URI를 생성합니다.
    // (예: https://stylesmap.com/api/auth/kakao/callback)
    const KAKAO_REDIRECT_URI = `${protocol}://${host}/api/auth/kakao/callback`;

    // 카카오 인증 URL 생성
    const encodedRedirectUri = encodeURIComponent(KAKAO_REDIRECT_URI);
    const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_CLIENT_ID}&redirect_uri=${encodedRedirectUri}&response_type=code`;

    // 생성된 URL로 리디렉션
    return NextResponse.redirect(kakaoAuthUrl);
}
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
// GET 함수 끝
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
// 2. 이 POST 함수는 원래 있던 코드입니다. (유지)
// ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
export async function POST(request: NextRequest) {
    console.log("=== 카카오 로그인 API 시작 ===");
    try {
        const { code } = await request.json();
        const JWT_SECRET = getJwtSecret();
        if (!JWT_SECRET) {
            return NextResponse.json({ error: "서버 설정 오류: JWT_SECRET이 없습니다." }, { status: 500 });
        }

        if (!code) {
            return NextResponse.json({ error: "카카오 인증 코드가 필요합니다." }, { status: 400 });
        }

        const kakaoClientId = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID;
        if (!kakaoClientId) {
            console.error("KAKAO_CLIENT_ID 환경 변수가 설정되지 않았습니다.");
            return NextResponse.json({ error: "서버 설정 오류: 카카오 클라이언트 ID가 없습니다." }, { status: 500 });
        }

        // 🚨 중요: POST 함수 내부의 redirectUri도 동적으로 생성해야 합니다!
        // 이 부분이 GET 함수와 일치하지 않으면 "redirect_uri mismatch" 오류가 발생합니다.

        // 1. 요청 헤더에서 Host를 가져옵니다. (GET 함수와 동일한 로직)
        // Vercel 환경에서는 request.headers.get('x-forwarded-host')를 우선적으로 확인하는 것이 더 안정적일 수 있습니다.
        const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
        const protocol = process.env.NODE_ENV === "production" ? "https" : "http";

        // 2. GET 함수에서 사용한 것과 *똑같은* Redirect URI를 생성합니다.
        const redirectUri = `${protocol}://${host}/api/auth/kakao/callback`;

        // 3. 기존의 하드코딩된 redirectUri를 대체합니다.
        // const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/kakao/callback`; // (기존 코드)

        const tokenParams = new URLSearchParams({
            grant_type: "authorization_code",
            client_id: kakaoClientId,
            code: code,
            redirect_uri: redirectUri, // 👈 동적으로 생성된 redirectUri 사용
        });
        if (process.env.KAKAO_CLIENT_SECRET) {
            tokenParams.append("client_secret", process.env.KAKAO_CLIENT_SECRET);
        }

        const tokenResponse = await fetch("https://kauth.kakao.com/oauth/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
            body: tokenParams.toString(),
        });

        const tokenData = await tokenResponse.json();
        if (!tokenResponse.ok) {
            console.error("카카오 토큰 교환 실패:", tokenData);
            return NextResponse.json(
                { error: tokenData.error_description || "토큰 교환에 실패했습니다." },
                { status: 400 }
            );
        }

        const userResponse = await fetch("https://kapi.kakao.com/v2/user/me", {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
                "Content-type": "application/x-www-form-urlencoded;charset=utf-8",
            },
        });

        const userData = await userResponse.json();
        if (!userResponse.ok) {
            console.error("카카오 사용자 정보 조회 실패:", userData);
            return NextResponse.json({ error: "카카오 사용자 정보를 가져올 수 없습니다." }, { status: 401 });
        }

        console.log("카카오 사용자 정보:", userData);

        const { id, properties, kakao_account } = userData;

        const socialId = String(id);
        const nickname = properties?.nickname || kakao_account?.profile?.nickname;
        const profileImageUrl = properties?.profile_image || kakao_account?.profile?.profile_image_url;
        const email = kakao_account?.email || null;

        let user;
        let message = "카카오 로그인이 완료되었습니다.";
        let isNewUser = false;
        let couponsAwarded = 0;

        // ✅ username 사용
        const existing = await (prisma as any).user.findFirst({
            where: { provider: "kakao", socialId },
            select: { id: true, email: true, username: true, couponCount: true },
        });

        if (existing) {
            user = existing;
        } else {
            // 새로운 유저 생성 + 쿠폰 2개 지급
            user = await (prisma as any).user.create({
                data: {
                    email,
                    username: nickname || `user_${socialId}`,
                    socialId,
                    profileImageUrl,
                    provider: "kakao",
                    createdAt: new Date(),
                    couponCount: 3, // 🎁 카카오 로그인으로 가입 시 무료 쿠폰 2개 지급!
                },
                select: { id: true, email: true, username: true, couponCount: true },
            });

            // 보상 기록 남기기
            await (prisma as any).userReward.create({
                data: {
                    userId: user.id,
                    type: "signup",
                    amount: 2,
                    unit: "coupon",
                },
            });

            message = "카카오 회원가입이 완료되었습니다. 쿠폰 2개가 지급되었습니다.";
            isNewUser = true;
            couponsAwarded = 2;
        }

        // ✅ 토큰에 username 반영
        const token = jwt.sign({ userId: user.id, email: user.email, name: user.username }, JWT_SECRET, {
            expiresIn: "7d",
        });

        const responsePayload = {
            success: true,
            message,
            token,
            user: { id: user.id, email: user.email, name: user.username, coins: (user as any).couponCount ?? 0 },
            newUser: isNewUser,
            couponsAwarded: couponsAwarded,
        };

        const res = NextResponse.json(responsePayload);
        res.cookies.set("auth", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
        });
        return res;
    } catch (error) {
        console.error("카카오 로그인 API 전체 오류:", error);
        return NextResponse.json(
            {
                error: "카카오 로그인 중 서버 오류가 발생했습니다.",
                details: error instanceof Error ? error.message : "알 수 없는 오류",
            },
            { status: 500 }
        );
    }
}
