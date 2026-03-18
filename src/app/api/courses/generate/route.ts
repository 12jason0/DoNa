import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { captureApiError } from "@/lib/sentry";
export const dynamic = "force-dynamic";
// 쿼리: ?tag=coffee&count=3&places=4
// places 테이블에서 tag/category/name에 tag가 포함된 장소를 랜덤 샘플링해
// 코스 count개를 생성하여 반환. DB에는 저장하지 않고 즉시 응답만.
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const tag = (searchParams.get("tag") || "").trim();
    const tagsCsv = (searchParams.get("tags") || "").trim();
    const region = (searchParams.get("region") || "").trim();
    const courseCount = Math.max(1, Math.min(Number(searchParams.get("count") || 3), 5));
    const placesPerCourse = Math.max(3, Math.min(Number(searchParams.get("places") || 4), 6));
    const tags: string[] = (tagsCsv ? tagsCsv.split(",") : []).map((t) => t.trim()).filter(Boolean);
    if (tag && !tags.length) tags.push(tag);

    try {
        // Prisma로 장소 조회
        const where: any = { AND: [{ latitude: { not: null } }, { longitude: { not: null } }] };
        if (region) (where.AND as any[]).push({ address: { contains: region } });
        if (tags.length > 0) {
            (where.AND as any[]).push({
                OR: tags.map((t) => ({ OR: [{ category: { contains: t } }, { name: { contains: t } }] })),
            });
        }
        let rows = (await (prisma as any).place.findMany({
            where,
            take: 500,
            select: {
                id: true,
                name: true,
                address: true,
                latitude: true,
                longitude: true,
                category: true,
                imageUrl: true,
            },
        } as any)) as any[];

        type Place = {
            id: number;
            name: string;
            address?: string;
            latitude: number;
            longitude: number;
            category?: string;
            imageUrl?: string;
        };

        let allPlaces = rows as Place[];
        // Fallback: 선택 조합으로 장소가 부족하면 지역만 기준으로 다시 시도
        if (allPlaces.length < placesPerCourse) {
            try {
                const rows2 = (await (prisma as any).place.findMany({
                    where: {
                        AND: [
                            { latitude: { not: null } },
                            { longitude: { not: null } },
                            ...(region ? [{ address: { contains: region } }] : []),
                        ],
                    },
                    take: 500,
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        latitude: true,
                        longitude: true,
                        category: true,
                        imageUrl: true,
                    },
                } as any)) as any[];
                const alt = rows2 as Place[];
                if (alt.length >= placesPerCourse) {
                    allPlaces = alt;
                }
            } catch {}
        }
        if (allPlaces.length < 2) {
            return NextResponse.json({ success: true, courses: [] });
        }

        // 간단 샘플링 유틸
        const shuffle = <T>(arr: T[]) =>
            arr
                .map((v) => [Math.random(), v] as const)
                .sort((a, b) => a[0] - b[0])
                .map(([, v]) => v);

        // 특수 로직: '카페'와 '한식/음식' 동시 선택 시 [한식→카페→한식→카페] 패턴으로 구성
        const normalizeUrl = (u: any): string | undefined => {
            if (!u) return undefined;
            const s = String(u).trim();
            return s.length > 0 ? s : undefined;
        };
        const wantsCafe = tags.some((t) => /카페|coffee/i.test(t));
        const wantsKorean = tags.some((t) => /한식|음식|맛집|식당/i.test(t));
        // 단일 코스 병합 유틸
        const mergeSingletonCourses = (list: any[]) => {
            const result: any[] = [];
            for (const course of list) {
                if (course.places && course.places.length === 1 && result.length > 0) {
                    const last = result[result.length - 1];
                    const existingIds = new Set((last.places || []).map((p: any) => p.id));
                    if (!existingIds.has(course.places[0].id) && (last.places?.length || 0) < placesPerCourse) {
                        last.places.push({ ...course.places[0], order: last.places.length + 1 });
                        continue; // current course absorbed
                    }
                    // 만약 이전 코스에 추가할 수 없다면: 현재 코스가 1개뿐이면 제거
                    if ((course.places || []).length <= 1) {
                        continue;
                    }
                }
                // order 재정렬 보장
                course.places = (course.places || []).map((p: any, idx: number) => ({ ...p, order: idx + 1 }));
                result.push(course);
            }
            return result;
        };

        if (wantsCafe && wantsKorean) {
            const inText = (p: Place) => `${p.category || ""} ${p.name || ""}`;
            const isCafe = (p: Place) => /카페|coffee/i.test(inText(p));
            const isKorean = (p: Place) =>
                /한식|국밥|칼국수|분식|김밥|비빔|백반|고기|돼지|소고기|치킨|탕|국|면|냉면|만두|맛집|식당|전골/i.test(
                    inText(p)
                );

            const korean = allPlaces.filter(isKorean);
            const cafes = allPlaces.filter(isCafe);
            if (korean.length && cafes.length) {
                const dist2 = (a: Place, b: Place) => {
                    const dx = a.latitude - b.latitude;
                    const dy = a.longitude - b.longitude;
                    return dx * dx + dy * dy;
                };
                const nearest = (from: Place, pool: Place[], used: Set<number>) => {
                    let best: Place | null = null;
                    let bd = Infinity;
                    for (const p of pool) {
                        if (used.has(p.id)) continue;
                        const d = dist2(from, p);
                        if (d < bd) {
                            bd = d;
                            best = p;
                        }
                    }
                    return best;
                };

                const seeds = korean.slice(0, Math.min(courseCount, korean.length));
                const patternCoursesRaw = seeds
                    .map((seed, idx) => {
                        const used = new Set<number>();
                        const picked: Place[] = [];
                        picked.push(seed);
                        used.add(seed.id);
                        let last = seed;
                        let wantCafeNext = true;
                        while (picked.length < placesPerCourse) {
                            const pool = wantCafeNext ? cafes : korean;
                            const next = nearest(last, pool, used);
                            if (!next) break;
                            picked.push(next);
                            used.add(next.id);
                            last = next;
                            wantCafeNext = !wantCafeNext;
                        }
                        return {
                            id: `gen-${idx}-${Date.now()}`,
                            title: `${region || "근접"} 코스 #${idx + 1}`,
                            concept: "korean-cafe-alt",
                            places: picked.map((p, i) => ({
                                order: i + 1,
                                id: p.id,
                                name: p.name,
                                address: p.address,
                                latitude: p.latitude,
                                longitude: p.longitude,
                                category: p.category as any,
                                imageUrl: normalizeUrl((p as any).imageUrl),
                            })),
                        };
                    })
                    .slice(0, courseCount);

                // 동일 장소 조합(순서 무관) 코스는 1개만 남김
                const seen = new Set<string>();
                const patternCourses = patternCoursesRaw.filter((c) => {
                    const key = c.places
                        .map((p: any) => p.id)
                        .sort((a: number, b: number) => a - b)
                        .join("-");
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });

                const merged = mergeSingletonCourses(patternCourses).slice(0, courseCount);
                return NextResponse.json({ success: true, courses: merged });
            }
        }

        // 근접도 기반 K-means 유사 클러스터링으로 가까운 장소끼리 묶기
        const k = Math.min(courseCount, Math.max(1, Math.floor(allPlaces.length / Math.max(1, placesPerCourse))));
        const points = allPlaces.map((p) => [p.latitude, p.longitude]);
        const pick = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];
        const dist = (a: number[], b: number[]) => {
            const dx = a[0] - b[0];
            const dy = a[1] - b[1];
            return dx * dx + dy * dy;
        };
        let centroids = points.sort(() => Math.random() - 0.5).slice(0, k);
        for (let iter = 0; iter < 6; iter++) {
            const clusters: number[][][] = Array.from({ length: k }, () => []);
            points.forEach((pt) => {
                let bi = 0;
                let bd = Infinity;
                centroids.forEach((c, i) => {
                    const d = dist(pt, c);
                    if (d < bd) {
                        bd = d;
                        bi = i;
                    }
                });
                clusters[bi].push(pt);
            });
            centroids = clusters.map((cl) => {
                if (cl.length === 0) return pick(points);
                const sx = cl.reduce((s, p) => s + p[0], 0) / cl.length;
                const sy = cl.reduce((s, p) => s + p[1], 0) / cl.length;
                return [sx, sy];
            });
        }

        let coursesRaw = centroids
            .map((c, idx) => {
                const scored = allPlaces
                    .map((p) => ({ p, d: dist([p.latitude, p.longitude], c as number[]) }))
                    .sort((a, b) => a.d - b.d);
                const chosen = new Set<number>();
                const sampled = [] as typeof allPlaces;
                for (const s of scored) {
                    if (!chosen.has(s.p.id)) {
                        sampled.push(s.p);
                        chosen.add(s.p.id);
                    }
                    if (sampled.length >= placesPerCourse) break;
                }
                return {
                    id: `gen-${idx}-${Date.now()}`,
                    title: `${tags[0] || region || "근접"} 코스 #${idx + 1}`,
                    concept: tags[0] || region || "cluster",
                    places: sampled.map((p, i) => ({
                        order: i + 1,
                        id: p.id,
                        name: p.name,
                        address: p.address,
                        latitude: p.latitude,
                        longitude: p.longitude,
                        category: p.category as any,
                        imageUrl: normalizeUrl((p as any).imageUrl),
                    })),
                };
            })
            .slice(0, courseCount);

        // 동일 장소 조합(순서 무관) 코스는 1개만 남김
        const seen = new Set<string>();
        let courses = coursesRaw.filter((c) => {
            const key = c.places
                .map((p: any) => p.id)
                .sort((a: number, b: number) => a - b)
                .join("-");
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // 만약 클러스터 수가 적어 반환 코스가 부족하면, 가장 큰 클러스터에서 추가로 뽑아 최소 1개 이상 반환
        if (courses.length === 0 && allPlaces.length >= Math.min(placesPerCourse, 2)) {
            const sampled = allPlaces.slice(0, Math.min(allPlaces.length, placesPerCourse));
            courses = [
                {
                    id: `gen-fallback-${Date.now()}`,
                    title: `${region || tags[0] || "근접"} 코스 #1`,
                    concept: "fallback",
                    places: sampled.map((p, i) => ({
                        order: i + 1,
                        id: p.id,
                        name: p.name,
                        address: p.address,
                        latitude: p.latitude,
                        longitude: p.longitude,
                        category: p.category as any,
                        imageUrl: normalizeUrl((p as any).imageUrl),
                    })),
                },
            ];
        }

        const merged = mergeSingletonCourses(courses);
        return NextResponse.json({ success: true, courses: merged });
    } catch (error) {

            captureApiError(error);
        console.error("GET /api/courses/generate error:", error);
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    } finally {
    }
}
