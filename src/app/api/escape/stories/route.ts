import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getUserIdFromRequest, verifyAdminJwt } from "@/lib/auth";
import { sendPushNotificationToAll } from "@/lib/push-notifications";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

// 중복 선언을 피하기 위해 함수를 최상단에 한번만 정의합니다.
const normalizeLevel = (v: unknown): number => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (v === null || v === undefined) return 0;
    let str = String(v).trim();
    // 전각 숫자(０-９) → 반각
    str = str.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
    const n = parseInt(str, 10);
    return Number.isFinite(n) ? n : 0;
};

// story 객체를 프론트엔드 형식에 맞게 변환하는 함수입니다.
const normalizeStory = (s: any) => {
    // ✅ [수정됨] Prisma의 camelCase 변환 규칙(epilogue_text -> epilogueText)을 고려합니다.
    const epilogueFromField = s.epilogueText ?? s.epilogue_text;

    const safeEpilogue = (() => {
        // 1. 데이터베이스의 epilogue_text 컬럼 값을 최우선으로 사용합니다.
        if (epilogueFromField != null && epilogueFromField !== "") {
            return epilogueFromField;
        }
        // 2. 만약 위 값이 비어있다면, JSON 필드에서 한번 더 찾아봅니다 (폴백 로직).
        try {
            const storyJson = s.story_json;
            if (storyJson && typeof storyJson === "object") {
                return storyJson.epilogue_text ?? storyJson.epilogue ?? "";
            }
        } catch {}
        // 3. 모든 경우에 값이 없으면 빈 문자열을 반환합니다.
        return "";
    })();

    return {
        id: s.id,
        title: s.title,
        synopsis: s.synopsis ?? "",
        epilogue_text: safeEpilogue,
        region: s.region ?? null,
        price: s.price != null ? String(s.price) : null,
        imageUrl: s.imageUrl ?? null,
        reward_badge_id: s.reward_badge_id ?? null,
        level: normalizeLevel(s.level),
        is_active: s.is_active,
        created_at: s.created_at,
        updated_at: s.updated_at,
        badge: s.reward_badge
            ? {
                  id: s.reward_badge.id,
                  name: s.reward_badge.name,
                  description: s.reward_badge.description ?? "",
                  image_url: s.reward_badge.image_url ?? undefined,
              }
            : null,
    };
};

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const storyId = searchParams.get("storyId");

        if (storyId) {
            const idNum = Number(storyId);
            if (!Number.isFinite(idNum)) {
                return NextResponse.json({ error: "Invalid storyId" }, { status: 400 });
            }

            // Prisma 쿼리는 기본적으로 모든 스칼라 필드를 가져오므로 epilogue_text도 포함됩니다.
            const story = await prisma.story.findUnique({
                where: { id: idNum },
                include: { reward_badge: true },
            });

            if (!story || !story.is_active) {
                return NextResponse.json({ error: "Story not found" }, { status: 404 });
            }

            const normalized = normalizeStory(story);

            return NextResponse.json(normalized, {
                headers: {
                    "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
                },
            });
        }

        const stories = await prisma.story.findMany({
            where: { is_active: true },
            orderBy: [{ created_at: "desc" }, { id: "desc" }],
            include: {
                reward_badge: true,
            },
        });

        // 여러 스토리를 변환할 때도 동일한 함수를 사용합니다.
        const normalizedStories = stories.map(normalizeStory);

        return NextResponse.json(normalizedStories, {
            headers: {
                "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
            },
        });
    } catch (error) {

            captureApiError(error);
        console.error("Failed to fetch stories:", error);
        return NextResponse.json({ error: "Failed to fetch stories" }, { status: 500 });
    }
}

