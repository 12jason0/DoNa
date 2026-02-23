import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import prisma from "@/lib/db";
import { getJwtSecret } from "@/lib/auth";
import { getSafeRedirectPath } from "@/lib/redirect";

export const dynamic = "force-dynamic";

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
    try {
        const { code, next } = await request.json();
        const JWT_SECRET = getJwtSecret();

        // 🟢 [2026-01-21] Redirect URI 불일치 해결: 실제 요청 호스트 사용
        // 0.0.0.0을 localhost로 변경하지 않고 실제 호스트 주소 사용
        const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || request.nextUrl.host;
        const protocol =
            request.headers.get("x-forwarded-proto") || (request.nextUrl.protocol === "https:" ? "https" : "http");
        const origin = `${protocol}://${host}`;
        const redirectUri = `${origin}/api/auth/kakao/callback`;

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
                        ageRange: true,
                        gender: true,
                    },
                });
            }

            if (user) {
                // 🟢 기존 유저 업데이트 (정보 보완 및 계정 통합)
                const updateData: any = {
                    username: nickname || user.username,
                    // 🟢 [Fix]: 카카오에서 프로필 이미지가 있으면 항상 업데이트 (최신 프로필 반영)
                    profileImageUrl: profileImageUrl ? profileImageUrl : user.profileImageUrl,
                    // 카카오 계정 연결 (다른 소셜 로그인으로 가입한 경우)
                    socialId: socialId,
                    provider: "kakao",
                };

                // 이메일이 비어있을 경우에만 업데이트
                if (email && !user.email) updateData.email = email;

                // 연령대와 성별이 비어있을 경우에만 업데이트
                if (ageRange && (!user.ageRange || user.ageRange.trim() === "")) updateData.ageRange = ageRange;
                if (gender && (!user.gender || user.gender.trim() === "")) updateData.gender = gender;

                const updatedUser = await tx.user.update({
                    where: { id: user.id },
                    data: updateData,
                    select: {
                        id: true,
                        email: true,
                        username: true,
                        profileImageUrl: true,
                        ageRange: true,
                        gender: true,
                    },
                });

                return { user: updatedUser, isNew: false };
            } else {
                // 🟢 신규 유저 가입: 카카오에서 수신한 실제 데이터 사용
                const newUser = await tx.user.create({
                    data: {
                        username: nickname || `user_${socialId}`,
                        email,
                        profileImageUrl,
                        socialId,
                        provider: "kakao",
                        ageRange: ageRange,
                        gender: gender,
                    },
                    select: {
                        id: true,
                        email: true,
                        username: true,
                        profileImageUrl: true,
                        ageRange: true,
                        gender: true,
                    },
                });

                return { user: newUser, isNew: true };
            }
        });

        const user = result.user;
        const isNewUser: boolean = result.isNew ?? false;

        const token = jwt.sign({ userId: user.id, name: user.username }, JWT_SECRET, { expiresIn: "365d" });
        // 🟢 [2026-01-21] 응답 payload에 사용자 데이터 추가 (ageRange, gender 포함)
        const message = isNewUser
            ? "카카오 회원가입이 완료되었습니다."
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
                ageRange: user.ageRange || null,
                gender: user.gender || null,
            },
            newUser: isNewUser,
        });

        // 🟢 [Fix]: 이전 세션 파편 완전 제거 (로컬/카카오 로그인 통합)
        res.cookies.delete("auth");
        res.cookies.delete("authorization");
        
        // 🟢 보안 쿠키 설정 (LocalStorage 취약점 해결)
        res.cookies.set("auth", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 365,
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
