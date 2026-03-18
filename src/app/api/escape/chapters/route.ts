import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// 텍스트 내 리터럴 "\n"을 실제 줄바꿈으로 변환 (한 줄 띄기 = 두 번 줄바꿈)
const normalizeText = (v: unknown): string => {
    return String(v ?? "").replace(/\\n/g, "\n\n");
};

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const storyIdStr = searchParams.get("storyId");
        const storyId = Number(storyIdStr);

        if (!Number.isFinite(storyId) || storyId <= 0) {
            return NextResponse.json({ error: "Invalid storyId" }, { status: 400 });
        }

        // ✅ storyId 기반으로 PlaceOption 및 연결된 미션/스토리 불러오기
        const placeOptions = await prisma.placeOption.findMany({
            where: { storyId },
            include: {
                // 👇 여기가 핵심입니다!
                missions: true, // (1) 장소에 속한 전체 미션 목록 가져오기 (필수)

                stories: {
                    // (2) 스토리 가져올 때 정렬해서 가져오기 (선택이지만 추천)
                    orderBy: { order: "asc" },
                    // 필요하다면 여기서 스토리별 연결된 미션 정보도 가져올 수 있음
                    // include: { mission: true }
                },

                placeDialogues: true,
            },
            orderBy: { id: "asc" },
        });

        // 스토리 레벨 인트로(장소 없이 storyId만 연결) 수집
        const storyIntro = await prisma.placeDialogue.findMany({
            where: { storyId, type: "intro" },
            orderBy: { order: "asc" },
        });

        // ✅ 카테고리 정규화 + 그룹화
        const normalize = (v: unknown): string => {
            const s = String(v || "")
                .toLowerCase()
                .replace(/\s+/g, "");
            if (["cafe", "카페", "카페투어"].includes(s)) return "cafe";
            if (["lunch", "점심", "restaurant", "food", "맛집", "음식점", "식사", "레스토랑"].includes(s))
                return "lunch";
            if (["date", "walk", "산책", "데이트"].includes(s)) return "date";
            if (["dinner", "다이닝"].includes(s)) return "dinner";
            if (["night", "nightview", "야경"].includes(s)) return "nightview";
            return s || "misc";
        };
        const categoryOrder = ["lunch", "cafe", "date", "dinner", "nightview"]; // 필요 시 확장
        const grouped = new Map<string, typeof placeOptions>();
        for (const p of placeOptions) {
            const key = normalize((p as any).category);
            if (!grouped.has(key)) grouped.set(key, [] as any);
            (grouped.get(key) as any).push(p);
        }

        const sortedCategories = Array.from(grouped.keys()).sort((a, b) => {
            const ia = categoryOrder.indexOf(a);
            const ib = categoryOrder.indexOf(b);
            if (ia === -1 && ib === -1) return a.localeCompare(b);
            if (ia === -1) return 1;
            if (ib === -1) return -1;
            return ia - ib;
        });

        const normalizedChapters = sortedCategories.map((cat, idx) => {
            const list = grouped.get(cat)!;
            const representative = list[0];
            const firstMission =
                Array.isArray(representative.missions) && representative.missions.length > 0
                    ? representative.missions[0]
                    : null;
            const missionTypeUpper = (() => {
                if (!firstMission) return undefined as unknown as string;
                const t = String(firstMission.missionType || "").toLowerCase();
                if (t === "photo") return "PHOTO";
                if (t === "puzzle" || t === "quiz") return "PUZZLE_ANSWER";
                return t.toUpperCase();
            })();

            const missionPayloadRaw = firstMission?.missionPayload as unknown;
            const missionPayloadObj =
                missionPayloadRaw && typeof missionPayloadRaw === "object" && !Array.isArray(missionPayloadRaw)
                    ? (missionPayloadRaw as Record<string, any>)
                    : ({} as Record<string, any>);

            const storyText = (representative.stories || [])
                .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
                .map((s: any) => normalizeText(s.dialogue || s.narration || ""))
                .filter(Boolean)
                .join("\n\n");

            // 대표 장소의 인트로 대사 (장소 단위)
            const introDialogues = ((representative as any).placeDialogues || [])
                .filter((d: any) => String(d?.type || "").toLowerCase() === "intro")
                .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
                .map((d: any) => ({
                    speaker: d.speaker || "",
                    role: d.role || "",
                    text: normalizeText(d.message || ""),
                }))
                .filter((d: any) => d.text);

            const base = {
                id: representative.id, // 카테고리 대표 id
                story_id: storyId,
                chapter_number: idx + 1,
                // 챕터 제목은 카테고리가 아닌 대표 장소의 서명(signature) 또는 이름을 사용
                title: (representative as any).signature || representative.name || cat,
                // 위치명은 카테고리 대신 대표 장소명 우선 사용
                location_name: representative.name || cat,
                address: representative.address ?? null,
                latitude: representative.latitude,
                longitude: representative.longitude,
                mission_type: missionTypeUpper,
                mission_payload: {
                    ...missionPayloadObj,
                    question: firstMission?.question ?? missionPayloadObj.question,
                    hint: firstMission?.hint ?? missionPayloadObj.hint,
                    description: firstMission?.description ?? missionPayloadObj.description,
                },
                imageUrl: representative.imageUrl,
                placeOptions: list.map((p) => {
                    const missions = Array.isArray(p.missions) ? p.missions : [];
                    // 호환용(첫 미션)
                    const fm = missions.length > 0 ? missions[0] : null;
                    const mpRaw = fm?.missionPayload as unknown;
                    const mp =
                        mpRaw && typeof mpRaw === "object" && !Array.isArray(mpRaw)
                            ? (mpRaw as Record<string, any>)
                            : {};
                    return {
                        id: p.id,
                        name: p.name,
                        category: p.category, // 프론트 필터링 호환을 위해 카테고리도 포함
                        // ✨ [수정] theme 필드 추가! (이게 없어서 안 나왔던 것)
                        theme: (p as any).theme || null,
                        address: p.address ?? undefined,
                        latitude: p.latitude ?? undefined,
                        longitude: p.longitude ?? undefined,
                        description: p.description ?? undefined,
                        imageUrl: p.imageUrl ?? undefined,
                        signature: (p as any).signature ?? undefined,
                        stories: Array.isArray((p as any).stories)
                            ? (p as any).stories
                                  .slice()
                                  .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
                                  .map((s: any) => ({
                                      id: s.id,
                                      order: s.order,
                                      speaker: s.speaker,
                                      dialogue: normalizeText(s.dialogue),
                                      narration: normalizeText(s.narration),

                                      // ✅ [핵심 추가] 이 줄이 없으면 프론트엔드에서 미션 ID를 못 받습니다!
                                      // DB에 값이 있으면(종로) 숫자가 들어가고, 없으면(홍대) null이 됩니다.
                                      missionId: s.missionId ?? null,
                                  }))
                            : [],
                        missions: missions.map((m: any) => {
                            const raw = m?.missionPayload as unknown;
                            const obj =
                                raw && typeof raw === "object" && !Array.isArray(raw)
                                    ? (raw as Record<string, any>)
                                    : {};
                            return {
                                id: m.id,
                                missionNumber: (m as any).missionNumber ?? null,
                                missionType: m.missionType,
                                missionPayload: {
                                    ...obj,
                                    question: m.question ?? obj.question,
                                    hint: m.hint ?? obj.hint,
                                    description: m.description ?? obj.description,
                                    // ✅ 정답도 내려보내 텍스트/퀴즈 검증 가능
                                    answer: (m as any).answer ?? obj.answer,
                                },
                            };
                        }),
                        // 구버전 호환 필드(첫 미션)
                        missionId: fm?.id,
                        missionType: fm?.missionType ?? undefined,
                        missionPayload: {
                            ...mp,
                            question: fm?.question ?? mp.question,
                            hint: fm?.hint ?? mp.hint,
                            description: fm?.description ?? mp.description,
                            answer: (fm as any)?.answer ?? mp.answer,
                        },
                    };
                }),
            } as any;

            // 스토리 레벨 인트로(1챕터에만 적용) 우선, 없으면 장소 인트로, 그래도 없으면 PlaceStory 결합 텍스트
            const storyIntroMessages = (storyIntro || [])
                .filter((d: any) => !d.placeId && String(d?.type || "").toLowerCase() === "intro")
                .map((d: any) => ({
                    speaker: d.speaker || "",
                    role: d.role || "",
                    text: normalizeText(d.message || ""),
                }))
                .filter((d: any) => d.text);

            const story_text =
                idx === 0 && storyIntroMessages.length > 0
                    ? storyIntroMessages
                    : introDialogues.length > 0
                    ? introDialogues
                    : storyText;

            return { ...base, story_text };
        });

        return NextResponse.json(normalizedChapters, {
            headers: {
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
            captureApiError(error);
        console.error("Error in /api/escape/chapters:", error);
        return NextResponse.json({ error: "Failed to fetch chapters" }, { status: 500 });
    }
}
