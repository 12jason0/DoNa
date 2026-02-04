import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_HISTORY = 10;

/** GET: 현재 사용자의 검색 기록 조회 (최근순, 최대 10건) + isSearchHistoryEnabled */
export async function GET(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        if (!userId) {
            return NextResponse.json({ list: [], isSearchHistoryEnabled: true }, { status: 200 });
        }

        const [list, user] = await Promise.all([
            prisma.searchHistory.findMany({
                where: { userId },
                orderBy: { createdAt: "desc" },
                take: MAX_HISTORY,
                select: { id: true, keyword: true, createdAt: true },
            }),
            prisma.user.findUnique({
                where: { id: userId },
                select: { isSearchHistoryEnabled: true },
            }),
        ]);

        return NextResponse.json({
            list,
            isSearchHistoryEnabled: user?.isSearchHistoryEnabled ?? true,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

/** POST: 검색 키워드 저장 (isSearchHistoryEnabled일 때만) */
export async function POST(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        if (!userId) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }

        const body = await request.json();
        const keyword = typeof body?.keyword === "string" ? body.keyword.trim() : "";

        if (!keyword) {
            return NextResponse.json({ error: "keyword가 필요합니다." }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { isSearchHistoryEnabled: true },
        });

        if (!user?.isSearchHistoryEnabled) {
            return NextResponse.json({ saved: false, reason: "검색 기록이 비활성화되어 있습니다." }, { status: 200 });
        }

        // 같은 키워드가 있으면 삭제 후 새로 추가 → 맨 앞으로 이동 (중복 생성 방지)
        await prisma.searchHistory.deleteMany({
            where: { userId, keyword },
        });

        await prisma.searchHistory.create({
            data: { userId, keyword },
        });

        // 최근 10개만 유지: 초과분 삭제
        const all = await prisma.searchHistory.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            select: { id: true },
        });
        if (all.length > MAX_HISTORY) {
            const idsToDelete = all.slice(MAX_HISTORY).map((r) => r.id);
            await prisma.searchHistory.deleteMany({
                where: { id: { in: idsToDelete }, userId },
            });
        }

        return NextResponse.json({ saved: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

/** DELETE: 검색 기록 1건 삭제 (id 있을 때) / 전체 삭제 (id 없을 때, 본인 것만) */
export async function DELETE(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        if (!userId) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }

        const id = request.nextUrl.searchParams.get("id");
        if (id && typeof id === "string" && id.trim() !== "") {
            await prisma.searchHistory.deleteMany({
                where: { id: id.trim(), userId },
            });
        } else {
            await prisma.searchHistory.deleteMany({
                where: { userId },
            });
        }

        return NextResponse.json({ deleted: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

/** PATCH: 검색 기록 저장 여부 설정 (isSearchHistoryEnabled) */
export async function PATCH(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        if (!userId) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }

        const body = await request.json().catch(() => null);
        if (!body) return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });

        const enabled = typeof body.isSearchHistoryEnabled === "boolean" ? body.isSearchHistoryEnabled : undefined;
        if (enabled === undefined) {
            return NextResponse.json({ error: "isSearchHistoryEnabled(boolean)가 필요합니다." }, { status: 400 });
        }

        await prisma.user.update({
            where: { id: userId },
            data: { isSearchHistoryEnabled: enabled },
        });

        return NextResponse.json({ success: true, isSearchHistoryEnabled: enabled });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "An error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
