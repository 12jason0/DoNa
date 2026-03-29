import { api } from "./api";

/**
 * 웹 마이페이지 `fetchPersonalStories`와 동일: 비공개(나만의 추억)만 통과
 */
export function filterPrivateStoriesOnly<T extends { isPublic?: unknown }>(items: T[]): T[] {
    return items.filter((review) => {
        const isPublic = review.isPublic;
        return (
            isPublic === false ||
            isPublic === "false" ||
            isPublic === 0 ||
            String(isPublic).toLowerCase() === "false"
        );
    });
}

/** 내 리뷰 중 비공개만 — GET /api/reviews?userId=me 후 클라이언트 필터 */
export async function fetchMyPrivateStories(limit = 50): Promise<any[]> {
    const capped = Math.min(Math.max(1, limit), 50);
    const d = await api.get<any[]>(`/api/reviews?userId=me&limit=${capped}`).catch(() => []);
    const list = Array.isArray(d) ? d : [];
    return filterPrivateStoriesOnly(list);
}
