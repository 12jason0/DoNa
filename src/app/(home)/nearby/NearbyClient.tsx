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
};

// --- Constants (데이터 100% 유지) ---
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
const MAJOR_REGIONS = ["강남", "성수", "홍대", "종로", "연남", "한남", "서초", "건대", "송파", "신촌"];

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

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        setCourses(initialCourses);
        setLoading(false);
        setHasMore(initialCourses.length >= 30);
        setOffset(30);
    }, [initialCourses]);

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
                cache: "no-store",
            });
            if (response.ok && data) {
                const coursesArray = Array.isArray(data) ? data : [];
                if (coursesArray.length > 0) {
                    setCourses((prev) => [...prev, ...coursesArray]);
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

    useEffect(() => {
        if (loading || !hasMore) return;
        const handleScroll = () => {
            if (loadingMore || !hasMore || loading) return;
            const scrollHeight = document.documentElement.scrollHeight;
            const scrollTop = document.documentElement.scrollTop;
            const clientHeight = document.documentElement.clientHeight;
            if (scrollTop + clientHeight >= scrollHeight - 200) loadMoreCourses();
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

    // 🟢 [원본 로직 완벽 복구] 가중치 기반 정렬 및 다중 키워드 필터링
    const filtered = useMemo(() => {
        const activeK = searchParams.get("q") || selectedRegions[0] || "";
        const keywords = activeK
            .split(/\s+/)
            .filter(Boolean)
            .map((k) => k.replace(/동$/, "").toLowerCase());

        let result = courses.filter((c) => {
            // (1) 컨셉/활동 필터링
            if (selectedActivities.length > 0 && !selectedActivities.some((a) => (c.concept || "").includes(a)))
                return false;
            // (2) 휴무 필터링
            if (hideClosedPlaces && hasClosedPlace(c)) return false;

            // (3) 키워드 AND 검색 (성수동 + 카페 모두 포함 확인)
            if (keywords.length > 0) {
                const courseContent = [
                    c.title,
                    c.region,
                    c.concept,
                    c.description,
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
    }, [courses, selectedActivities, hideClosedPlaces, searchParams, selectedRegions]);

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
        if (selectedTagIds.length > 0 && allTags.length > 0) {
            const firstTag = allTags.find((t) => t.id === selectedTagIds[0]);
            return firstTag ? `#${firstTag.name}` : "선택한 태그";
        }
        return null;
    }, [searchInput, searchParams, selectedRegions, selectedActivities, selectedTagIds, allTags]);

    // 보조 함수들 (원본 100% 보존)
    const hasClosedPlace = (course: Course) => {
        if (!course.coursePlaces) return false;
        return course.coursePlaces.some((cp) => {
            const place = cp.place;
            if (!place) return false;
            return getPlaceStatus(place.opening_hours || null, place.closed_days || []).status === "휴무";
        });
    };

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
        setSelectedTagIds(next);
        pushUrlFromState({ tagIds: next });
    };

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
                    .filter((id): id is number => !!id && id > 0)
            )
        );
        setSelectedTagIds(ids);
        setShowCategoryModal(false);
        pushUrlFromState({ tagIds: ids });
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
                                    setCourses([]);
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
                        {(displayKeyword || selectedTagIds.length > 0) && (
                            <>
                                <button
                                    onClick={() => {
                                        setSearchInput("");
                                        setSelectedActivities([]);
                                        setSelectedRegions([]);
                                        setSelectedTagIds([]);
                                        router.push("/nearby");
                                    }}
                                    className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-gray-50 border border-gray-200 text-gray-600 active:scale-95 transition-transform"
                                >
                                    ↺
                                </button>
                                <div className="w-[1px] h-4 bg-gray-200 mx-1 shrink-0" />
                            </>
                        )}
                        {selectedTagIds.map((id) => {
                            const tag = allTags.find((t) => t.id === id);
                            return tag ? (
                                <button
                                    key={id}
                                    onClick={() => removeTag(id)}
                                    className="shrink-0 px-4 py-2 rounded-full text-[14px] font-semibold bg-emerald-600 text-white"
                                >
                                    #{tag.name} ✕
                                </button>
                            ) : null;
                        })}
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
                </div>

                {/* --- Content List Section --- */}
                <div className="px-5 pt-6 flex-1 flex flex-col">
                    {isActuallyLoading ? (
                        <SkeletonLoader />
                    ) : filtered.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] text-center">
                            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-5">
                                <span className="text-3xl">🤔</span>
                            </div>
                            <h3 className="text-[19px] font-bold text-gray-900 mb-2 tracking-tight">
                                <span className="text-emerald-600">'{displayKeyword}'</span> 결과가 없어요
                            </h3>
                            <p className="text-gray-500 text-[15px] mb-8 leading-relaxed">
                                아직 등록되지 않은 테마나 지역인 것 같아요.
                                <br />
                                빠른 시일 내에 멋진 코스를 추가할게요! 🏃‍♂️
                            </p>
                            <button
                                onClick={() => router.push("/nearby")}
                                className="px-8 py-3.5 bg-slate-900 text-white rounded-lg font-bold"
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
                                    hasClosedPlace={hasClosedPlace}
                                    getClosedPlaceCount={getClosedPlaceCount}
                                />
                            ))}
                            {loadingMore && (
                                <div className="text-center py-8">
                                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                                </div>
                            )}
                            {!hasMore && (
                                <div className="text-center py-8 text-gray-400 text-sm">모든 코스를 불러왔습니다.</div>
                            )}
                        </div>
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
                            {Object.entries(tagCategories).map(([group, tags]) => (
                                <div key={group}>
                                    <div className="text-[15px] font-bold mb-3">{group}</div>
                                    <div className="flex flex-wrap gap-2">
                                        {tags.map((t) => (
                                            <button
                                                key={t}
                                                onClick={() => handleCategoryClick(t)}
                                                className={`px-3.5 py-2.5 rounded-lg text-[14px] border ${
                                                    modalSelectedLabels.includes(t)
                                                        ? "bg-emerald-600 text-white border-emerald-600"
                                                        : "bg-white text-gray-600 border-gray-200"
                                                }`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
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
