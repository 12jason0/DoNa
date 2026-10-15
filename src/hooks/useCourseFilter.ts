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
    coursePlaces?: Array<{
        order_index: number;
        place: {
            name?: string;
            address?: string;
            category?: string;
            opening_hours?: string | null;
            closed_days?: any[];
        } | null;
    }>;
    location?: string;
    distance?: number;
    duration?: string;
    viewCount?: number;
    reviewCount?: number;
    grade?: "FREE" | "BASIC" | "PREMIUM";
    rating?: number;
    isLocked?: boolean;
    /** 잠긴 코스: 장소가 자리표시라 서버가 미리 계산한 배지 값 */
    hasReservation?: boolean;
    closedPlaceCount?: number;
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
        if (typeof course.closedPlaceCount === "number") return course.closedPlaceCount > 0;
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

            // (3) 태그 필터링 - 🟢 [Fix]: 여러 태그 선택 시 모든 태그를 포함하는 코스만 표시 (AND 조건)
            if (selectedTagNames.length > 0) {
                // 🟢 courseTags 관계 테이블에서 가져온 태그 배열
                const courseTags = Array.isArray(c.tags) ? c.tags : [];
                // 🟢 [Fix]: 선택한 모든 태그를 포함해야 함 (AND 조건)
                const hasAllTags = selectedTagNames.every((tagName) => courseTags.includes(tagName));
                if (!hasAllTags) return false;
            }

            // 🟢 [Fix]: selectedRegions 필터링 - 서버에서 이미 필터링했으므로 더 유연하게 처리
            // 서버에서 REGION_GROUPS를 사용해 필터링했을 수 있으므로, 클라이언트에서는 더 관대하게 매칭
            if (selectedRegions.length > 0) {
                const regionMatch = selectedRegions.some((r) => {
                    const courseRegion = (c.region || "").toLowerCase().trim();
                    const searchRegion = r.toLowerCase().trim();
                    // 정확히 일치하거나 양방향 포함 관계 확인 (예: "성수"와 "성수동" 모두 매칭)
                    return (
                        courseRegion === searchRegion ||
                        courseRegion.includes(searchRegion) ||
                        searchRegion.includes(courseRegion)
                    );
                });
                // 🟢 [Fix]: 매칭 실패해도 서버 데이터를 신뢰하므로 필터링하지 않음
                // 대신 NearbyClient에서 displayCourses로 처리
                // if (!regionMatch) return false;
            }

            // (4) 키워드 AND 검색 (성수동 + 카페 모두 포함 확인) - tags도 포함
            // 🟢 [Fix]: selectedRegions가 있으면 키워드 검색은 스킵 (서버에서 이미 필터링됨)
            if (keywords.length > 0 && selectedRegions.length === 0) {
                const courseTags = Array.isArray(c.tags) ? c.tags : [];
                const courseContent = [
                    c.title,
                    c.region,
                    c.location, // 🟢 nearby는 region을 location으로만 넘기므로 둘 다 검색
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
    }, [courses, loading, selectedActivities, hideClosedPlaces, selectedTagNames, keywords, hasClosedPlace]);

    return { filtered, hasClosedPlace };
}
