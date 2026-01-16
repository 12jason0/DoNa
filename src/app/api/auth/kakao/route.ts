import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import prisma from "@/lib/db";
import { getJwtSecret } from "@/lib/auth";
import { getSafeRedirectPath } from "@/lib/redirect";

export const dynamic = "force-dynamic";

// 🟢 [2026-01-21] 파일 로드 확인 로그
console.log("✅ [카카오 로그인 API] route.ts 파일이 로드되었습니다.");

export async function GET(request: NextRequest) {
    const KAKAO_CLIENT_ID = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID;
    const next = getSafeRedirectPath(request.nextUrl.searchParams.get("next"), "/");

    // 🟢 [2026-01-21] Redirect URI 불일치 해결: 실제 요청 호스트 사용
    // POST 함수와 동일한 로직으로 origin 생성 (0.0.0.0 처리 제거)
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || request.nextUrl.host;
    const protocol =
        request.headers.get("x-forwarded-proto") || (request.nextUrl.protocol === "https:" ? "https" : "http");
    const origin = `${protocol}://${host}`;
    const KAKAO_REDIRECT_URI = `${origin}/api/auth/kakao/callback`;

    console.log("📍 [GET] 카카오 인증 시작 - Redirect URI:", KAKAO_REDIRECT_URI);
    console.log("📍 [GET] 호스트 정보 - host:", host, "protocol:", protocol);

    // 🟢 성별과 연령대 정보를 받기 위해 scope에 age_range, gender 포함
    // account_email도 추가하여 이메일 정보도 받을 수 있도록 함
    const scope = "profile_nickname,profile_image,account_email,age_range,gender";
    // 🟢 [Fix]: prompt=consent 추가 - 기존 사용자도 재동의를 받아 최신 권한 적용
    // 이렇게 하면 카카오 계정 연결을 끊지 않고도 최신 동의 상태를 받을 수 있음
    const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_CLIENT_ID}&redirect_uri=${encodeURIComponent(
        KAKAO_REDIRECT_URI
    )}&response_type=code&scope=${encodeURIComponent(scope)}&prompt=consent&state=${encodeURIComponent(next)}`;

    return NextResponse.redirect(kakaoAuthUrl);
}

export async function POST(request: NextRequest) {
    // 🟢 [2026-01-21] POST 함수 호출 확인용 로그
    console.log("🚀 [카카오 로그인 API] POST 함수가 호출되었습니다!");
    console.log("📍 [요청 정보] URL:", request.url);
    console.log("📍 [요청 정보] Method:", request.method);
    console.log("📍 [요청 정보] Headers:", Object.fromEntries(request.headers.entries()));

    // 🟢 [2026-01-21] 환경 변수 디버깅: 서버가 실제로 읽고 있는 값 확인
    console.log("🔍 [DEBUG] NEXT_PUBLIC_KAKAO_CLIENT_ID:", process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID);
    console.log("🔍 [DEBUG] KAKAO_CLIENT_SECRET:", process.env.KAKAO_CLIENT_SECRET ? "***설정됨***" : "❌ undefined");
    console.log("🔍 [DEBUG] KAKAO_CLIENT_SECRET 길이:", process.env.KAKAO_CLIENT_SECRET?.length || 0);

    try {
        // 🟢 [2026-01-21] 요청 본문 확인 (파싱 전)
        const requestClone = request.clone();
        const rawBody = await requestClone.text();
        console.log("📍 [요청 본문] Raw:", rawBody);

        const { code, next } = await request.json();
        console.log("📍 [파싱된 데이터] code:", code, "next:", next);
        const JWT_SECRET = getJwtSecret();

        // 🟢 [2026-01-21] Redirect URI 불일치 해결: 실제 요청 호스트 사용
        // 0.0.0.0을 localhost로 변경하지 않고 실제 호스트 주소 사용
        const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || request.nextUrl.host;
        const protocol =
            request.headers.get("x-forwarded-proto") || (request.nextUrl.protocol === "https:" ? "https" : "http");
        const origin = `${protocol}://${host}`;
        const redirectUri = `${origin}/api/auth/kakao/callback`;

        console.log("📍 [최종 Redirect URI]:", redirectUri);
        console.log("📍 [호스트 정보] host:", host, "protocol:", protocol);

        // 🟢 [2026-01-21] 카카오 토큰 교환 요청에 client_secret 추가 (KOE010 에러 해결)
        const kakaoClientSecret = process.env.KAKAO_CLIENT_SECRET;
        if (!kakaoClientSecret) {
            console.error("❌ [카카오 인증] KAKAO_CLIENT_SECRET 환경 변수가 설정되지 않았습니다.");
            return NextResponse.json(
                { error: "서버 설정 오류: 카카오 클라이언트 시크릿이 없습니다." },
                { status: 500 }
            );
        }

        const tokenParams = new URLSearchParams({
            grant_type: "authorization_code",
            client_id: process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID!,
            client_secret: kakaoClientSecret, // 🟢 KOE010 에러 해결: client_secret 필수 포함
            code,
            redirect_uri: redirectUri,
        });

        console.log("📍 [토큰 교환] client_secret 포함됨 (KOE010 방지)");

        const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
            body: tokenParams.toString(),
        });

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) {
            // 🟢 [2026-01-21] 카카오 토큰 에러 상세 로깅
            console.error("❌ [카카오 토큰 에러 상세]:", tokenData);
            console.error("❌ [카카오 토큰 에러] 상태 코드:", tokenRes.status);
            console.error("❌ [카카오 토큰 에러] 사용한 redirectUri:", redirectUri);
            return NextResponse.json(
                {
                    error: "카카오 인증 실패",
                    detail: tokenData,
                    redirectUri: redirectUri, // 디버깅용
                },
                { status: 400 }
            );
        }

        // 🟢 [Fix]: property_keys 파라미터 제거 - kakao_account 정보는 기본 응답에 포함됨
        // property_keys를 사용하면 지정하지 않은 필드가 응답에서 제외될 수 있음
        const userRes = await fetch("https://kapi.kakao.com/v2/user/me", {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const userData = await userRes.json();

        // 🟢 [Debug]: 카카오 원시 데이터 로깅 (데이터 누락 원인 파악용)
        console.log("=== 카카오 원시 데이터 ===");
        console.log(JSON.stringify(userData, null, 2));
        console.log("kakao_account:", userData.kakao_account);
        console.log("age_range:", userData.kakao_account?.age_range);
        console.log("gender:", userData.kakao_account?.gender);
        console.log("email:", userData.kakao_account?.email);
        console.log("has_age_range:", userData.kakao_account?.has_age_range);
        console.log("has_gender:", userData.kakao_account?.has_gender);
        const socialId = String(userData.id);

        // 카카오 사용자 정보 추출
        const nickname = userData.properties?.nickname || `user_${socialId}`;
        const email = userData.kakao_account?.email || null;
        // HTTP URL을 HTTPS로 변환 (Mixed Content 경고 해결)
        let profileImageUrl =
            userData.properties?.profile_image || userData.kakao_account?.profile?.profile_image_url || null;
        if (profileImageUrl && profileImageUrl.startsWith("http://")) {
            profileImageUrl = profileImageUrl.replace(/^http:\/\//, "https://");
        }

        // 연령대 변환: 카카오 "20~29" → DB "20대"
        let ageRange: string | null = null;
        if (userData.kakao_account?.age_range) {
            const kakaoAgeRange = userData.kakao_account.age_range;
            if (kakaoAgeRange.startsWith("10~")) ageRange = "10대";
            else if (kakaoAgeRange.startsWith("20~")) ageRange = "20대";
            else if (kakaoAgeRange.startsWith("30~")) ageRange = "30대";
            else if (kakaoAgeRange.startsWith("40~")) ageRange = "40대";
            else if (
                kakaoAgeRange.startsWith("50~") ||
                kakaoAgeRange.startsWith("60~") ||
                kakaoAgeRange.startsWith("70~")
            )
                ageRange = "50대 이상";
        }

        // 성별 변환: 카카오 "male"/"female" → DB "M"/"F"
        let gender: string | null = null;
        if (userData.kakao_account?.gender) {
            const kakaoGender = userData.kakao_account.gender.toLowerCase();
            if (kakaoGender === "male") gender = "M";
            else if (kakaoGender === "female") gender = "F";
        }

        // 🟢 [2026-01-21] 강제 테스트: 카카오 데이터 수신 문제인지 확인용
        // 🔴 주의: 이 코드는 테스트 후 반드시 제거하거나 주석 처리하세요
        // const TEST_MODE = process.env.NODE_ENV === "development"; // 개발 환경에서만 활성화
        // if (TEST_MODE && (!ageRange || !gender)) {
        //     console.log("⚠️ [강제 테스트 모드] 카카오 데이터가 없어 강제로 값 설정");
        //     ageRange = ageRange || "20대"; // 강제 주입
        //     gender = gender || "M"; // 강제 주입
        // }

        // 🟢 [Debug]: 변환된 데이터 로깅
        console.log("=== 변환된 데이터 ===");
        console.log("ageRange:", ageRange);
        console.log("gender:", gender);
        console.log("email:", email);

        // 🟢 이벤트 쿠키 지급 로직 (KST 기준)
        const now = new Date();
        const utc = now.getTime() + now.getTimezoneOffset() * 60000;
        const kstNow = new Date(utc + 9 * 60 * 60 * 1000);
        const eventEndDate = new Date("2026-01-31T23:59:59+09:00");
        const initialCoupons = kstNow <= eventEndDate ? 2 : 1; // 🟢 1월 31일 이전: 2개, 이후: 1개

        // 🟢 [2026-01-21] 이메일 중복 체크를 포함한 통합 로그인 로직 (계정 통합 지원)
        const result = await (prisma as any).$transaction(async (tx: any) => {
            // 1. 소셜 ID로 먼저 확인
            let user = await tx.user.findFirst({
                where: { socialId: socialId, provider: "kakao" },
                select: {
                    id: true,
                    email: true,
                    username: true,
                    profileImageUrl: true,
                    couponCount: true,
                    ageRange: true,
                    gender: true,
                },
            });

            // 2. 소셜 ID가 없다면 이메일로 기존 유저(애플 등)가 있는지 확인 (계정 통합)
            if (!user && email) {
                user = await tx.user.findUnique({
                    where: { email },
                    select: {
                        id: true,
                        email: true,
                        username: true,
                        profileImageUrl: true,
                        couponCount: true,
                        ageRange: true,
                        gender: true,
                    },
                });
            }

            if (user) {
                // 🟢 [2026-01-21] 디버깅: 기존 유저 업데이트 직전 값 확인
                console.log("=== 기존 유저 업데이트 직전 값 확인 ===");
                console.log("ageRange:", ageRange, "(기존:", user.ageRange, ")");
                console.log("gender:", gender, "(기존:", user.gender, ")");
                console.log("email:", email, "(기존:", user.email, ")");
                console.log("nickname:", nickname, "(기존:", user.username, ")");

                // 🟢 기존 유저 업데이트 (정보 보완 및 계정 통합)
                const updateData: any = {
                    username: nickname || user.username,
                    profileImageUrl: profileImageUrl || user.profileImageUrl,
                    // 카카오 계정 연결 (다른 소셜 로그인으로 가입한 경우)
                    socialId: socialId,
                    provider: "kakao",
                };

                // 이메일이 비어있을 경우에만 업데이트
                if (email && !user.email) updateData.email = email;

                // 연령대와 성별이 비어있을 경우에만 업데이트
                if (ageRange && (!user.ageRange || user.ageRange.trim() === "")) updateData.ageRange = ageRange;
                if (gender && (!user.gender || user.gender.trim() === "")) updateData.gender = gender;

                console.log("=== 업데이트할 데이터 ===", updateData);

                const updatedUser = await tx.user.update({
                    where: { id: user.id },
                    data: updateData,
                    select: {
                        id: true,
                        email: true,
                        username: true,
                        profileImageUrl: true,
                        couponCount: true,
                        ageRange: true,
                        gender: true,
                    },
                });

                // 🟢 신규 가입인 경우 보상 로그 생성 (기존 유저는 보상 중복 지급 방지)
                const existingReward = await tx.userReward.findFirst({
                    where: {
                        userId: updatedUser.id,
                        type: "signup",
                    },
                });

                if (!existingReward) {
                    // 기존 유저지만 보상이 없으면 생성 (계정 통합 시나리오)
                    await tx.userReward.create({
                        data: {
                            userId: updatedUser.id,
                            type: "signup",
                            amount: initialCoupons,
                            unit: "coupon",
                        },
                    });
                    // 쿠폰 지급
                    await tx.user.update({
                        where: { id: updatedUser.id },
                        data: { couponCount: { increment: initialCoupons } },
                    });
                    updatedUser.couponCount = (updatedUser.couponCount || 0) + initialCoupons;
                    return { user: updatedUser, isNew: true };
                }

                return { user: updatedUser, isNew: false };
            } else {
                // 🟢 [2026-01-21] 디버깅: DB 저장 직전 값 확인
                console.log("=== DB 저장 직전 값 확인 ===");
                console.log("ageRange:", ageRange, "(타입:", typeof ageRange, ")");
                console.log("gender:", gender, "(타입:", typeof gender, ")");
                console.log("email:", email);
                console.log("nickname:", nickname);
                console.log("profileImageUrl:", profileImageUrl);
                console.log("socialId:", socialId);

                // 🟢 [2026-01-21] 강제 테스트: 값이 없을 경우 강제 주입 (테스트용)
                // 🔴 주의: 이 코드는 테스트 후 반드시 제거하거나 주석 처리하세요
                const FORCE_TEST = false; // true로 변경하면 강제 테스트 모드 활성화
                const testAgeRange = FORCE_TEST ? ageRange || "20대" : ageRange;
                const testGender = FORCE_TEST ? gender || "M" : gender;
                if (FORCE_TEST && (!ageRange || !gender)) {
                    console.log("⚠️ [강제 테스트 모드] ageRange:", testAgeRange, "gender:", testGender);
                }

                // 🟢 진짜 신규 유저 가입
                const newUser = await tx.user.create({
                    data: {
                        username: nickname || `user_${socialId}`,
                        email,
                        profileImageUrl,
                        socialId,
                        provider: "kakao",
                        ageRange: testAgeRange, // 🟢 강제 테스트 모드 사용
                        gender: testGender, // 🟢 강제 테스트 모드 사용
                        couponCount: initialCoupons,
                    },
                    select: {
                        id: true,
                        email: true,
                        username: true,
                        profileImageUrl: true,
                        couponCount: true,
                        ageRange: true,
                        gender: true,
                    },
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
                return { user: newUser, isNew: true };
            }
        });

        const user = result.user;
        const isNewUser = result.isNew;

        const token = jwt.sign({ userId: user.id, name: user.username }, JWT_SECRET, { expiresIn: "7d" });
        // 🟢 [2026-01-21] 응답 payload에 사용자 데이터 추가 (ageRange, gender 포함)
        const message = isNewUser
            ? "카카오 회원가입이 완료되었습니다. 쿠폰 2개가 지급되었습니다."
            : "카카오 로그인이 완료되었습니다.";
        const res = NextResponse.json({
            success: true,
            message,
            user: {
                id: user.id,
                email: user.email,
                name: user.username,
                nickname: user.username,
                profileImageUrl: user.profileImageUrl || null,
                coins: user.couponCount ?? 0,
                ageRange: user.ageRange || null, // 🟢 클라이언트 전달
                gender: user.gender || null, // 🟢 클라이언트 전달
            },
            newUser: isNewUser,
            couponsAwarded: isNewUser ? initialCoupons : 0,
        });

        // 🟢 보안 쿠키 설정 (LocalStorage 취약점 해결)
        res.cookies.set("auth", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
        });

        return res;
    } catch (err) {
        // 🟢 [2026-01-21] 에러 로깅 강화: 서버 내부 에러가 조용히 넘어가지 않도록
        console.error("🔥 [카카오 로그인 API] 서버 오류 상세:");
        console.error("에러 타입:", err instanceof Error ? err.constructor.name : typeof err);
        console.error("에러 메시지:", err instanceof Error ? err.message : String(err));
        console.error("에러 스택:", err instanceof Error ? err.stack : "스택 정보 없음");
        console.error("전체 에러 객체:", err);

        return NextResponse.json(
            {
                error: "카카오 로그인 중 서버 오류가 발생했습니다.",
                details: err instanceof Error ? err.message : "알 수 없는 오류",
            },
            { status: 500 }
        );
    }
}
