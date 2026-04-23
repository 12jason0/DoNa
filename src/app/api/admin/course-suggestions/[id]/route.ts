import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyAdminJwt } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";
import { sendPushToUser } from "@/lib/push";

function ensureAdmin(req: NextRequest) {
    if (!verifyAdminJwt(req)) throw new Error("ADMIN_ONLY");
}

const ALLOWED_STATUS = new Set(["PENDING", "PUBLISHED", "REJECTED"]);

const SUGGESTION_SELECT = {
    id: true,
    placeName: true,
    placeAddress: true,
    description: true,
    concept: true,
    imageUrl: true,
    status: true,
    createdAt: true,
    user: { select: { id: true, username: true, email: true } },
} as const;

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        ensureAdmin(req);
        const { id: rawId } = await params;
        const id = Number(rawId);
        if (!Number.isFinite(id) || id <= 0) {
            return NextResponse.json({ error: "유효하지 않은 제보 ID입니다." }, { status: 400 });
        }

        const body = await req.json();
        const data: Record<string, unknown> = {};

        if (typeof body?.placeAddress === "string" || body?.placeAddress === null) {
            data.placeAddress = typeof body.placeAddress === "string" ? body.placeAddress.trim() || null : null;
        }
        if (typeof body?.description === "string" || body?.description === null) {
            data.description = typeof body.description === "string" ? body.description.trim() || null : null;
        }
        if (typeof body?.concept === "string" || body?.concept === null) {
            data.concept = typeof body.concept === "string" ? body.concept.trim() || null : null;
        }
        if (typeof body?.imageUrl === "string" || body?.imageUrl === null) {
            data.imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() || null : null;
        }
        if (typeof body?.status === "string") {
            if (!ALLOWED_STATUS.has(body.status)) {
                return NextResponse.json({ error: "유효하지 않은 상태값입니다." }, { status: 400 });
            }
            data.status = body.status;
        }

        if (Object.keys(data).length === 0) {
            return NextResponse.json({ error: "수정할 값이 없습니다." }, { status: 400 });
        }

        // 승인 시 places 테이블에 draft로 장소 생성
        if (data.status === "PUBLISHED") {
            const current = await (prisma as any).courseSuggestion.findUnique({
                where: { id },
                select: {
                    id: true,
                    placeName: true,
                    placeAddress: true,
                    description: true,
                    concept: true,
                    imageUrl: true,
                },
            });

            if (!current) {
                return NextResponse.json({ error: "제보를 찾을 수 없습니다." }, { status: 404 });
            }

            await (prisma as any).place.create({
                data: {
                    name: current.placeName,
                    address: (data.placeAddress as string | null) ?? current.placeAddress ?? null,
                    description: (data.description as string | null) ?? current.description ?? null,
                    category: (data.concept as string | null) ?? current.concept ?? null,
                    imageUrl: (data.imageUrl as string | null) ?? current.imageUrl ?? null,
                    status: "draft",
                },
            });
        }

        const suggestion = await (prisma as any).courseSuggestion.update({
            where: { id },
            data,
            select: { ...SUGGESTION_SELECT, userId: true },
        });

        if (data.status === "PUBLISHED") {
            sendPushToUser(
                suggestion.userId,
                "제보하신 장소가 등록됐어요! 🎉",
                `${suggestion.placeName} 장소를 DoNa 코스로 만들고 있어요. 조금만 기다려주세요!`,
                { screen: "home", url: "/" },
            ).catch(() => {});
        }

        if (data.status === "REJECTED") {
            sendPushToUser(
                suggestion.userId,
                "장소 제보 결과 안내",
                `아쉽게도 ${suggestion.placeName} 장소는 이번에 등록이 어려웠어요. 다음에 또 좋은 장소 제보해주세요!`,
                { screen: "home", url: "/" },
            ).catch(() => {});
        }

        return NextResponse.json({ ok: true, suggestion });
    } catch (error: any) {
        captureApiError(error);
        if (error.message === "ADMIN_ONLY") {
            return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
        }
        console.error("/api/admin/course-suggestions/[id] PATCH error:", error);
        return NextResponse.json({ error: "제보 수정 실패" }, { status: 500 });
    }
}
