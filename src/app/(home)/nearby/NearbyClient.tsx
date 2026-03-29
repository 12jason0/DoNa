"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "@/components/ImageFallback";
import { getPlaceStatus } from "@/lib/placeStatus";
import { useSearchParams, useRouter } from "next/navigation";
import { CONCEPTS } from "@/constants/onboardingData";
import CourseLockOverlay from "@/components/CourseLockOverlay";
import { apiFetch, authenticatedFetch } from "@/lib/authClient";
import CourseCard from "@/components/CourseCard";
import { getTimeOfDayFromKST } from "@/lib/kst";
// 🟢 [Performance]: 필터링 로직과 모달을 별도 파일로 분리
import { useCourseFilter, type Course } from "@/hooks/useCourseFilter";
import CategoryFilterModal from "@/components/nearby/CategoryFilterModal";
import TapFeedback from "@/components/TapFeedback";
import { isIOS, isMobileApp } from "@/lib/platform";
import CourseReportBanner from "@/components/CourseReportBanner";
import CourseLoadingOverlay from "@/components/CourseLoadingOverlay";

const activities = [
    { key: CONCEPTS.UNIQUE, label: `✨ ${CONCEPTS.UNIQUE}` },
    { key: CONCEPTS.EMOTIONAL, label: `💕 ${CONCEPTS.EMOTIONAL}` },
    { key: CONCEPTS.NIGHT_VIEW, label: `🌃 ${CONCEPTS.NIGHT_VIEW}` },
    { key: CONCEPTS.HEALING, label: `🌿 ${CONCEPTS.HEALING}` },
    { key: CONCEPTS.COST_EFFECTIVE, label: `💰 ${CONCEPTS.COST_EFFECTIVE}` },
    { key: CONCEPTS.PHOTO, label: `📸 ${CONCEPTS.PHOTO}` },
    { key: CONCEPTS.FOOD_TOUR, label: `🍜 ${CONCEPTS.FOOD_TOUR}` },
    { key: CONCEPTS.CAFE, label: `☕ ${CONCEPTS.CAFE}` },
    { key: CONCEPTS.DRINKING, label: `🍺 ${CONCEPTS.DRINKING}` },
    { key: CONCEPTS.INDOOR, label: `🏠 ${CONCEPTS.INDOOR}` },
    { key: CONCEPTS.EXHIBITION, label: `🎭 ${CONCEPTS.EXHIBITION}` },
];

const regions = ["강남", "성수", "홍대", "종로", "연남", "영등포"];

const SkeletonLoader = () => (
    <div className="space-y-8 animate-pulse">
        {[1, 2].map((i) => (
            <div key={i} className="block">
                <div className="w-full aspect-4/3 bg-gray-100 dark:bg-gray-800 rounded-[20px] mb-4 relative"></div>
                <div className="px-1 space-y-3">
                    <div className="w-3/4 h-7 bg-gray-100 dark:bg-gray-800 rounded-lg"></div>
                    <div className="w-1/2 h-5 bg-gray-100 dark:bg-gray-800 rounded-lg"></div>
                </div>
            </div>
        ))}
    </div>
);

