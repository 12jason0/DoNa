"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import Image from "@/components/ImageFallback";
import { getPlaceStatus } from "@/lib/placeStatus";
import { useSearchParams, useRouter } from "next/navigation";
import { CONCEPTS } from "@/constants/onboardingData";
import CourseLockOverlay from "@/components/CourseLockOverlay";
import { apiFetch, authenticatedFetch } from "@/lib/authClient"; // 🟢 쿠키 기반 API 호출
// TicketPlans 제거
import CourseCard from "@/components/CourseCard";

// --- Types ---
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
};

// (기존 코드의 상수들을 그대로 두시면 됩니다)
const tagCategories: Record<string, string[]> = {
    Concept: [
        "실내",
        "야외",
        "복합",
        "활동적인",
        "정적인",
        "맛집",
        "카페",
        "주점",
        "전시",
        "복합문화공간",
        "쇼핑",
        "팝업",
        "체험",
        "공연",
        "테마파크",
        "힐링",
        "이색체험",
        "맛집탐방",
        "인생샷",
        "기념일",
        "소개팅",
        "빵지순례",
    ],
    Mood: [
        "로맨틱",
        "힙한",
        "트렌디한",
        "조용한",
        "활기찬",
        "레트로",
        "고급스러운",
        "감성",
        "편안한",
        "이국적인",
        "전통적인",
        "신비로운",
    ],
    Target: ["연인", "썸", "친구", "가족", "혼자", "반려동물", "단체/모임"],
};
// const activities = ... (사용하지 않으므로 삭제 또는 주석 처리 가능, 여기선 tagCategories만 교체)
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

    // ✅ [추가] 필터 모달과 결제 모달 상태 분리
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    // showSubscriptionModal 제거

    const [modalSelectedLabels, setModalSelectedLabels] = useState<string[]>([]);
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
    const [searchInput, setSearchInput] = useState<string>(initialKeyword || "");
    const [selectedTagIds, setSelectedTagIds] = useState<number[]>(() => {
        return (searchParams.get("tagIds") || "")
            .split(",")
            .map((v) => Number(v))
            .filter((n) => Number.isFinite(n) && n > 0);
    });
    const [allTags, setAllTags] = useState<Array<{ id: number; name: string }>>([]);
    const [refreshNonce, setRefreshNonce] = useState(0);
    const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
    // 🟢 무한 스크롤 관련 state
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(initialCourses.length >= 30);
    const [offset, setOffset] = useState(30);

    // --- Effects & Logic (기존과 동일) ---
    useEffect(() => {
        setMounted(true);
    }, []);
    useEffect(() => {
        setCourses(initialCourses);
        setLoading(false);
        setHasMore(initialCourses.length >= 30);
        setOffset(30);
    }, [initialCourses]);

    // 🟢 무한 스크롤: 추가 코스 로드 함수 (useCallback으로 최적화)
    const loadMoreCourses = useCallback(async () => {
        if (loadingMore || !hasMore || loading) return;

        setLoadingMore(true);
        try {
            // 🟢 쿠키 기반 인증: apiFetch 사용
            const params = new URLSearchParams();
            params.set("limit", "30");
            params.set("offset", String(offset));
            
            const q = searchInput.trim() || searchParams.get("q") || "";
            const region = searchParams.get("region") || "";
            const concept = searchParams.get("concept") || "";
            const tagIds = searchParams.get("tagIds") || "";

            if (q) params.set("q", q);
            if (region) params.set("region", region);
            if (concept) params.set("concept", concept);
            if (tagIds) params.set("tagIds", tagIds);

            const { data, response } = await apiFetch(`/api/courses/nearby?${params.toString()}`, {
                cache: "force-cache", // 🟢 성능 최적화: 브라우저 캐시 활용
                next: { revalidate: 180 }, // 🟢 성능 최적화: 300초 -> 180초 (3분)
            });

            if (response.ok && data) {
                // 🟢 nearby API는 배열을 직접 반환하므로 그대로 사용
                const coursesArray = Array.isArray(data) ? data : [];
                
                if (coursesArray.length > 0) {
                    setCourses((prev) => [...prev, ...coursesArray]);
                    setOffset((prev) => prev + 30);
                    setHasMore(coursesArray.length >= 30);
                } else {
                    setHasMore(false);
                }
            } else {
                setHasMore(false);
            }
        } catch (error) {
            console.error("추가 코스 로드 실패:", error);
            setHasMore(false);
        } finally {
            setLoadingMore(false);
        }
    }, [loadingMore, hasMore, loading, offset, searchInput, searchParams]);

    // 🟢 스크롤 감지: 바닥에 도달하면 추가 로드
    useEffect(() => {
        if (loading || !hasMore) return;

        const handleScroll = () => {
            if (loadingMore || !hasMore || loading) return;

            const scrollHeight = document.documentElement.scrollHeight;
            const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
            const clientHeight = document.documentElement.clientHeight;

            // 바닥에서 200px 전에 미리 로드
            if (scrollTop + clientHeight >= scrollHeight - 200) {
                loadMoreCourses();
            }
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, [loadMoreCourses, loadingMore, hasMore, loading]);
    useEffect(() => {
        setSearchInput("");
    }, [searchParams]);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/course-tags", { next: { revalidate: 600 } });
                const data = await res.json().catch(() => ({}));
                if (data?.success && Array.isArray(data.tags)) setAllTags(data.tags);
            } catch {}
        })();
    }, []);

    useEffect(() => {
        // 🟢 쿠키 기반 인증: authenticatedFetch 사용
        authenticatedFetch<any[]>("/api/users/favorites", {
            next: { revalidate: 300 },
        })
            .then((list) => {
                if (list) {
                    const ids = new Set<number>();
                    list.forEach((f: any) => {
                        const id = Number(f?.course?.id ?? f?.course_id ?? f?.courseId ?? f?.id);
                        if (Number.isFinite(id)) ids.add(id);
                    });
                    setFavoriteIds(ids);
                }
            })
            .catch(() => {});
    }, []);

    const toggleFavorite = async (e: React.MouseEvent, courseId: string | number) => {
        e.preventDefault();
        e.stopPropagation();
        const idNum = Number(courseId);
        const liked = favoriteIds.has(idNum);
        setFavoriteIds((prev) => {
            const next = new Set(prev);
            if (liked) next.delete(idNum);
            else next.add(idNum);
            return next;
        });
        try {
            // 🟢 쿠키 기반 인증: authenticatedFetch 사용
            const method = liked ? "DELETE" : "POST";
            const url = liked ? `/api/users/favorites?courseId=${idNum}` : "/api/users/favorites";
            const body = liked ? undefined : JSON.stringify({ courseId: idNum });
            
            const result = await authenticatedFetch(url, {
                method,
                body,
            });
            
            if (result === null) {
                // 인증 실패 시 원래 상태로 복구
                setFavoriteIds((prev) => {
                    const next = new Set(prev);
                    if (liked) next.add(idNum);
                    else next.delete(idNum);
                    return next;
                });
                if (confirm("로그인이 필요합니다.")) router.push("/login");
            }
        } catch {
            setFavoriteIds((prev) => {
                const next = new Set(prev);
                if (liked) next.add(idNum);
                else next.delete(idNum);
                return next;
            });
        }
    };

    // Filter Logic
    useEffect(() => {
        if (!showCategoryModal || !allTags.length) return;
        const labels = allTags
            .filter((t) => selectedTagIds.includes(t.id))
            .map((t) => `#${String(t.name || "").trim()}`);
        setModalSelectedLabels(labels);
    }, [showCategoryModal, allTags, selectedTagIds]);

    const handleCategoryClick = (raw: string) => {
        const exists = modalSelectedLabels.includes(raw);
        setModalSelectedLabels((prev) => (exists ? prev.filter((x) => x !== raw) : [...prev, raw]));
    };

    const applyCategorySelection = () => {
        const ids = Array.from(
            new Set(
                modalSelectedLabels
                    .map((raw) =>
                        String(raw || "")
                            .replace(/^#/, "")
                            .trim()
                    )
                    .map((name) => allTags.find((t) => String(t?.name || "").trim() === name)?.id)
                    .filter((id): id is number => Number.isFinite(id as any) && (id as any) > 0)
            )
        );
        setSelectedTagIds(ids);
        const sp = new URLSearchParams();
        if (ids.length > 0) sp.set("tagIds", String(ids.join(",")));
        if (selectedActivities[0]) sp.set("concept", selectedActivities[0]);
        if (selectedRegions[0]) sp.set("region", selectedRegions[0]);
        if (searchInput.trim()) sp.set("q", searchInput.trim());
        if (hideClosedPlaces) sp.set("hideClosed", "1");
        setShowCategoryModal(false);
        setLoading(true);
        router.push(`/nearby?${sp.toString()}`);
    };

    const hasClosedPlace = useMemo(() => {
        return (course: Course): boolean => {
            if (!course.coursePlaces || course.coursePlaces.length === 0) return false;
            return course.coursePlaces.some((cp) => {
                const place = cp.place;
                if (!place) return false;
                const status = getPlaceStatus(place.opening_hours || null, place.closed_days || []);
                return status.status === "휴무";
            });
        };
    }, []);

    const getClosedPlaceCount = useMemo(() => {
        return (course: Course): number => {
            if (!course.coursePlaces || course.coursePlaces.length === 0) return 0;
            return course.coursePlaces.filter((cp) => {
                const place = cp.place;
                if (!place) return false;
                const status = getPlaceStatus(place.opening_hours || null, place.closed_days || []);
                return status.status === "휴무";
            }).length;
        };
    }, []);

    const filtered = useMemo(() => {
        return courses.filter((c) => {
            if (selectedActivities.length > 0 && !selectedActivities.some((a) => (c.concept || "").includes(a)))
                return false;
            if (hideClosedPlaces && hasClosedPlace(c)) return false;
            return true;
        });
    }, [courses, selectedActivities, hideClosedPlaces, hasClosedPlace]);

    const pushUrlFromState = (next: any) => {
        const sp = new URLSearchParams();
        const acts = next.activities ?? selectedActivities;
        const regs = next.regions ?? selectedRegions;
        const tags = next.tagIds ?? selectedTagIds;
        const q = next.q ?? searchInput;
        const hide = next.hideClosed ?? hideClosedPlaces;
        if (q?.trim()) sp.set("q", q.trim());
        if (acts[0]) sp.set("concept", acts[0]);
        if (regs[0]) sp.set("region", regs[0]);
        if (tags.length > 0) sp.set("tagIds", String(tags.join(",")));
        if (hide) sp.set("hideClosed", "1");
        setLoading(true);
        router.push(sp.toString() ? `/nearby?${sp.toString()}` : "/nearby");
    };

    const toggleActivitySingle = (value: string) => {
        const next = selectedActivities.includes(value) ? [] : [value];
        setSelectedActivities(next);
        setSearchInput("");
        pushUrlFromState({ activities: next, q: "", regions: selectedRegions, tagIds: selectedTagIds });
    };
    const toggleRegionSingle = (value: string) => {
        const next = selectedRegions.includes(value) ? [] : [value];
        setSelectedRegions(next);
        setSearchInput("");
        pushUrlFromState({ regions: next, q: "", activities: selectedActivities, tagIds: selectedTagIds });
    };
    const removeTag = (tagIdToRemove: number) => {
        const next = selectedTagIds.filter((id) => id !== tagIdToRemove);
        setSelectedTagIds(next);
        pushUrlFromState({ tagIds: next });
    };

    const displayKeyword = useMemo(() => {
        if (searchInput.trim()) return searchInput;
        if (selectedRegions.length > 0) return selectedRegions[0];
        if (selectedActivities.length > 0) {
            const act = activities.find((a) => a.key === selectedActivities[0]);
            return act ? act.label : selectedActivities[0];
        }
        if (selectedTagIds.length > 0 && allTags.length > 0) {
            const firstTag = allTags.find((t) => t.id === selectedTagIds[0]);
            return firstTag ? `#${firstTag.name}` : "선택한 태그";
        }
        return null;
    }, [searchInput, selectedRegions, selectedActivities, selectedTagIds, allTags]);

    const isActuallyLoading = !mounted || loading;

    return (
        <div className="min-h-screen bg-[#F9FAFB] text-gray-900">
            {/* Header */}
            <section className="max-w-[500px] mx-auto min-h-screen bg-white border-x border-gray-100 flex flex-col">
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
                                    setSelectedRegions([]);
                                    setSelectedActivities([]);
                                    setSelectedTagIds([]);
                                    setCourses([]);
                                    setLoading(true);
                                    pushUrlFromState({ regions: [], activities: [], tagIds: [], q });
                                }
                            }}
                            placeholder="성수동 힙한 카페 어디지?"
                            className="w-full bg-gray-50 rounded-xl py-3.5 pl-12 pr-12 text-[15px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300 focus:bg-white transition-all tracking-tight"
                        />
                        <button
                            onClick={() => setShowCategoryModal(true)}
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
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 -mx-5 px-5 scroll-smooth">
                        {(selectedRegions.length > 0 || selectedActivities.length > 0 || selectedTagIds.length > 0) && (
                            <>
                                <button
                                    onClick={() => {
                                        setLoading(true);
                                        setSelectedActivities([]);
                                        setSelectedRegions([]);
                                        setSelectedTagIds([]);
                                        setSearchInput("");
                                        setHideClosedPlaces(false);
                                        router.push("/nearby");
                                        setRefreshNonce((n) => n + 1);
                                    }}
                                    className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-gray-50 border border-gray-200 text-gray-600 active:scale-95 transition-transform"
                                >
                                    <span className="text-sm font-bold">↺</span>
                                </button>
                                <div className="w-[1px] h-4 bg-gray-200 mx-1 shrink-0" />
                            </>
                        )}
                        {selectedTagIds.map((tagId) => {
                            const tag = allTags.find((t) => t.id === tagId);
                            if (!tag) return null;
                            return (
                                <button
                                    key={tagId}
                                    onClick={() => removeTag(tagId)}
                                    className="shrink-0 px-4 py-2 rounded-full text-[14px] font-semibold whitespace-nowrap transition-all duration-200 bg-emerald-600 text-white border border-emerald-600 flex items-center gap-1 tracking-tight"
                                >
                                    #{tag.name} <span className="text-white/70 text-[10px] ml-1">✕</span>
                                </button>
                            );
                        })}
                        {regions.map((r) => (
                            <button
                                key={r}
                                onClick={() => toggleRegionSingle(r)}
                                className={`shrink-0 px-4 py-2 rounded-full text-[14px] font-semibold whitespace-nowrap transition-all duration-200 border ${
                                    selectedRegions.includes(r)
                                        ? "bg-emerald-600 text-white border-emerald-600"
                                        : "bg-white text-gray-600 border-gray-200 hover:border-emerald-500 hover:text-emerald-600"
                                }`}
                            >
                                {r}
                            </button>
                        ))}
                        <div className="w-[1px] h-4 bg-gray-200 mx-1 shrink-0" />
                        {activities.map((a) => (
                            <button
                                key={a.key}
                                onClick={() => toggleActivitySingle(a.key)}
                                className={`shrink-0 px-4 py-2 rounded-full text-[14px] font-semibold whitespace-nowrap transition-all duration-200 border ${
                                    selectedActivities.includes(a.key)
                                        ? "bg-emerald-600 text-white border-emerald-600"
                                        : "bg-white text-gray-600 border-gray-200 hover:border-emerald-500 hover:text-emerald-600"
                                }`}
                            >
                                {a.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="px-5 pt-6 flex-1 flex flex-col">
                    {isActuallyLoading ? (
                        <SkeletonLoader />
                    ) : filtered.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] text-center">
                            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-5">
                                <span className="text-3xl">🤔</span>
                            </div>
                            <h3 className="text-[19px] font-bold text-gray-900 mb-2 tracking-tight">
                                {displayKeyword ? (
                                    <>
                                        <span className="text-emerald-600">'{displayKeyword}'</span>에 대한 결과가
                                        없어요
                                    </>
                                ) : (
                                    "해당 조건의 코스가 없어요"
                                )}
                            </h3>
                            <p className="text-gray-500 text-[15px] mb-8 leading-relaxed">
                                아직 등록되지 않은 테마나 지역인 것 같아요.
                                <br />
                                빠른 시일 내에 멋진 코스를 추가할게요! 🏃‍♂️
                            </p>
                            <button
                                onClick={() => {
                                    setLoading(true);
                                    setSelectedActivities([]);
                                    setSelectedRegions([]);
                                    setSelectedTagIds([]);
                                    setSearchInput("");
                                    setHideClosedPlaces(false);
                                    router.push("/nearby");
                                    setRefreshNonce((n) => n + 1);
                                }}
                                className="px-8 py-3.5 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-all tracking-tight"
                            >
                                전체 코스 보기
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {filtered.map((c, i) => (
                                <CourseCard
                                    key={c.id}
                                    course={c}
                                    isPriority={i < 2}
                                    isFavorite={favoriteIds.has(Number(c.id))}
                                    onToggleFavorite={toggleFavorite}
                                    // onLockedClick removed
                                    hasClosedPlace={hasClosedPlace}
                                    getClosedPlaceCount={getClosedPlaceCount}
                                    showNewBadge={false}
                                />
                            ))}

                            {/* 🟢 무한 스크롤 로딩 인디케이터 */}
                            {loadingMore && (
                                <div className="text-center py-8">
                                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                                    <p className="text-gray-500 text-sm mt-2">더 많은 코스를 불러오는 중...</p>
                                </div>
                            )}

                            {!hasMore && filtered.length > 0 && (
                                <div className="text-center py-8">
                                    <p className="text-gray-400 text-sm">모든 코스를 불러왔습니다.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </section>

            {/* 필터 Modal */}
            {showCategoryModal && (
                <div className="fixed inset-0 z-[100] flex justify-center items-end sm:items-center">
                    {/* 1. 뒷배경 (Backdrop) */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
                        onClick={() => setShowCategoryModal(false)}
                    />

                    {/* 2. 바텀 시트 본문 */}
                    <div className="bg-white w-full sm:max-w-[480px] rounded-t-xl sm:rounded-xl border border-gray-100 relative flex flex-col max-h-[85vh] animate-slide-up">
                        {/* --- [헤더 영역] 고정됨 --- */}
                        <div className="relative pt-3 pb-4 px-6 border-b border-gray-100 flex-shrink-0">
                            {/* 핸들바 디자인 추가 */}
                            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-4" />

                            <div className="flex items-center justify-between">
                                <h3 className="text-[19px] font-bold text-gray-900 tracking-tight">필터 설정</h3>
                                <button
                                    onClick={() => setShowCategoryModal(false)}
                                    className="p-2 -mr-2 text-gray-400 hover:text-gray-800 transition-colors"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* --- [컨텐츠 영역] 스크롤 가능 --- */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
                            {Object.entries(tagCategories).map(([group, tags]) => (
                                <div key={group}>
                                    <div className="text-[15px] font-bold text-gray-900 mb-3">{group}</div>
                                    <div className="flex flex-wrap gap-2">
                                        {tags.map((t) => (
                                            <button
                                                key={t}
                                                onClick={() => handleCategoryClick(t)}
                                                className={`px-3.5 py-2.5 rounded-lg text-[14px] font-medium transition-all duration-200 border tracking-tight ${
                                                    modalSelectedLabels.includes(t)
                                                        ? "bg-emerald-600 text-white border-emerald-600"
                                                        : "bg-white text-gray-600 border-gray-200 hover:border-emerald-200 hover:bg-emerald-50"
                                                }`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {/* 하단 버튼에 가려지지 않도록 여유 공간 */}
                            <div className="h-2" />
                        </div>

                        {/* --- [하단 버튼 영역] 고정됨 --- */}
                        <div className="p-5 border-t border-gray-100 bg-white pb-8 sm:pb-5 rounded-b-[32px] flex-shrink-0 z-10">
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setModalSelectedLabels([])}
                                    className="flex-1 py-4 rounded-lg bg-gray-100 text-gray-500 font-bold hover:bg-gray-200 transition-colors tracking-tight"
                                >
                                    초기화
                                </button>
                                <button
                                    onClick={applyCategorySelection}
                                    className="flex-[2.5] py-4 rounded-lg bg-slate-900 text-white font-bold text-[16px] hover:bg-slate-800 transition-all tracking-tight"
                                >
                                    {modalSelectedLabels.length > 0
                                        ? `${modalSelectedLabels.length}개 적용하기`
                                        : "적용하기"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* ✅ [추가] 결제 모달 렌더링 (CourseCard 내부로 이동됨) */}
        </div>
    );
}
