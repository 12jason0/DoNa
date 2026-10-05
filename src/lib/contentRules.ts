/**
 * 코스·장소 저장 규칙 (관리자 화면과 저장 API가 같이 씀)
 * - 차단: 컨셉 3개 이상, 목록 밖 컨셉·카테고리, 영업시간 형식 오류 → 바뀐 값만 검사
 * - 경고: 같은 카테고리 연속, 장소 간 1.2km 초과, 팁 번역 개수 불일치, 번역 제목 빈칸
 */
import type { PrismaClient } from "@prisma/client";
import type { ConceptTag } from "@/types/tag";

export const CONCEPT_OPTIONS: ConceptTag[] = [
    "이색데이트",
    "감성데이트",
    "야경",
    "힐링",
    "가성비",
    "인생샷",
    "맛집탐방",
    "카페투어",
    "술자리",
    "실내데이트",
    "공연·전시",
    "야외",
    "기념일",
    "소개팅",
];
export const MAX_CONCEPT_COUNT = 2;

export const PLACE_CATEGORIES = [
    "음식점",
    "카페",
    "주점",
    "쇼핑",
    "실내명소",
    "야외명소",
    "이색데이트",
    "액티비티",
    "사진관",
    "인생네컷",
    "향수",
    "야경",
    "식물원",
    "시장",
    "소품샵",
] as const;

const MAX_PLACE_GAP_KM = 1.2;

/** 코스 body(tags.concept 배열 또는 concept 문자열)에서 컨셉 목록 */
export function conceptList(tags: any, concept?: string | null): string[] {
    const raw: unknown[] = Array.isArray(tags?.concept) ? tags.concept : String(concept || "").split(",");
    return Array.from(new Set(raw.map((v) => String(v ?? "").trim()).filter(Boolean)));
}

/** 컨셉이 바뀌었을 때만 검사. 문제 있으면 에러 메시지 */
export function checkConcepts(next: string[], prev: string[] | null): string | null {
    if (prev && next.length === prev.length && next.every((c) => prev.includes(c))) return null;
    if (next.length > MAX_CONCEPT_COUNT) return `컨셉은 최대 ${MAX_CONCEPT_COUNT}개까지예요. (지금 ${next.length}개)`;
    const unknown = next.filter((c) => !(CONCEPT_OPTIONS as string[]).includes(c));
    if (unknown.length) return `목록에 없는 컨셉: ${unknown.join(", ")}`;
    return null;
}

/** 카테고리가 바뀌었을 때만 검사 */
export function checkCategory(next: unknown, prev: string | null | undefined): string | null {
    if (typeof next !== "string" || !next.trim() || next === prev) return null;
    return (PLACE_CATEGORIES as readonly string[]).includes(next) ? null : `목록에 없는 카테고리: ${next}`;
}

/**
 * 영업시간 표기 정리: "1130 - 21:30" → "11:30 - 21:30", "17:00  03:00" → "17:00 - 03:00",
 * "10: 00~21:00" → "10:00 - 21:00", "9:00-18:00" → "09:00 - 18:00"
 */
export function normalizeOpeningHours<T extends string | null | undefined>(v: T): T {
    if (typeof v !== "string") return v;
    return v
        .replace(/[~～–—]/g, "-")
        .replace(/(\d{1,2}):\s+(\d{2})/g, "$1:$2")
        .replace(/(?<![\d:])(\d{1,2})(\d{2})(?![\d:])/g, "$1:$2")
        .replace(/(\d{1,2}:\d{2})\s+(?=\d{1,2}:\d{2})/g, "$1 - ")
        .replace(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/g, "$1 - $2")
        .replace(/(?<!\d)(\d):(\d{2})/g, "0$1:$2")
        .trim() as T;
}

/** 정리된 영업시간이 placeStatus 파서가 읽을 수 있는 형식인지 */
export function isValidOpeningHours(s: string): boolean {
    if (!s.trim() || /24\s*시간/.test(s)) return true;
    const nums = s.match(/\d+(?::\d+)*/g) || [];
    const okTime = (t: string) => /^\d{2}:\d{2}$/.test(t) && Number(t.slice(0, 2)) <= 29 && Number(t.slice(3)) < 60;
    return nums.every(okTime) && /\d{2}:\d{2} - \d{2}:\d{2}/.test(s);
}

/** 영업시간이 바뀌었을 때만 검사 (정리 후 비교) */
export function checkOpeningHours(next: unknown, prev: string | null | undefined): string | null {
    if (typeof next !== "string") return null;
    if (next === prev || next === normalizeOpeningHours(prev)) return null;
    return isValidOpeningHours(next) ? null : `영업시간 형식 오류: "${next}" (예: 11:00 - 21:00, 월-금: 11:00 - 21:00; 토-일: 10:00 - 22:00)`;
}

function km(a: { latitude: number | null; longitude: number | null }, b: typeof a): number | null {
    if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) return null;
    const r = Math.PI / 180;
    const h =
        Math.sin(((b.latitude - a.latitude) * r) / 2) ** 2 +
        Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(((b.longitude - a.longitude) * r) / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
}

function tipCount(raw: string | null): number | null {
    if (!raw?.trim()) return null;
    try {
        const v = JSON.parse(raw);
        return Array.isArray(v) ? v.length : null;
    } catch {
        return null;
    }
}

/** 저장은 막지 않는 코스 경고 목록 */
export async function getCourseWarnings(prisma: PrismaClient, courseId: number): Promise<string[]> {
    const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: {
            title_en: true,
            title_ja: true,
            title_zh: true,
            coursePlaces: {
                orderBy: { order_index: "asc" },
                select: {
                    order_index: true,
                    tips: true,
                    tips_en: true,
                    tips_ja: true,
                    tips_zh: true,
                    place: { select: { name: true, category: true, latitude: true, longitude: true } },
                },
            },
        },
    });
    if (!course) return [];
    const warnings: string[] = [];

    const emptyTitles = (["en", "ja", "zh"] as const).filter((l) => !course[`title_${l}`]?.trim());
    if (emptyTitles.length) warnings.push(`번역 제목 빈칸: ${emptyTitles.map((l) => l.toUpperCase()).join(", ")}`);

    // 같은 order_index는 선택지(A/B) → 인접한 순서끼리만 비교
    const groups: (typeof course.coursePlaces)[] = [];
    for (const cp of course.coursePlaces) {
        const last = groups[groups.length - 1];
        if (last && last[0].order_index === cp.order_index) last.push(cp);
        else groups.push([cp]);
    }
    for (let i = 1; i < groups.length; i++) {
        for (const a of groups[i - 1]) {
            for (const b of groups[i]) {
                if (a.place.category && a.place.category === b.place.category) {
                    warnings.push(`같은 카테고리 연속(${a.place.category}): ${a.place.name} → ${b.place.name}`);
                }
                const d = km(a.place, b.place);
                if (d != null && d > MAX_PLACE_GAP_KM) {
                    warnings.push(`장소 간 ${d.toFixed(1)}km (1.2km 초과): ${a.place.name} → ${b.place.name}`);
                }
            }
        }
    }

    for (const cp of course.coursePlaces) {
        const ko = tipCount(cp.tips);
        if (ko == null) continue;
        const diff = (["en", "ja", "zh"] as const)
            .map((l) => [l, tipCount(cp[`tips_${l}`])] as const)
            .filter(([, n]) => n != null && n !== ko);
        if (diff.length) {
            warnings.push(`팁 개수 불일치(${cp.place.name}): KO ${ko} / ${diff.map(([l, n]) => `${l.toUpperCase()} ${n}`).join(" / ")}`);
        }
    }
    return warnings;
}