const PlaceholderImage = () => (
    <div className="w-full h-full bg-gray-50 dark:bg-gray-800 flex flex-col items-center justify-center text-gray-300 dark:text-gray-500">
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
    const [platform, setPlatform] = useState<"ios" | "android" | "web">("web");

    // 🟢 iOS/Android 플랫폼 감지
    useEffect(() => {
        if (isIOS()) {
            setPlatform("ios");
        } else if (typeof window !== "undefined" && /android/.test(navigator.userAgent.toLowerCase())) {
            setPlatform("android");
        } else {
            setPlatform("web");
        }
    }, []);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        // 🟢 초기 데이터 로드 시 즉시 업데이트 (성능 최적화)
        setCourses(initialCourses);
        // 🟢 로딩 해제는 다음 프레임에서 실행하여 로딩 오버레이가 보이도록 함
        requestAnimationFrame(() => {
            setLoading(false);
        });
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

    // 🟢 URL 파라미터 업데이트 (통합 관리) - 성능 최적화
    const pushUrlFromState = useCallback(
        (next: any) => {
            // 🟢 [Performance]: 즉시 URL 변경하여 빠른 전환 (로딩 상태는 서버에서 처리)
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

            const targetPath = sp.toString() ? `/nearby?${sp.toString()}` : "/nearby";

            // 🟢 [Performance]: requestAnimationFrame으로 부드러운 전환
            requestAnimationFrame(() => {
                // 🟢 [Fix]: 앱 환경에서는 window.location.href를 직접 사용 (WebView에서 router.push가 작동하지 않음)
                if (isMobileApp()) {
                    // 앱 환경: 전체 페이지 리로드로 확실한 전환 보장
                    window.location.href = targetPath;
                } else {
                    // 🟢 웹 환경: prefetch는 이미 호출되었을 수 있으므로 즉시 push
                    router.push(targetPath);
                }
            });
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
            const timeOfDay = getTimeOfDayFromKST();
            if (timeOfDay) params.set("timeOfDay", timeOfDay);

            // 🟢 [Performance]: prefetch로 미리 로드
            const apiUrl = `/api/courses/nearby?${params.toString()}`;
            router.prefetch(apiUrl);

            const { data, response } = await apiFetch<{ data?: Course[]; courses?: Course[] }>(apiUrl, {
                cache: "no-store", // 🟢 로드 더보기는 항상 최신 데이터 (캐시로 인한 중복/빈 목록 방지)
            });
            if (response.ok && data) {
                const raw = Array.isArray(data) ? data : (data as any)?.data ?? (data as any)?.courses ?? [];
                const coursesArray = Array.isArray(raw) ? raw : [];
                // 🟢 API는 view_count 등 snake_case를 반환할 수 있음 → Course 타입에 맞게 정규화
                const normalized = coursesArray.map((c: any) => ({
                    ...c,
                    id: String(c?.id ?? ""),
                    viewCount: typeof c?.viewCount === "number" ? c.viewCount : Number(c?.view_count ?? 0) || 0,
                    reviewCount: typeof c?.reviewCount === "number" ? c.reviewCount : 0,
                    participants: typeof c?.participants === "number" ? c.participants : 0,
                }));
                if (normalized.length > 0) {
                    setCourses((prev) => {
                        const existingIds = new Set(prev.map((c) => c.id));
                        const newUniqueCourses = normalized.filter((c: Course) => c.id && !existingIds.has(c.id));
                        return [...prev, ...newUniqueCourses];
                    });
                    setIsRecommendation((data as any)?.isRecommendation ?? false);
                    setOffset((prev) => prev + 30);
                    setHasMore(normalized.length >= 30);
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

    // 🟢 [Performance]: IntersectionObserver로 무한 스크롤 최적화 (스크롤 이벤트 대신)
    const loadMoreRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        if (!loadMoreRef.current || loading || !hasMore) return;
        const sentinel = loadMoreRef.current;
        let pending = false;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (!entry || !entry.isIntersecting) return;
                if (pending || loadingMore || !hasMore || loading) return;
                pending = true;
                Promise.resolve(loadMoreCourses()).finally(() => {
                    pending = false;
                });
            },
            { root: null, rootMargin: "400px", threshold: 0 }
        );

        observer.observe(sentinel);
        return () => {
            observer.disconnect();
        };
    }, [loadMoreRef, loadMoreCourses, loadingMore, hasMore, loading]);

    // 🟢 [Performance]: 태그 리스트 및 즐겨찾기 목록 지연 로드
    useEffect(() => {
        const ric = (window as any).requestIdleCallback || ((cb: () => void) => setTimeout(cb, 100));

        // 태그 리스트 로드
        ric(() => {
            (async () => {
                try {
                    const res = await fetch("/api/course-tags", {
                        cache: "force-cache", // 🟢 캐싱으로 성능 향상
                        next: { revalidate: 300 }, // 🟢 5분간 캐시 유지
                    });
                    const data = await res.json();
                    if (data?.success) setAllTags(data.tags);
                } catch {}
            })();
        });

        // 즐겨찾기 목록 로드 (더 긴 지연)
        ric(() => {
            setTimeout(() => {
                authenticatedFetch<any[]>("/api/users/favorites")
                    .then((list) => {
                        if (list) {
                            const ids = new Set<number>();
                            list.forEach((f: any) => {
                                const id = Number(f?.course?.id ?? f?.courseId ?? f?.id);
                                if (Number.isFinite(id)) ids.add(id);
                            });
                            setFavoriteIds(ids);
                        }
                    })
                    .catch(() => {}); // 실패 시 무시
            }, 500); // 🟢 500ms 추가 지연으로 초기 렌더링 우선
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

    // 🟢 [Performance]: 키워드 계산 (메모이제이션)
    // 🟢 [Fix]: selectedRegions가 있으면 키워드에 포함하지 않음 (서버에서 이미 필터링됨)
    const keywords = useMemo(() => {
        // selectedRegions가 있으면 q만 사용 (region은 서버에서 이미 필터링됨)
        const activeK =
            selectedRegions.length > 0
                ? searchParams.get("q") || ""
                : searchParams.get("q") || selectedRegions[0] || "";
        return activeK
            .split(/\s+/)
            .filter(Boolean)
            .map((k) => k.replace(/동$/, "").toLowerCase());
    }, [searchParams, selectedRegions]);

    // 🟢 태그 이름 미리 계산 (Map 사용으로 최적화)
    const selectedTagNames = useMemo(() => {
        if (selectedTagIds.length === 0 || tagIdToNameMap.size === 0) return [];
        return selectedTagIds.map((id) => tagIdToNameMap.get(id)).filter((name): name is string => !!name);
    }, [selectedTagIds, tagIdToNameMap]);

    // 🟢 [Performance]: 필터링 로직을 별도 hook으로 분리
    const { filtered: rawFiltered, hasClosedPlace } = useCourseFilter({
        courses,
        loading,
        selectedActivities,
        selectedRegions,
        selectedTagIds,
        selectedTagNames,
        hideClosedPlaces,
        keywords,
    });

    // 필터링된 결과 그대로 사용 (웹과 동일하게 유료 코스 잠금)
    const filtered = rawFiltered;

    // 🟢 [Fix]: 클라이언트 필터링 로직이 서버 데이터와 충돌할 경우를 대비한 안전 장치
    // 서버에서 이미 필터링된 데이터를 클라이언트에서 다시 필터링하다가 전부 걸러진 경우,
    // 서버 데이터를 그대로 보여줍니다.
    const displayCourses = useMemo(() => {
        // 1. 만약 서버에서 준 데이터(courses)가 있는데 클라이언트 필터(filtered)가 0이라면,
        //    필터링 로직에 오류가 있는 것이므로 서버 데이터를 그대로 보여줍니다.
        if (courses.length > 0 && filtered.length === 0 && !loading) {
            // 서버에서 필터링된 데이터가 있는데 클라이언트에서 모두 걸러졌다면 서버 데이터 사용
            return courses;
        }
        // 2. 그 외에는 필터링된 결과를 보여줍니다.
        return filtered;
    }, [filtered, courses, loading]);

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

    // 🟢 hasClosedPlace는 useCourseFilter에서 제공됨

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
        // 🟢 [Performance]: requestAnimationFrame으로 부드러운 전환
        requestAnimationFrame(() => {
            // 🟢 지역 카테고리 클릭 시 로딩 상태 설정 및 이전 결과 초기화
            setLoading(true);
            setCourses([]); // 이전 결과 초기화
            pushUrlFromState({ regions: next, q: "" });
        });
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
        // 🟢 [Performance]: requestAnimationFrame으로 부드러운 전환
        requestAnimationFrame(() => {
            // 🟢 카테고리 선택 시 로딩 상태 설정 및 이전 결과 초기화
            setLoading(true);
            setCourses([]); // 이전 결과 초기화

            // 🟢 [Performance]: 즉시 실행하여 빠른 전환
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
        });
    };

    const isActuallyLoading = !mounted || loading;

    return (
        <div className="min-h-screen bg-[#F9FAFB] dark:bg-[#0f1710] text-gray-900 dark:text-white">
            {/* 🟢 로딩 오버레이 표시 */}
            {isActuallyLoading && <CourseLoadingOverlay />}
            <section className="max-w-[500px] lg:max-w-[500px] mx-auto min-h-screen bg-white dark:bg-[#0f1710] border-x border-gray-100 dark:border-gray-800 flex flex-col">
                {/* --- Header & Search Section --- */}
                <div
                    className={`sticky z-40 bg-white dark:bg-[#0f1710] px-5 pb-2 shadow-[0_1px_3px_rgba(0,0,0,0.03)] dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)] shrink-0 ${
                        platform === "android"
                            ? "top-0 pt-4"
                            : "top-[env(safe-area-inset-top,0)] pt-[calc(env(safe-area-inset-top,0)+1rem)]"
                    }`}
                >
                    <div className="relative mb-3">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                            <svg
                                className="w-5 h-5 text-gray-400 dark:text-gray-500"
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
                                    if (!q) return; // 빈 검색어는 무시

                                    // 🟢 [Performance]: requestAnimationFrame으로 부드러운 전환
                                    requestAnimationFrame(() => {
                                        // 🟢 검색 시 로딩 상태 설정 및 이전 결과 초기화
                                        setLoading(true);
                                        setCourses([]);

                                        setSearchInput(""); // 🟢 검색창 초기화
                                        setSelectedRegions([]);
                                        setSelectedActivities([]);
                                        setSelectedTagIds([]);
                                        setSelectedFilterLabels([]);

                                        // 🟢 URL 변경 (로딩 상태가 설정된 후 실행)
                                        pushUrlFromState({ regions: [], activities: [], tagIds: [], q });
                                    });
                                }
                            }}
                            placeholder="성수동 힙한 카페 어디지?"
                            className="w-full bg-gray-50 dark:bg-[#1a241b] rounded-xl py-3.5 pl-12 pr-[3.75rem] text-[15px] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-gray-700 focus:bg-white dark:focus:bg-[#1a241b] transition-all tracking-tight"
                        />
                        {/* 태그 필터 버튼 */}
                        <button
                            onClick={() => {
                                setModalSelectedLabels([...selectedFilterLabels]);
                                setShowCategoryModal(true);
                            }}
                            className="absolute inset-y-0 right-1.5 flex items-center justify-center my-1.5"
                            aria-label="태그 필터"
                        >
                            <div className={`relative flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${
                                selectedFilterLabels.length > 0
                                    ? "bg-emerald-600 text-white"
                                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                            }`}>
                                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                                        d="M3 4h18M7 12h10M11 20h2" />
                                </svg>
                                <span>태그</span>
                                {selectedFilterLabels.length > 0 && (
                                    <span className="bg-white text-emerald-700 text-[11px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                                        {selectedFilterLabels.length}
                                    </span>
                                )}
                            </div>
                        </button>
                    </div>

                    <div className="flex flex-col gap-3">
                        {/* 지역 카테고리 */}
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 -mx-5 px-5 scroll-smooth flex-nowrap">
                            {(displayKeyword || selectedTagIds.length > 0 || selectedFilterLabels.length > 0) && (
                                <>
                                    <TapFeedback>
                                        <button
                                            onClick={() => {
                                                setSearchInput("");
                                                setSelectedActivities([]);
                                                setSelectedRegions([]);
                                                setSelectedTagIds([]);
                                                setSelectedFilterLabels([]);
                                                setSelectedFilterConcepts([]);
                                                setHideClosedPlaces(false);
                                                router.push("/nearby");
                                            }}
                                            className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-gray-50 dark:bg-[#1a241b] border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 transition-transform"
                                        >
                                            ↺
                                        </button>
                                    </TapFeedback>
                                    <div className="w-px h-4 bg-gray-200 mx-1 shrink-0" />
                                </>
                            )}
                            {regions.map((r) => (
                                <TapFeedback key={r}>
                                    <button
                                        onClick={() => toggleRegionSingle(r)}
                                        className={`shrink-0 px-4 py-2 rounded-full text-[14px] font-semibold transition-all border whitespace-nowrap ${
                                            selectedRegions.includes(r)
                                                ? "bg-emerald-600 text-white border-emerald-600"
                                                : "bg-white dark:bg-[#1a241b] text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700"
                                        }`}
                                    >
                                        {r}
                                    </button>
                                </TapFeedback>
                            ))}
                        </div>

                        {/* 선택한 필터 표시 */}
                        {selectedFilterLabels.length > 0 && (
                            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 -mx-5 px-5 scroll-smooth flex-nowrap">
                                <div className="text-[12px] text-gray-500 dark:text-gray-400 font-medium shrink-0 mr-1 whitespace-nowrap">
                                    필터:
                                </div>
                                {selectedFilterLabels.map((label) => (
                                    <TapFeedback key={label}>
                                        <button
                                            onClick={() => removeFilterLabel(label)}
                                            className="shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                                        >
                                            {label}
                                            <span className="text-emerald-600 dark:text-emerald-400 text-[11px]">
                                                ✕
                                            </span>
                                        </button>
                                    </TapFeedback>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* --- Content List Section --- */}
                <div className="px-5 pt-6 flex-1 flex flex-col">
                    {!isActuallyLoading && (
                        <>
                            {/* 검색 결과가 없을 때 (추천 모드가 아닐 때) - 로딩 중이 아니고 서버 데이터도 없을 때만 표시 */}
                            {displayCourses.length === 0 && !isRecommendation && !loading && courses.length === 0 && (
                                <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] px-10">
                                    <div className="text-center">
                                        <p className="text-gray-400 dark:text-gray-500 text-[14px] font-medium mb-2">
                                            SEARCH RESULTS 0
                                        </p>
                                        <h3 className="text-[22px] font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
                                            준비된{" "}
                                            <span className="text-emerald-600">'{displayKeyword || "해당 필터"}'</span>{" "}
                                            코스가 없나요?
                                        </h3>
                                        <p className="text-gray-500 dark:text-gray-400 text-[15px] mb-8 leading-relaxed">
                                            현재 해당 필터에 맞는 코스를 제작 중입니다.
                                            <br />
                                            대신 <span className="font-semibold">두나가 엄선한 인기 코스</span>를
                                            확인해보세요!
                                        </p>
                                        <TapFeedback className="block">
                                            <button
                                                onClick={() => {
                                                    window.location.href = "/nearby";
                                                }}
                                                className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold shadow-lg shadow-slate-200 transition-transform"
                                            >
                                                전체 코스 탐색하기
                                            </button>
                                        </TapFeedback>
                                    </div>
                                </div>
                            )}

                            {/* 추천 모드일 때 헤더 */}
                            {isRecommendation && displayCourses.length > 0 && (
                                <div className="mb-8 border-b border-gray-100 pb-6">
                                    <div className="inline-block px-2 py-1 bg-slate-100 text-slate-600 text-[11px] font-bold rounded mb-3">
                                        AD / RECOMMENDATION
                                    </div>
                                    <h3 className="text-[20px] font-extrabold text-gray-900 dark:text-white tracking-tight leading-tight">
                                        찾으시는 결과가 없어서
                                        <br />
                                        <span className="text-emerald-600">요즘 뜨는 코스</span>를 준비했어요
                                    </h3>
                                </div>
                            )}

                            <div className="flex flex-col gap-8">
                                {/* 🟢 iOS: Premium 코스 필터링, Android/Web: 모든 코스 표시 */}
                                {(displayCourses.length > 0 || isRecommendation) &&
                                    displayCourses
                                        .filter((c) => {
                                            // iOS/Android에서는 Premium 코스를 숨김
                                            if (
                                                (platform === "ios" || platform === "android") &&
                                                c.grade === "PREMIUM"
                                            ) {
                                                return false;
                                            }
                                            return true;
                                        })
                                        .map((c, i) => {
                                            // 🟢 코스 5개마다 제보 유도 배너 삽입 (완벽한 하루와 동일)
                                            const shouldShowBanner = i > 0 && i % 5 === 0;
                                            return (
                                                <div key={c.id}>
                                                    {shouldShowBanner && (
                                                        <div className="mb-6">
                                                            <CourseReportBanner />
                                                        </div>
                                                    )}
                                                    <CourseCard
                                                        course={c}
                                                        isPriority={i < 10} // 🟢 첫 10개 카드 priority (LCP + 첫 화면 이미지 빠르게 표시)
                                                        isFavorite={favoriteIds.has(Number(c.id))}
                                                        onToggleFavorite={toggleFavorite}
                                                        hasClosedPlace={hasClosedPlace}
                                                        getClosedPlaceCount={getClosedPlaceCount}
                                                    />
                                                </div>
                                            );
                                        })}
                                {loadingMore && (
                                    <div className="text-center py-8">
                                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                                    </div>
                                )}
                                {!hasMore && displayCourses.length > 0 && (
                                    <div className="text-center py-8 text-gray-400 text-sm">
                                        모든 코스를 불러왔습니다.
                                    </div>
                                )}
                                {/* 🟢 [Performance]: IntersectionObserver용 센티넬 */}
                                <div ref={loadMoreRef} aria-hidden="true" className="h-1"></div>
                            </div>

                            {/* 하단에 전체보기 버튼 (상업적 유도) */}
                            {isRecommendation && (
                                <TapFeedback className="block">
                                    <button
                                        onClick={() => {
                                            window.location.href = "/nearby";
                                        }}
                                        className="mt-10 w-full py-4 bg-slate-900 text-white text-[15px] font-bold rounded-xl shadow-lg transition-all"
                                    >
                                        전체 코스 탐색하기
                                    </button>
                                </TapFeedback>
                            )}
                        </>
                    )}
                </div>
            </section>

            {/* 🟢 [Performance]: 카테고리 필터 모달을 별도 컴포넌트로 분리 */}
            <CategoryFilterModal
                isOpen={showCategoryModal}
                onClose={() => setShowCategoryModal(false)}
                allTags={allTags}
                modalSelectedLabels={modalSelectedLabels}
                onCategoryClick={handleCategoryClick}
                onApply={applyCategorySelection}
                onReset={() => {
                    setModalSelectedLabels([]);
                    setSelectedFilterLabels([]);
                    setSelectedFilterConcepts([]);
                    setSelectedTagIds([]);
                    setSelectedActivities([]);
                    setSelectedRegions([]);
                    setHideClosedPlaces(false);
                    router.push("/nearby");
                    setShowCategoryModal(false);
                }}
            />
        </div>
    );
}
