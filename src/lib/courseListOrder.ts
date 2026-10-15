/**
 * 기본 코스 목록 순서: FREE 2개 → BASIC 1개 → PREMIUM 1개 반복, 공개 코스 전체.
 * 첫 화면(/courses 서버 렌더)과 무한 스크롤(/api/courses?offset=)이 같은 순서를 써야
 * 페이지 사이에 빠지거나 겹치는 코스가 없다.
 */
export function interleaveByGrade<T extends { grade?: string | null }>(courses: T[]): T[] {
    const free = courses.filter((c) => (c.grade || "FREE") === "FREE");
    const basic = courses.filter((c) => c.grade === "BASIC");
    const premium = courses.filter((c) => c.grade === "PREMIUM");
    const out: T[] = [];
    let f = 0,
        b = 0,
        p = 0;
    while (f < free.length || b < basic.length || p < premium.length) {
        if (f < free.length) out.push(free[f++]);
        if (f < free.length) out.push(free[f++]);
        if (b < basic.length) out.push(basic[b++]);
        if (p < premium.length) out.push(premium[p++]);
    }
    return out;
}

/**
 * "두나 추천 코스" 히어로 (웹·앱 공통): 무료 → 베이직 → 베이직 → 프리미엄 → 무료.
 * 그 등급이 모자라면 아직 안 쓴 다른 등급 코스로 채움. 같은 코스는 두 번 넣지 않음.
 */
const HERO_SLOTS = ["FREE", "BASIC", "BASIC", "PREMIUM", "FREE"] as const;
export function pickHeroByGrade<T extends { id: string | number; grade?: string | null }>(courses: T[]): T[] {
    const used = new Set<string>();
    const take = (c: T | undefined) => {
        if (c) used.add(String(c.id));
        return c;
    };
    const out: T[] = [];
    for (const grade of HERO_SLOTS) {
        const unused = courses.filter((c) => !used.has(String(c.id)));
        const c = take(unused.find((x) => (x.grade || "FREE") === grade) ?? unused[0]);
        if (c) out.push(c);
    }
    return out;
}

// ponytail: 공개 코스를 한 번에 읽어 정렬. 수백 개를 넘으면 DB 쪽 정렬 키로 바꿀 것
export const MAX_LIST_COURSES = 500;

/** NEW 배지: 만든 지 14일 이내 코스 */
export function isNewCourse(createdAt: string | Date | null | undefined, now = Date.now()): boolean {
    if (!createdAt) return false;
    const t = new Date(createdAt).getTime();
    return Number.isFinite(t) && now - t < 14 * 24 * 60 * 60 * 1000;
}
