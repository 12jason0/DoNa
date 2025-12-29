// 🟢 [Performance]: 필터링 로직을 별도 hook으로 분리하여 성능 최적화
import { useMemo, useCallback } from "react";
import { getPlaceStatus } from "@/lib/placeStatus";

export type Course = {
    id: string;
    title: string;
    description?: string;
    imageUrl?: string;
    concept?: string;
    region?: string;
    coursePlaces?: Array<{ order_index: number; place: { name?: string; address?: string; category?: string; opening_hours?: string | null; closed_days?: any[] } | null }>;
    location?: string;
    distance?: number;
    duration?: string;
    viewCount?: number;
    reviewCount?: number;
    grade?: "FREE" | "BASIC" | "PREMIUM";
    rating?: number;
    isLocked?: boolean;
    tags?: string[];
};

interface UseCourseFilterOptions {
    courses: Course[];
    loading: boolean;
    selectedActivities: string[];
    selectedRegions: string[];
    selectedTagIds: number[];
    selectedTagNames: string[];
    hideClosedPlaces: boolean;
    keywords: string[];
}

export function useCourseFilter({
    courses,
    loading,
    selectedActivities,
    selectedRegions,
    selectedTagIds,
    selectedTagNames,
    hideClosedPlaces,
    keywords,
}: UseCourseFilterOptions) {
    // 🟢 휴무 장소 체크 함수 (메모이제이션)
    const hasClosedPlace = useCallback((course: Course) => {
        if (!course.coursePlaces) return false;
        return course.coursePlaces.some((cp) => {
            const place = cp.place;
            if (!place) return false;
            return getPlaceStatus(place.opening_hours || null, place.closed_days || []).status === "휴무";
        });
    }, []);

    // 🟢 필터링 로직 (useMemo로 최적화)
    const filtered = useMemo(() => {
        // 로딩 중이면 기존 데이터 유지 (빈 화면 방지)
        if (loading && courses.length > 0) {
            return courses;
        }

        let result = courses.filter((c) => {
            // (1) 컨셉/활동 필터링 - concept 컬럼과 tags JSON 필드 모두 확인
            if (selectedActivities.length > 0) {
                const matchConcept = selectedActivities.some((a) => (c.concept || "").includes(a));
                // tags는 배열이므로 직접 includes로 확인
                const courseTags = Array.isArray(c.tags) ? c.tags : [];
                const matchTags = selectedActivities.some((a) => courseTags.includes(a));

                if (!matchConcept && !matchTags) return false;
            }
            // (2) 휴무 필터링
            if (hideClosedPlaces && hasClosedPlace(c)) return false;

            // (3) 태그 필터링 (최적화: 미리 계산된 selectedTagNames 사용)
            if (selectedTagNames.length > 0) {
                const courseTags = Array.isArray(c.tags) ? c.tags : [];
                // 선택한 태그 중 하나라도 코스에 포함되어 있어야 함
                const hasMatchingTag = selectedTagNames.some((tagName) => courseTags.includes(tagName));
                if (!hasMatchingTag) return false;
            }

            // (4) 키워드 AND 검색 (성수동 + 카페 모두 포함 확인) - tags도 포함
            if (keywords.length > 0) {
                const courseTags = Array.isArray(c.tags) ? c.tags : [];
                const courseContent = [
                    c.title,
                    c.region,
                    c.concept,
                    c.description,
                    ...courseTags, // tags 배열도 검색에 포함
                    ...(c.coursePlaces?.map(
                        (cp) =>
                            (cp.place?.name || "") + " " + (cp.place?.address || "") + " " + (cp.place?.category || "")
                    ) || []),
                ]
                    .join(" ")
                    .toLowerCase();

                return keywords.every((k) => courseContent.includes(k));
            }
            return true;
        });

        // (5) 가중치 정렬 (홍대 검색 시 용산 코스 뒤로 밀기)
        if (keywords.length > 0) {
            result = [...result].sort((a, b) => {
                const getScore = (course: Course) => {
                    let score = 0;
                    keywords.forEach((k) => {
                        if (course.region?.toLowerCase() === k) score += 100; // 지역명 일치 최우선
                        else if (course.region?.toLowerCase().includes(k)) score += 50;
                        if (course.title?.toLowerCase().includes(k)) score += 20;
                        // 카테고리 매칭 가중치
                        if (course.coursePlaces?.some((cp) => cp.place?.category?.toLowerCase().includes(k)))
                            score += 30;
                    });
                    return score;
                };
                return getScore(b) - getScore(a);
            });
        }
        return result;
    }, [
        courses,
        loading,
        selectedActivities,
        hideClosedPlaces,
        selectedTagNames,
        keywords,
        hasClosedPlace,
    ]);

    return { filtered, hasClosedPlace };
}

