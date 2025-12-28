"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import Image from "@/components/ImageFallback";
import { getPlaceStatus } from "@/lib/placeStatus";
import { useSearchParams, useRouter } from "next/navigation";
import { CONCEPTS } from "@/constants/onboardingData";
import CourseLockOverlay from "@/components/CourseLockOverlay";
import { apiFetch, authenticatedFetch } from "@/lib/authClient";
import CourseCard from "@/components/CourseCard";

// --- Types (기존과 동일) ---
type PlaceClosedDay = { day_of_week: number | null; specific_date: Date | string | null; note?: string | null };
type Place = {
    id: number;
    name: string;
    imageUrl?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    opening_hours?: string | null;
    closed_days?: PlaceClosedDay[];
    category?: string;
};
type CoursePlace = { order_index: number; place: Place | null };
export type Course = {
    id: string;
    title: string;
    description?: string;
    imageUrl?: string;
    concept?: string;
    region?: string;
    coursePlaces?: CoursePlace[];
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

// --- 태그 카테고리 정의 (course_tags 테이블 기반) ---
const TAG_CATEGORIES = {
    MANDATORY: {
        label: "활동",
        tags: ["맛집투어", "카페투어", "주점", "액티비티", "전시관람"] as string[],
    },
    VIBE: {
        label: "분위기",
        tags: ["힙스터", "감성", "로맨틱", "인생샷", "핫플", "신상"] as string[],
    },
    CONTEXT: {
        label: "상황",
        tags: ["데이트", "기념일", "가성비", "친구", "혼자"] as string[],
    },
    CONDITION: {
        label: "조건",
        tags: ["실내", "야외", "야경", "비오는날"] as string[],
    },
};

// --- Constants (기존 호환성 유지) ---
const tagCategories: Record<string, string[]> = {
    Concept: TAG_CATEGORIES.MANDATORY.tags,
    Mood: TAG_CATEGORIES.VIBE.tags,
    Target: TAG_CATEGORIES.CONTEXT.tags,
    Condition: TAG_CATEGORIES.CONDITION.tags,
};

const activities = [
    { key: "카페투어", label: "☕ 카페투어" },
    { key: "맛집탐방", label: "🍜 맛집탐방" },
    { key: "쇼핑", label: "🛍️ 쇼핑" },
    { key: "문화예술", label: "🎨 문화예술" },
    { key: "야경", label: "🌃 야경" },
    { key: "테마파크", label: "🎢 테마파크" },
    { key: "체험", label: "🧪 체험" },
    { key: "이색데이트", label: "✨ 이색데이트" },
];

const regions = ["강남", "성수", "홍대", "종로", "연남", "한남", "서초", "건대", "송파", "신촌"];

const SkeletonLoader = () => (
    <div className="space-y-8 animate-pulse">
        {[1, 2].map((i) => (
            <div key={i} className="block">
                <div className="w-full aspect-[4/3] bg-gray-100 rounded-[20px] mb-4 relative"></div>
                <div className="px-1 space-y-3">
                    <div className="w-3/4 h-7 bg-gray-100 rounded-lg"></div>
                    <div className="w-1/2 h-5 bg-gray-100 rounded-lg"></div>
                </div>
            </div>
        ))}
    </div>
);

const PlaceholderImage = () => (
    <div className="w-full h-full bg-gray-50 flex flex-col items-center justify-center text-gray-300">
        <svg className="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
        </svg>
        <span className="text-xs font-medium opacity-70">DoNa</span>
    </div>
);

interface NearbyClientProps {
    initialCourses: Course[];
    initialKeyword?: string;
}

export default function NearbyClient({ initialCourses, initialKeyword }: NearbyClientProps) {
    const searchParams = useSearchParams();
    const router = useRouter();

    const [mounted, setMounted] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [modalSelectedLabels, setModalSelectedLabels] = useState<string[]>([]);
    const [selectedFilterLabels, setSelectedFilterLabels] = useState<string[]>([]);
    const [selectedFilterConcepts, setSelectedFilterConcepts] = useState<string[]>([]);

    const [selectedActivities, setSelectedActivities] = useState<string[]>(() => {
        const c = (searchParams.get("concept") || "").trim();
        return c ? [c] : [];
    });
    const [selectedRegions, setSelectedRegions] = useState<string[]>(() => {
        const r = (searchParams.get("region") || "").trim();
        return r ? [r] : [];
    });

    const [courses, setCourses] = useState<Course[]>(initialCourses);
    const [loading, setLoading] = useState(false);
    const [hideClosedPlaces, setHideClosedPlaces] = useState<boolean>(() => searchParams.get("hideClosed") === "1");

    // 🟢 사용자가 타이핑하는 값 관리 (엔터 치면 초기화)
    const [searchInput, setSearchInput] = useState<string>("");

    const [selectedTagIds, setSelectedTagIds] = useState<number[]>(() => {
        return (searchParams.get("tagIds") || "")
            .split(",")
            .map((v) => Number(v))
            .filter((n) => Number.isFinite(n) && n > 0);
    });
    const [allTags, setAllTags] = useState<Array<{ id: number; name: string }>>([]);
    const [refreshNonce, setRefreshNonce] = useState(0);
    const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());

    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(initialCourses.length >= 30);
    const [offset, setOffset] = useState(30);
    const [isRecommendation, setIsRecommendation] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        setCourses(initialCourses);
        setLoading(false);
        setHasMore(initialCourses.length >= 30);
        setOffset(30);
    }, [initialCourses]);

    // 🟢 URL 파라미터 변경 시 상태 동기화 (되돌리기 버튼 클릭 시 필터 상태 복원) - 중복 제거 및 최적화
    useEffect(() => {
        const tagIdsFromUrl = (searchParams.get("tagIds") || "")
            .split(",")
            .map((v) => Number(v))
            .filter((n) => Number.isFinite(n) && n > 0);
        const conceptFromUrl = (searchParams.get("concept") || "").trim();
        const regionFromUrl = (searchParams.get("region") || "").trim();
        const qFromUrl = (searchParams.get("q") || "").trim();

        // 무한 루프 방지를 위해 조건부 업데이트만 수행
        const tagIdsStr = JSON.stringify([...tagIdsFromUrl].sort());
        const currentTagIdsStr = JSON.stringify([...selectedTagIds].sort());
        if (tagIdsStr !== currentTagIdsStr) {
            setSelectedTagIds(tagIdsFromUrl);
        }
        
        const conceptChanged = conceptFromUrl
            ? !selectedActivities.includes(conceptFromUrl)
            : selectedActivities.length > 0;
        if (conceptChanged) {
            setSelectedActivities(conceptFromUrl ? [conceptFromUrl] : []);
        }
        
        const regionChanged = regionFromUrl ? !selectedRegions.includes(regionFromUrl) : selectedRegions.length > 0;
        if (regionChanged) {
            setSelectedRegions(regionFromUrl ? [regionFromUrl] : []);
        }
        
        if (qFromUrl !== searchInput) {
            setSearchInput(qFromUrl);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    // 🟢 URL 파라미터 업데이트 (통합 관리)
    const pushUrlFromState = useCallback(
        (next: any) => {
            const sp = new URLSearchParams();
            const acts = next.activities ?? selectedActivities;
            const regs = next.regions ?? selectedRegions;
            const tags = next.tagIds ?? selectedTagIds;
            const q = next.q !== undefined ? next.q : searchParams.get("q") || "";
            const hide = next.hideClosed ?? hideClosedPlaces;

            if (q.trim()) sp.set("q", q.trim());
            if (acts[0]) sp.set("concept", acts[0]);
            if (regs[0]) sp.set("region", regs[0]);
            if (tags.length > 0) sp.set("tagIds", String(tags.join(",")));
            if (hide) sp.set("hideClosed", "1");

            setLoading(true);
            router.push(sp.toString() ? `/nearby?${sp.toString()}` : "/nearby");
        },
        [selectedActivities, selectedRegions, selectedTagIds, hideClosedPlaces, searchParams, router]
    );

    // 무한 스크롤 추가 데이터 로드
    const loadMoreCourses = useCallback(async () => {
        if (loadingMore || !hasMore || loading) return;
        setLoadingMore(true);
        try {
            const params = new URLSearchParams(searchParams.toString());
            params.set("limit", "30");
            params.set("offset", String(offset));

            const { data, response } = await apiFetch(`/api/courses/nearby?${params.toString()}`, {
                cache: "force-cache", // 🟢 성능 최적화: 캐시 활용
                next: { revalidate: 60 }, // 🟢 60초 캐시
            });
            if (response.ok && data) {
                const responseData = Array.isArray(data)
                    ? { data, isRecommendation: false }
                    : (data as { data?: Course[]; isRecommendation?: boolean });
                const coursesArray = Array.isArray(responseData.data) ? responseData.data : [];
                if (coursesArray.length > 0) {
                    setCourses((prev) => [...prev, ...coursesArray]);
                    setIsRecommendation(responseData.isRecommendation || false);
                    setOffset((prev) => prev + 30);
                    setHasMore(coursesArray.length >= 30);
                } else {
                    setHasMore(false);
                }
            }
        } catch {
            setHasMore(false);
        } finally {
            setLoadingMore(false);
        }
    }, [loadingMore, hasMore, loading, offset, searchParams]);

    // 🟢 스크롤 이벤트 throttle 최적화
    useEffect(() => {
        if (loading || !hasMore) return;
        
        let ticking = false;
        const handleScroll = () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                if (loadingMore || !hasMore || loading) {
                    ticking = false;
                    return;
                }
                const scrollHeight = document.documentElement.scrollHeight;
                const scrollTop = document.documentElement.scrollTop;
                const clientHeight = document.documentElement.clientHeight;
                if (scrollTop + clientHeight >= scrollHeight - 200) {
                    loadMoreCourses();
                }
                ticking = false;
            });
        };
        
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, [loadMoreCourses, loadingMore, hasMore, loading]);

    // 태그 리스트 및 즐겨찾기 목록 로드
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/course-tags");
                const data = await res.json();
                if (data?.success) setAllTags(data.tags);
            } catch {}
        })();
        authenticatedFetch<any[]>("/api/users/favorites").then((list) => {
            if (list) {
                const ids = new Set<number>();
                list.forEach((f: any) => {
                    const id = Number(f?.course?.id ?? f?.courseId ?? f?.id);
                    if (Number.isFinite(id)) ids.add(id);
                });
                setFavoriteIds(ids);
            }
        });
    }, []);

    // 🟢 태그 ID -> 이름 매핑 최적화 (Map 사용)
    const tagIdToNameMap = useMemo(() => {
        const map = new Map<number, string>();
        allTags.forEach((tag) => map.set(tag.id, tag.name));
        return map;
    }, [allTags]);

    // URL 파라미터에서 태그 ID 복원 시 필터 라벨 동기화 (초기 로드 시에만)
    useEffect(() => {
        if (tagIdToNameMap.size > 0 && selectedTagIds.length > 0 && selectedFilterLabels.length === 0) {
            // URL에서 복원된 태그 ID를 기반으로 필터 라벨 복원 (Map 사용으로 최적화)
            const tagLabels = selectedTagIds
                .map((id) => tagIdToNameMap.get(id))
                .filter((name): name is string => !!name);

            if (tagLabels.length > 0) {
                setSelectedFilterLabels(tagLabels);
            }
        }
    }, [tagIdToNameMap, selectedTagIds, selectedFilterLabels.length]);

    // 🟢 [원본 로직 완벽 복구] 가중치 기반 정렬 및 다중 키워드 필터링 - 성능 최적화
    const filtered = useMemo(() => {
        // 로딩 중이면 기존 데이터 유지 (빈 화면 방지)
        if (loading && courses.length > 0) {
            return courses;
        }

        const activeK = searchParams.get("q") || selectedRegions[0] || "";
        const keywords = activeK
            .split(/\s+/)
            .filter(Boolean)
            .map((k) => k.replace(/동$/, "").toLowerCase());

        // 🟢 태그 이름 미리 계산 (Map 사용으로 최적화)
        const selectedTagNames = selectedTagIds.length > 0 && tagIdToNameMap.size > 0
            ? selectedTagIds
                .map((id) => tagIdToNameMap.get(id))
                .filter((name): name is string => !!name)
            : [];

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

            // (5) 키워드 AND 검색 (성수동 + 카페 모두 포함 확인) - tags도 포함
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
                            (cp.place?.name || "") + " " + (cp.place?.address || "") + " " + (cp.place?.category || "") // 🟢 category 포함
                    ) || []),
                ]
                    .join(" ")
                    .toLowerCase();

                return keywords.every((k) => courseContent.includes(k));
            }
            return true;
        });

        // (4) 가중치 정렬 (홍대 검색 시 용산 코스 뒤로 밀기)
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
        searchParams,
        selectedRegions,
        selectedTagIds,
        tagIdToNameMap,
        // selectedFilterLabels는 filtered 계산에 직접 사용되지 않으므로 제거
    ]);

    // 🟢 화면에 표시할 검색어 (searchInput이 비어도 URL의 q를 참조)
    const displayKeyword = useMemo(() => {
        if (searchInput.trim()) return searchInput;
        const queryTerm = searchParams.get("q");
        if (queryTerm) return queryTerm;
        if (selectedRegions.length > 0) return selectedRegions[0];
        if (selectedActivities.length > 0) {
            const act = activities.find((a) => a.key === selectedActivities[0]);
            return act ? act.label : selectedActivities[0];
        }
        if (selectedTagIds.length > 0 && tagIdToNameMap.size > 0) {
            const firstTagName = tagIdToNameMap.get(selectedTagIds[0]);
            return firstTagName ? `#${firstTagName}` : "선택한 태그";
        }
        return null;
    }, [searchInput, searchParams, selectedRegions, selectedActivities, selectedTagIds, tagIdToNameMap]);

    // 🟢 보조 함수들 - useCallback으로 최적화
    const hasClosedPlace = useCallback((course: Course) => {
        if (!course.coursePlaces) return false;
        return course.coursePlaces.some((cp) => {
            const place = cp.place;
            if (!place) return false;
            return getPlaceStatus(place.opening_hours || null, place.closed_days || []).status === "휴무";
        });
    }, []);

    const getClosedPlaceCount = (course: Course) => {
        if (!course.coursePlaces) return 0;
        return course.coursePlaces.filter((cp) => {
            const place = cp.place;
            if (!place) return false;
            return getPlaceStatus(place.opening_hours || null, place.closed_days || []).status === "휴무";
        }).length;
    };

    const toggleFavorite = async (e: React.MouseEvent, courseId: string | number) => {
        e.preventDefault();
        e.stopPropagation();
        const idNum = Number(courseId);
        const liked = favoriteIds.has(idNum);
        setFavoriteIds((prev) => {
            const next = new Set(prev);
            liked ? next.delete(idNum) : next.add(idNum);
            return next;
        });
        try {
            const method = liked ? "DELETE" : "POST";
            const url = liked ? `/api/users/favorites?courseId=${idNum}` : "/api/users/favorites";
            const body = liked ? undefined : JSON.stringify({ courseId: idNum });
            const result = await authenticatedFetch(url, { method, body });
            if (result === null) {
                setFavoriteIds((prev) => {
                    const next = new Set(prev);
                    liked ? next.add(idNum) : next.delete(idNum);
                    return next;
                });
                if (confirm("로그인이 필요합니다.")) router.push("/login");
            }
        } catch {}
    };

    const toggleActivitySingle = (value: string) => {
        const next = selectedActivities.includes(value) ? [] : [value];
        setSelectedActivities(next);
        pushUrlFromState({ activities: next, q: "" });
    };

    const toggleRegionSingle = (value: string) => {
        const next = selectedRegions.includes(value) ? [] : [value];
        setSelectedRegions(next);
        pushUrlFromState({ regions: next, q: "" });
    };

    const removeTag = (tagIdToRemove: number) => {
        const next = selectedTagIds.filter((id) => id !== tagIdToRemove);
        const tag = allTags.find((t) => t.id === tagIdToRemove);
        if (tag) {
            setSelectedFilterLabels((prev) => prev.filter((label) => label !== tag.name));
        }
        setSelectedTagIds(next);
        pushUrlFromState({ tagIds: next });
    };

    const removeFilterLabel = (labelToRemove: string) => {
        const nextLabels = selectedFilterLabels.filter((label) => label !== labelToRemove);
        setSelectedFilterLabels(nextLabels);

        // 필터 모달의 선택 상태도 업데이트
        setModalSelectedLabels((prev) => prev.filter((label) => label !== labelToRemove));

        // 태그 ID에서도 제거
        const tag = allTags.find((t) => t.name === labelToRemove);
        if (tag) {
            const nextTagIds = selectedTagIds.filter((id) => id !== tag.id);
            setSelectedTagIds(nextTagIds);
            pushUrlFromState({ tagIds: nextTagIds });
        } else {
            // 태그에 없는 경우 (Concept/Mood 필터) concept에서도 제거
            const nextConcepts = selectedFilterConcepts.filter((c) => c !== labelToRemove);
            setSelectedFilterConcepts(nextConcepts);
            const conceptParam = nextConcepts.length > 0 ? nextConcepts[0] : undefined;
            pushUrlFromState({
                activities: conceptParam ? [conceptParam] : [],
                tagIds: selectedTagIds,
            });
        }
    };

    const handleCategoryClick = (raw: string) => {
        const exists = modalSelectedLabels.includes(raw);
        setModalSelectedLabels((prev) => (exists ? prev.filter((x) => x !== raw) : [...prev, raw]));
    };

    const applyCategorySelection = () => {
        const cleanedLabels = modalSelectedLabels.map((raw) =>
            String(raw || "")
                .replace(/^#/, "")
                .trim()
        );

        // 태그로 변환 가능한 필터와 태그로 변환되지 않은 필터 분리
        const tagIds = Array.from(
            new Set(
                cleanedLabels
                    .map((name) => allTags.find((t) => String(t?.name || "").trim() === name)?.id)
                    .filter((id): id is number => !!id && id > 0)
            )
        );

        // 태그로 변환되지 않은 필터는 concept으로 사용 (Concept/Mood 카테고리의 필터들)
        const conceptFilters = cleanedLabels.filter(
            (name) => !allTags.some((t) => String(t?.name || "").trim() === name)
        );

        // 선택한 모든 필터 라벨 저장 (태그로 변환되지 않은 것도 포함)
        setSelectedFilterLabels([...modalSelectedLabels]);
        setSelectedTagIds(tagIds);
        setSelectedFilterConcepts(conceptFilters);
        setShowCategoryModal(false);

        // concept 필터가 있으면 첫 번째 것을 concept 파라미터로 전달
        const conceptParam = conceptFilters.length > 0 ? conceptFilters[0] : undefined;
        pushUrlFromState({
            tagIds: tagIds,
            activities: conceptParam ? [conceptParam] : selectedActivities,
        });
    };

    const isActuallyLoading = !mounted || loading;

    return (
        <div className="min-h-screen bg-[#F9FAFB] text-gray-900">
            <section className="max-w-[500px] mx-auto min-h-screen bg-white border-x border-gray-100 flex flex-col">
                {/* --- Header & Search Section --- */}
                <div className="sticky top-0 z-40 bg-white px-5 pt-4 pb-2 shadow-[0_1px_3px_rgba(0,0,0,0.03)] shrink-0">
                    <div className="relative mb-3">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                            <svg
                                className="w-5 h-5 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                />
                            </svg>
                        </div>
                        <input
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    const q = searchInput.trim();
                                    setSearchInput(""); // 🟢 검색창 초기화
                                    setSelectedRegions([]);
                                    setSelectedActivities([]);
                                    setSelectedTagIds([]);
                                    setSelectedFilterLabels([]);
                                    setCourses([]);
                                    pushUrlFromState({ regions: [], activities: [], tagIds: [], q });
                                }
                            }}
                            placeholder="성수동 힙한 카페 어디지?"
                            className="w-full bg-gray-50 rounded-xl py-3.5 pl-12 pr-12 text-[15px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300 focus:bg-white transition-all tracking-tight"
                        />
                        <button
                            onClick={() => {
                                // 필터 모달 열 때 현재 선택된 필터로 초기화
                                setModalSelectedLabels([...selectedFilterLabels]);
                                setShowCategoryModal(true);
                            }}
                            className="absolute inset-y-0 right-3 flex items-center"
                        >
                            <div className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                                    />
                                </svg>
                            </div>
                        </button>
                    </div>

                    <div className="flex flex-col gap-3">
                        {/* 지역 카테고리 */}
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 -mx-5 px-5 scroll-smooth">
                            {(displayKeyword || selectedTagIds.length > 0 || selectedFilterLabels.length > 0) && (
                                <>
                                    <button
                                        onClick={() => {
                                            // 모든 필터 상태 명시적으로 초기화
                                            setSearchInput("");
                                            setSelectedActivities([]);
                                            setSelectedRegions([]);
                                            setSelectedTagIds([]);
                                            setSelectedFilterLabels([]);
                                            setSelectedFilterConcepts([]);
                                            setHideClosedPlaces(false);

                                            // URL 변경 및 로딩 시작
                                            setLoading(true);
                                            router.push("/nearby");
                                        }}
                                        className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-gray-50 border border-gray-200 text-gray-600 active:scale-95 transition-transform"
                                    >
                                        ↺
                                    </button>
                                    <div className="w-[1px] h-4 bg-gray-200 mx-1 shrink-0" />
                                </>
                            )}
                            {regions.map((r) => (
                                <button
                                    key={r}
                                    onClick={() => toggleRegionSingle(r)}
                                    className={`shrink-0 px-4 py-2 rounded-full text-[14px] font-semibold transition-all border ${
                                        selectedRegions.includes(r)
                                            ? "bg-emerald-600 text-white border-emerald-600"
                                            : "bg-white text-gray-600 border-gray-200"
                                    }`}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>

                        {/* 선택한 필터 표시 */}
                        {selectedFilterLabels.length > 0 && (
                            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 -mx-5 px-5 scroll-smooth">
                                <div className="text-[12px] text-gray-500 font-medium shrink-0 mr-1">필터:</div>
                                {selectedFilterLabels.map((label) => (
                                    <button
                                        key={label}
                                        onClick={() => removeFilterLabel(label)}
                                        className="shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
                                    >
                                        {label}
                                        <span className="text-emerald-600 text-[11px]">✕</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* --- Content List Section --- */}
                <div className="px-5 pt-6 flex-1 flex flex-col">
                    {isActuallyLoading ? (
                        <SkeletonLoader />
                    ) : (
                        <>
                            {/* 검색 결과가 없을 때 (추천 모드가 아닐 때) - 로딩 중이 아닐 때만 표시 */}
                            {filtered.length === 0 && !isRecommendation && !loading && (
                                <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] px-10">
                                    <div className="text-center">
                                        <p className="text-gray-400 text-[14px] font-medium mb-2">SEARCH RESULTS 0</p>
                                        <h3 className="text-[22px] font-bold text-gray-900 mb-4 tracking-tight">
                                            준비된{" "}
                                            <span className="text-emerald-600">'{displayKeyword || "해당 필터"}'</span>{" "}
                                            코스가 없나요?
                                        </h3>
                                        <p className="text-gray-500 text-[15px] mb-8 leading-relaxed">
                                            현재 해당 필터에 맞는 코스를 제작 중입니다.
                                            <br />
                                            대신 <span className="font-semibold">두나가 엄선한 인기 코스</span>를
                                            확인해보세요!
                                        </p>
                                        <button
                                            onClick={() => router.push("/nearby")}
                                            className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold shadow-lg shadow-slate-200 transition-transform active:scale-95"
                                        >
                                            전체 코스 탐색하기
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* 추천 모드일 때 헤더 */}
                            {isRecommendation && filtered.length > 0 && (
                                <div className="mb-8 border-b border-gray-100 pb-6">
                                    <div className="inline-block px-2 py-1 bg-slate-100 text-slate-600 text-[11px] font-bold rounded mb-3">
                                        AD / RECOMMENDATION
                                    </div>
                                    <h3 className="text-[20px] font-extrabold text-gray-900 tracking-tight leading-tight">
                                        찾으시는 결과가 없어서
                                        <br />
                                        <span className="text-emerald-600">요즘 뜨는 코스</span>를 준비했어요
                                    </h3>
                                </div>
                            )}

                            <div className="space-y-8">
                                {(filtered.length > 0 ? filtered : courses).map((c, i) => (
                                    <CourseCard
                                        key={c.id}
                                        course={c}
                                        isPriority={i < 2}
                                        isFavorite={favoriteIds.has(Number(c.id))}
                                        onToggleFavorite={toggleFavorite}
                                        hasClosedPlace={hasClosedPlace}
                                        getClosedPlaceCount={getClosedPlaceCount}
                                    />
                                ))}
                                {loadingMore && (
                                    <div className="text-center py-8">
                                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                                    </div>
                                )}
                                {!hasMore && filtered.length > 0 && (
                                    <div className="text-center py-8 text-gray-400 text-sm">
                                        모든 코스를 불러왔습니다.
                                    </div>
                                )}
                            </div>

                            {/* 하단에 전체보기 버튼 (상업적 유도) */}
                            {isRecommendation && (
                                <button
                                    onClick={() => router.push("/nearby")}
                                    className="mt-10 w-full py-4 bg-slate-900 text-white text-[15px] font-bold rounded-xl shadow-lg active:scale-[0.98] transition-all"
                                >
                                    전체 코스 탐색하기
                                </button>
                            )}
                        </>
                    )}
                </div>
            </section>

            {/* --- Filter Modal (Original UI) --- */}
            {showCategoryModal && (
                <div className="fixed inset-0 z-[100] flex justify-center items-end sm:items-center">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowCategoryModal(false)}
                    />
                    <div className="bg-white w-full sm:max-w-[480px] rounded-t-xl sm:rounded-xl border border-gray-100 relative flex flex-col max-h-[85vh] animate-slide-up">
                        <div className="pt-3 pb-4 px-6 border-b border-gray-100 flex-shrink-0">
                            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-4" />
                            <h3 className="text-[19px] font-bold text-gray-900">필터 설정</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-8">
                            {/* course_tags 테이블의 태그를 카테고리별로 표시 */}
                            {Object.entries(TAG_CATEGORIES).map(([key, category]) => {
                                // allTags에서 해당 카테고리에 속하는 태그만 필터링
                                const categoryTags = allTags.filter((tag) => category.tags.includes(tag.name));

                                // allTags에 없는 경우 하드코딩된 태그 사용 (fallback)
                                const displayTags =
                                    categoryTags.length > 0
                                        ? categoryTags
                                        : category.tags.map((name) => ({ id: 0, name }));

                                return (
                                    <div key={key}>
                                        <div className="text-[15px] font-bold mb-3 text-gray-900">
                                            {category.label}{" "}
                                            <span className="text-[12px] font-normal text-gray-500">({key})</span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {displayTags.map((tag) => {
                                                const tagName = typeof tag === "string" ? tag : tag.name;
                                                const isSelected = modalSelectedLabels.includes(tagName);

                                                return (
                                                    <button
                                                        key={tagName}
                                                        onClick={() => handleCategoryClick(tagName)}
                                                        className={`px-3.5 py-2.5 rounded-lg text-[14px] border transition-colors ${
                                                            isSelected
                                                                ? "bg-emerald-600 text-white border-emerald-600"
                                                                : "bg-white text-gray-600 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50"
                                                        }`}
                                                    >
                                                        {tagName}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="p-5 border-t border-gray-100 bg-white">
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setModalSelectedLabels([])}
                                    className="flex-1 py-4 rounded-lg bg-gray-100 text-gray-500 font-bold"
                                >
                                    초기화
                                </button>
                                <button
                                    onClick={applyCategorySelection}
                                    className="flex-[2.5] py-4 rounded-lg bg-slate-900 text-white font-bold"
                                >
                                    적용하기
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
