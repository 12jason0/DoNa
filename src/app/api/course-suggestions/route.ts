import { NextRequest, NextResponse } from "next/server";
import { captureApiError } from "@/lib/sentry";
import { resolveUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendPushToUser } from "@/lib/push";

export async function POST(req: NextRequest) {
    try {
        const userId = resolveUserId(req);
        if (!userId) {
            return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
        }

        const body = await req.json();
        const { placeName, placeAddress, description, note, concept, imageUrl } = body ?? {};

        if (!placeName || typeof placeName !== "string" || !placeName.trim()) {
            return NextResponse.json({ error: "장소 이름은 필수입니다." }, { status: 400 });
        }

        const descriptionOrNote =
            (typeof description === "string" ? description : typeof note === "string" ? note : "")
                .trim() || null;

        let suggestion: { id: number; status: unknown };
        try {
            // 최신 스키마(description) 우선 시도
            suggestion = await (prisma as any).courseSuggestion.create({
                data: {
                    userId,
                    placeName: placeName.trim(),
                    placeAddress: placeAddress?.trim() || null,
                    description: descriptionOrNote,
                    concept: concept?.trim() || null,
                    imageUrl: imageUrl?.trim() || null,
                },
            });
        } catch (firstError) {
            // 구 스키마(note) 환경 fallback
            const msg = firstError instanceof Error ? firstError.message : String(firstError);
            if (!msg.includes("Unknown argument `description`")) throw firstError;
            suggestion = await (prisma as any).courseSuggestion.create({
            data: {
                userId,
                placeName: placeName.trim(),
                placeAddress: placeAddress?.trim() || null,
                    note: descriptionOrNote,
                concept: concept?.trim() || null,
                imageUrl: imageUrl?.trim() || null,
            },
        });
        }

        // 관리자에게 새 제보 알림
        const adminUserId = Number(process.env.NEXT_PUBLIC_ADMIN_USER_ID);
        if (Number.isFinite(adminUserId) && adminUserId > 0) {
            sendPushToUser(
                adminUserId,
                "새 장소 제보",
                `${placeName.trim()} 장소가 제보되었어요.`,
                { screen: "admin_suggest", url: "/admin/suggest" },
            ).catch(() => {});
        }

        return NextResponse.json({ ok: true, suggestion: { id: suggestion.id, status: suggestion.status } });
    } catch (e) {
        captureApiError(e);
        console.error("/api/course-suggestions POST error", e);
        return NextResponse.json({ error: "서버 오류" }, { status: 500 });
    }
}
