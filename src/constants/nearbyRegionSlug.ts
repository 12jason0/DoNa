/**
 * 내 주변: URL `region` 파라미터는 영문 슬러그 권장.
 * 레거시(한글 토큰)도 필터에 전달해 하위 호환.
 */
export const NEARBY_REGION_SLUG_TO_FILTER: Record<string, string> = {
    gangnam: "강남",
    seongsu: "성수",
    hongdae: "홍대",
    jongno: "종로",
    yeonnam: "연남",
    yeongdeungpo: "영등포",
};

const FILTER_TO_SLUG: Record<string, string> = Object.fromEntries(
    Object.entries(NEARBY_REGION_SLUG_TO_FILTER).map(([slug, token]) => [token, slug]),
);

/** URL/상태용 슬러그 → REGION_GROUPS 매칭용 한글 토큰 */
export function resolveNearbyRegionParam(region: string): string {
    const t = region.trim();
    if (!t) return "";
    const bySlug = NEARBY_REGION_SLUG_TO_FILTER[t.toLowerCase()];
    if (bySlug) return bySlug;
    return t;
}

/** 필터 토큰(한글) 또는 슬러그 → 정규 슬러그 (상태·URL 통일) */
export function normalizeNearbyRegionToSlug(region: string): string {
    const t = region.trim();
    if (!t) return "";
    const lower = t.toLowerCase();
    if (NEARBY_REGION_SLUG_TO_FILTER[lower]) return lower;
    const fromKo = FILTER_TO_SLUG[t];
    return fromKo || lower;
}
