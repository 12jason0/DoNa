import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";
// ❌ export const revalidate = 300; // 캐싱 제거 (실시간 반영을 위해)

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
                couponCount: true,
                subscriptionTier: true, // 🟢 camelCase 확인
                hasSeenConsentModal: true,
            },
        });
        if (!user) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

        const convertToHttps = (url: string | null | undefined): string | null => {
            if (!url) return null;
            return url.startsWith("http://") ? url.replace(/^http:\/\//, "https://") : url;
        };

        const profileImageUrl = convertToHttps(user.profileImageUrl);

        // 프론트엔드 ProfileTab에서 필드명 혼선이 없도록 두 가지 케이스 모두 전달
        const responseData = {
            id: user.id,
            email: user.email,
            name: user.username,
            nickname: user.username,
            profileImage: profileImageUrl,
            createdAt: user.createdAt,
            mbti: user.mbti,
            age: user.age,
            couponCount: user.couponCount ?? 0,
            subscriptionTier: user.subscriptionTier, // camelCase
            subscription_tier: user.subscriptionTier, // 🟢 snake_case 추가 (DB 대응)
            hasSeenConsentModal: user.hasSeenConsentModal ?? false,
            user: {
                ...user,
                name: user.username,
                profileImage: profileImageUrl,
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

        const data: any = {};
        if (name !== undefined) data.username = name;
        if (email !== undefined) data.email = email || null;
        if (mbti !== undefined) data.mbti = mbti || null;
        if (age !== undefined) data.age = age;

        const updated = await prisma.user.update({ where: { id: userId }, data });

        return NextResponse.json({
            success: true,
            user: {
                id: updated.id,
                email: updated.email,
                name: updated.username,
                mbti: updated.mbti,
                age: updated.age,
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
