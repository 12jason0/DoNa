import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getJwtSecret, getUserIdFromRequest, resolveUserId as resolveUserIdFromAuth } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";

export const dynamic = "force-dynamic";

const resolveUserId = resolveUserIdFromAuth;

export async function GET(request: NextRequest) {
    try {
        const userId = resolveUserId(request);
        if (!userId) return NextResponse.json([], { status: 200 });

        // 완료된 스토리 진행 내역 조회 (userStoryProgress 기반)
        const rows = await prisma.userStoryProgress.findMany({
            where: { user_id: userId, status: "completed" },
            orderBy: { completed_at: "desc" },
            include: {
                story: { include: { reward_badge: true } },
            },
        });

        // 하위 호환 및 다른 완료 경로: CompletedEscape 기반 완료 내역도 함께 조회
        let completedEscapes: any[] = [];
        try {
            completedEscapes = await (prisma as any).completedEscape.findMany({
                where: { userId },
                orderBy: { completedAt: "desc" },
                include: { story: { include: { reward_badge: true } } },
            });
        } catch {}

        // 스토리별 사진 업로드 수 카운트 (두 소스의 storyId를 모두 포함)
        const storyIds = Array.from(
            new Set([
                ...rows.map((r) => r.story_id),
                ...completedEscapes.map((r: any) => Number(r.storyId)).filter((n: number) => Number.isFinite(n)),
            ])
        );
        // 1) storyIds에 속하는 장소(챕터) id 목록을 먼저 구함
        //    스키마에 따라 storyChapter/PlaceOption 중 실제 사용하는 테이블을 선택하세요.
        const chaptersForStories: Array<{ id: number; storyId: number }> = await (async () => {
            try {
                // 우선 placeOption 사용 시도
                return await (prisma as any).placeOption.findMany({
                    where: { storyId: { in: storyIds } },
                    select: { id: true, storyId: true },
                });
            } catch {
                // placeOption이 없으면 storyChapter 사용
                const list = await (prisma as any).storyChapter.findMany({
                    where: { story_id: { in: storyIds } },
                    select: { id: true, story_id: true },
                });
                return (list as Array<{ id: number; story_id: number }>).map((c) => ({
                    id: c.id,
                    storyId: c.story_id,
                }));
            }
        })();

        const chapterIds = chaptersForStories.map((c) => c.id);

        // 2) 그 chapterId들에 대해 groupBy 실행 (관계 경로 필터링 제거)
        const submissions = chapterIds.length
            ? await prisma.missionSubmission.groupBy({
                  by: ["chapterId"],
                  where: { userId, photoUrl: { not: null }, chapterId: { in: chapterIds } },
                  _count: { _all: true },
              })
            : [];
        const chapterIdToCount = new Map<number, number>();
        for (const s of submissions) {
            chapterIdToCount.set(
                s.chapterId as number,
                (chapterIdToCount.get(s.chapterId as number) || 0) + (s as any)._count?._all || 0
            );
        }

        // 챕터 → 스토리 집계는 간단히 스토리 기준으로 카운트 합산
        const photoCountByStory: Record<number, number> = {};
        if (storyIds.length > 0) {
            // storyId ↔ chapterId 매핑 재사용
            for (const ch of chaptersForStories) {
                const c = chapterIdToCount.get(ch.id) || 0;
                if (!photoCountByStory[ch.storyId]) photoCountByStory[ch.storyId] = 0;
                photoCountByStory[ch.storyId] += c;
            }
        }

        const result = rows
            .filter((r) => !!r.story)
            .map((r) => {
                const s = r.story as any;
                const badge = s?.reward_badge;
                return {
                    story_id: s.id,
                    title: s.title as string,
                    synopsis: (s.synopsis as string) || "",
                    region: (s.region as string) || null,
                    imageUrl: (s.imageUrl as string) || (badge?.image_url as string) || null,
                    completedAt: r.completed_at || null,
                    badge: badge
                        ? {
                              id: badge.id as number,
                              name: badge.name as string,
                              image_url: (badge.image_url as string) || null,
                          }
                        : null,
                    photoCount: photoCountByStory[s.id] || 0,
                };
            });

        // CompletedEscape에서 온 완료 내역도 동일 포맷으로 매핑
        const resultFromCompleted = completedEscapes
            .filter((r: any) => !!r.story)
            .map((r: any) => {
                const s = r.story as any;
                const badge = s?.reward_badge;
                return {
                    story_id: s.id,
                    title: s.title as string,
                    synopsis: (s.synopsis as string) || "",
                    region: (s.region as string) || null,
                    imageUrl: (s.imageUrl as string) || (badge?.image_url as string) || null,
                    completedAt: r.completedAt || null,
                    badge: badge
                        ? {
                              id: badge.id as number,
                              name: badge.name as string,
                              image_url: (badge.image_url as string) || null,
                          }
                        : null,
                    photoCount: photoCountByStory[s.id] || 0,
                };
            });

        // 두 소스를 합치고 동일 스토리는 가장 최근 완료만 유지
        // 정렬 보장을 위해 completedAt 내림차순으로 정렬 후 처음 등장하는 스토리만 채택
        const merged = [...result, ...resultFromCompleted]
            .filter((it) => it && Number.isFinite(Number(it.story_id)))
            .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime());
        const unique = new Map<number, any>();
        for (const item of merged) if (!unique.has(item.story_id)) unique.set(item.story_id, item);

        return NextResponse.json(Array.from(unique.values()));
    } catch (error: any) {
            captureApiError(error);
        return NextResponse.json({ error: error?.message || "casefiles get failed" }, { status: 500 });
    }
}
