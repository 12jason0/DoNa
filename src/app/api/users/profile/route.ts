import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

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
                subscriptionTier: true, // 구독 등급 추가
            },
        });
        if (!user) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
        return NextResponse.json({
            // 평탄 구조(호환용)
            id: user.id,
            email: user.email,
            name: user.username,
            nickname: user.username,
            profileImage: user.profileImageUrl,
            createdAt: user.createdAt,
            mbti: user.mbti,
            age: user.age,
            couponCount: user.couponCount ?? 0,
            subscriptionTier: user.subscriptionTier, // 추가
            // 중첩 구조(신규)
            user: {
                id: user.id,
                email: user.email,
                name: user.username,
                nickname: user.username,
                profileImage: user.profileImageUrl,
                createdAt: user.createdAt,
                mbti: user.mbti,
                age: user.age,
                couponCount: user.couponCount ?? 0,
                subscriptionTier: user.subscriptionTier, // 추가
            },
        });
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

        if (age !== null && (!Number.isFinite(age) || age < 0)) {
            return NextResponse.json({ error: "INVALID_AGE" }, { status: 400 });
        }

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
                profileImage: updated.profileImageUrl || null,
            },
        });
    } catch (e: any) {
        const msg = typeof e?.message === "string" ? e.message : "SERVER_ERROR";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