// 새 스토리 생성
export async function POST(request: NextRequest) {
    try {
        if (!verifyAdminJwt(request)) {
            return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
        }

        const body = await request.json().catch(() => ({}));
        const {
            title,
            synopsis,
            region,
            estimated_duration_min,
            price,
            reward_badge_id,
            imageUrl,
            level,
            epilogue_text,
            stationName,
            stationLat,
            stationLng,
            scenario,
        } = body || {};

        if (!title || typeof title !== "string") {
            return NextResponse.json({ error: "스토리 제목은 필수입니다." }, { status: 400 });
        }

        const created = await prisma.story.create({
            data: {
                title,
                synopsis: synopsis ?? null,
                region: region ?? null,
                estimated_duration_min: Number.isFinite(Number(estimated_duration_min))
                    ? Number(estimated_duration_min)
                    : null,
                price: price != null ? String(price) : null,
                reward_badge_id: Number.isFinite(Number(reward_badge_id)) ? Number(reward_badge_id) : null,
                imageUrl: imageUrl ?? null,
                level: Number.isFinite(Number(level)) ? Number(level) : 1,
                epilogue_text: epilogue_text ?? null,
                stationName: stationName ?? null,
                stationLat: Number.isFinite(Number(stationLat)) ? Number(stationLat) : null,
                stationLng: Number.isFinite(Number(stationLng)) ? Number(stationLng) : null,
                scenario: scenario ?? null,
                is_active: true,
            },
            select: {
                id: true,
                title: true,
                synopsis: true,
                region: true,
                estimated_duration_min: true,
                price: true,
                reward_badge_id: true,
                imageUrl: true,
                level: true,
                epilogue_text: true,
                created_at: true,
            },
        });

        // 🔔 스토리 생성 푸시 알림 전송 (실패해도 생성은 성공 처리)
        try {
            await sendPushNotificationToAll("새로운 스토리가 열렸어요! 🎉", `${created.title} - 바로 확인해보세요`, {
                screen: "escape",
                storyId: created.id,
            });
            console.log("스토리 푸시 전송 성공:", created.title);
        } catch (err) {

                captureApiError(err);
            console.error("스토리 푸시 전송 실패:", err);
        }

        return NextResponse.json({ success: true, story: created }, { status: 201 });
    } catch (error) {

            captureApiError(error);
        console.error("스토리 생성 실패:", error);
        return NextResponse.json({ error: "스토리 생성 실패" }, { status: 500 });
    }
}

// 스토리 수정 (관리자)
export async function PUT(request: NextRequest) {
    try {
        if (!verifyAdminJwt(request)) {
            return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
        }
        const body = await request.json().catch(() => ({}));
        const { id, ...patch } = body || {};
        const storyId = Number(id);
        if (!Number.isFinite(storyId)) {
            return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
        }
        const data: any = {};
        if (patch.title !== undefined) data.title = String(patch.title);
        if (patch.synopsis !== undefined) data.synopsis = patch.synopsis ?? null;
        if (patch.region !== undefined) data.region = patch.region ?? null;
        if (patch.estimated_duration_min !== undefined)
            data.estimated_duration_min = Number.isFinite(Number(patch.estimated_duration_min))
                ? Number(patch.estimated_duration_min)
                : null;
        if (patch.price !== undefined) data.price = patch.price != null ? String(patch.price) : null;
        if (patch.reward_badge_id !== undefined)
            data.reward_badge_id = Number.isFinite(Number(patch.reward_badge_id))
                ? Number(patch.reward_badge_id)
                : null;
        if (patch.imageUrl !== undefined) data.imageUrl = patch.imageUrl ?? null;
        if (patch.level !== undefined) data.level = Number.isFinite(Number(patch.level)) ? Number(patch.level) : 1;
        if (patch.epilogue_text !== undefined) data.epilogue_text = patch.epilogue_text ?? null;
        if (patch.stationName !== undefined) data.stationName = patch.stationName ?? null;
        if (patch.stationLat !== undefined)
            data.stationLat = Number.isFinite(Number(patch.stationLat)) ? Number(patch.stationLat) : null;
        if (patch.stationLng !== undefined)
            data.stationLng = Number.isFinite(Number(patch.stationLng)) ? Number(patch.stationLng) : null;
        if (patch.scenario !== undefined) data.scenario = patch.scenario ?? null;

        const updated = await prisma.story.update({ where: { id: storyId }, data, select: { id: true, title: true } });
        return NextResponse.json({ success: true, story: updated });
    } catch (error) {

            captureApiError(error);
        console.error("스토리 수정 실패:", error);
        return NextResponse.json({ error: "스토리 수정 실패" }, { status: 500 });
    }
}
