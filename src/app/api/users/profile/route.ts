import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";
import { getS3StaticUrl } from "@/lib/s3Static";
import { calculateEffectiveSubscription } from "@/lib/subscription";
import { isAndroidAppRequest } from "@/lib/reviewBypass";

export const dynamic = "force-dynamic"; // 🟢 실시간 인증 정보를 위해 필수
export const revalidate = 0; // 🟢 캐시 완전 비활성화

export async function GET(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                username: true,
                profileImageUrl: true,
                createdAt: true,
                mbti: true,
                age: true,
                ageRange: true,
                gender: true,
                couponCount: true,
                subscriptionTier: true, // 🟢 camelCase 확인
                subscriptionExpiresAt: true, // 🟢 만료일 조회
                hasSeenConsentModal: true,
            },
        });
        if (!user) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

        // 🟢 무료 BASIC 멤버십 계산 (2월 22일 이전 가입자에게 3월 21일까지 무료 BASIC 제공)
        const effectiveSubscription = calculateEffectiveSubscription(
            user.subscriptionTier,
            user.createdAt,
            user.subscriptionExpiresAt
        );
        let effectiveTier = effectiveSubscription.tier;
        if (isAndroidAppRequest(request.headers)) effectiveTier = "PREMIUM";
        const effectiveExpiresAt = effectiveSubscription.expiresAt;

        const convertToHttps = (url: string | null | undefined): string | null => {
            if (!url) return null;
            return url.startsWith("http://") ? url.replace(/^http:\/\//, "https://") : url;
        };

        // 🟢 프로필 이미지가 없으면 기본 이미지 사용 (로컬 로그인과 동일하게 처리)
        const DEFAULT_PROFILE_IMG = getS3StaticUrl("profileLogo.png");
        const profileImageUrl = convertToHttps(user.profileImageUrl) || DEFAULT_PROFILE_IMG;

        // 🟢 username이 user_로 시작하면 임시 이름이므로 이메일 앞부분 사용
        let displayName = user.username;
        if (!displayName || displayName.trim() === "" || displayName.trim().startsWith("user_")) {
            displayName = user.email && user.email.includes("@") ? user.email.split("@")[0] : user.username || "";
        }

        // 프론트엔드 ProfileTab에서 필드명 혼선이 없도록 두 가지 케이스 모두 전달
        // 🟢 Redundancy 강화: 외부/내부 어디서든 이름을 가져올 수 있도록 nickname 필드 명시적 추가
        const responseData = {
            id: user.id,
            email: user.email,
            name: displayName, // 🟢 외부 name (임시 이름이면 이메일 앞부분)
            nickname: displayName, // 🟢 외부 nickname
            profileImage: profileImageUrl,
            profileImageUrl: profileImageUrl, // 🟢 카카오 프로필 이미지 표시를 위해 추가
            createdAt: user.createdAt,
            mbti: user.mbti,
            age: user.age,
            ageRange: user.ageRange,
            gender: user.gender,
            couponCount: user.couponCount ?? 0,
            subscriptionTier: effectiveTier, // 🟢 계산된 등급 반환
            subscription_tier: effectiveTier, // 🟢 snake_case 추가 (DB 대응)
            subscriptionExpiresAt: effectiveExpiresAt ? effectiveExpiresAt.toISOString() : null, // 🟢 계산된 만료일 반환
            hasSeenConsentModal: user.hasSeenConsentModal ?? false,
            user: {
                ...user,
                name: displayName, // 🟢 내부 user.name (임시 이름이면 이메일 앞부분)
                nickname: displayName, // 🟢 내부 user.nickname 추가 (핵심!)
                profileImage: profileImageUrl,
                profileImageUrl: profileImageUrl, // 🟢 카카오 프로필 이미지 표시를 위해 추가
                subscriptionTier: effectiveTier, // 🟢 계산된 등급 반환
                subscriptionExpiresAt: effectiveExpiresAt ? effectiveExpiresAt.toISOString() : null, // 🟢 계산된 만료일 반환
            },
        };

        return NextResponse.json(responseData);
    } catch (e) {
        return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

        const body = await request.json().catch(() => null);
        if (!body) return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });

        const name = typeof body.name === "string" ? body.name.trim() : undefined;
        const email = typeof body.email === "string" ? body.email.trim() : undefined;
        const mbti = typeof body.mbti === "string" ? body.mbti.trim() : undefined;
        const age =
            body.age !== undefined && body.age !== null && String(body.age).trim() !== ""
                ? Number.parseInt(String(body.age), 10)
                : null;
        const ageRange = typeof body.ageRange === "string" ? body.ageRange.trim() : undefined;
        const gender = typeof body.gender === "string" ? body.gender.trim() : undefined;

        const data: any = {};
        if (name !== undefined) data.username = name;
        if (email !== undefined) data.email = email || null;
        if (mbti !== undefined) data.mbti = mbti || null;
        if (age !== undefined) data.age = age;
        if (ageRange !== undefined) {
            // 연령대 검증
            const validAgeRanges = ["10대", "20대", "30대", "40대", "50대 이상"];
            data.ageRange = validAgeRanges.includes(ageRange) ? ageRange : null;
        }
        if (gender !== undefined) {
            // 성별 검증
            data.gender = gender === "M" || gender === "F" ? gender : null;
        }

        const updated = await prisma.user.update({ where: { id: userId }, data });

        return NextResponse.json({
            success: true,
            user: {
                id: updated.id,
                email: updated.email,
                name: updated.username,
                mbti: updated.mbti,
                age: updated.age,
                ageRange: updated.ageRange,
                gender: updated.gender,
                createdAt: updated.createdAt,
                subscriptionTier: updated.subscriptionTier, // 🟢 수정 후에도 등급이 유지되도록 추가
                subscription_tier: updated.subscriptionTier, // 🟢 추가
                profileImage: updated.profileImageUrl
                    ? updated.profileImageUrl.replace(/^http:\/\//, "https://")
                    : null,
            },
        });
    } catch (e: any) {
        return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
    }
}
