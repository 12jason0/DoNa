"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "@/components/ImageFallback";
import { getPlaceStatus } from "@/lib/placeStatus";
import { useSearchParams, useRouter } from "next/navigation";
// ✅ [추가] 한글 변환을 위해 CONCEPTS 가져오기
import { CONCEPTS } from "@/constants/onboardingData";

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
    rating?: number;
};

// --- Data Constants (유지) ---
const tagCategories: Record<string, string[]> = {
    분위기: [
        "#힙스터",
        "#감성",
        "#로맨틱",
        "#캐주얼",
        "#럭셔리",
        "#빈티지",
        "#모던",
        "#전통",
        "#이국적",
        "#아늑한",
        "#힐링",
        "#프리미엄",
    ],
    특징: [
        "#사진촬영",
        "#인생샷",
        "#인스타",
        "#SNS인증",
        "#포토존",
        "#핫플",
        "#숨은명소",
        "#요즘핫한",
        "#신상",
        "#가성비",
        "#무료",
        "#비오는날",
        "#야경",
        "#실내",
        "#야외",
        "#한강",
    ],
    장소: ["#카페", "#레스토랑", "#전시관람", "#공연관람", "#방탈출", "#루프탑", "#복합문화공간", "#플래그십"],
    기타: [
        "#데이트",
        "#혼자",
        "#친구",
        "#기념일",
        "#첫만남",
        "#문화생활",
        "#산책",
        "#체험",
        "#쇼핑",
        "#맛집투어",
        "#카페투어",
        "#액티비티",
        "#미식",
        "#브런치",
        "#술집투어",
    ],
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

// --- Skeleton UI ---
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

    // --- Effects ---
    useEffect(() => {
        setMounted(true);
    }, []);
    useEffect(() => {
        setCourses(initialCourses);
        setLoading(false);
    }, [initialCourses]);
    useEffect(() => {
        const q = (searchParams.get("q") || "").trim();
        if (q !== searchInput) setSearchInput(q);
    }, [searchParams]);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/course-tags", { cache: "no-store" });
                const data = await res.json().catch(() => ({}));
                if (data?.success && Array.isArray(data.tags)) setAllTags(data.tags);
            } catch {}
        })();
    }, []);

    useEffect(() => {
        try {
            const token = localStorage.getItem("authToken");
            if (!token) return;
            fetch("/api/users/favorites", { headers: { Authorization: `Bearer ${token}` } })
                .then((res) => (res.ok ? res.json() : []))
                .then((list: any[]) => {
                    const ids = new Set<number>();
                    list.forEach((f: any) => {
                        const id = Number(f?.course?.id ?? f?.course_id ?? f?.courseId ?? f?.id);
                        if (Number.isFinite(id)) ids.add(id);
                    });
                    setFavoriteIds(ids);
                })
                .catch(() => {});
        } catch {}
    }, []);

    // --- Actions ---
    const toggleFavorite = async (e: React.MouseEvent, courseId: string | number) => {
        e.preventDefault();
        e.stopPropagation();
        const idNum = Number(courseId);
        const token = localStorage.getItem("authToken");
        if (!token) {
            if (confirm("로그인이 필요합니다.")) router.push("/login");
            return;
        }
        const liked = favoriteIds.has(idNum);
        setFavoriteIds((prev) => {
            const next = new Set(prev);
            if (liked) next.delete(idNum);
            else next.add(idNum);
            return next;
        });
        try {
            const method = liked ? "DELETE" : "POST";
            const url = liked ? `/api/users/favorites?courseId=${idNum}` : "/api/users/favorites";
            const body = liked ? undefined : JSON.stringify({ courseId: idNum });
            await fetch(url, {
                method,
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body,
            });
        } catch {
            setFavoriteIds((prev) => {
                const next = new Set(prev);
                if (liked) next.add(idNum);
                else next.delete(idNum);
                return next;
            });
        }
    };

    // Modal & Filter Logic (기존 코드 유지)
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
            <section className="max-w-[500px] mx-auto min-h-screen bg-white shadow-xl shadow-gray-100/50 flex flex-col">
                {/* Header (생략없이 기존 코드 유지) */}
                <div className="sticky top-0 z-30 bg-white px-5 pt-4 pb-2 shadow-[0_1px_3px_rgba(0,0,0,0.03)] shrink-0">
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
                            className="w-full bg-gray-50 rounded-2xl py-3.5 pl-12 pr-12 text-[15px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300 focus:bg-white transition-all shadow-sm"
                        />
                        <button
                            onClick={() => setShowCategoryModal(true)}
                            className="absolute inset-y-0 right-3 flex items-center"
                        >
                            <div className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
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
                                    className="shrink-0 px-4 py-2 rounded-full text-[14px] font-semibold whitespace-nowrap transition-all duration-200 bg-emerald-600 text-white border border-emerald-600 shadow-md shadow-emerald-100 flex items-center gap-1"
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
                                        ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-100"
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
                                        ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-100"
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
                            <h3 className="text-[19px] font-bold text-gray-900 mb-2">
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
                                빠른 시일 내에 멋진 코스로 채워둘게요! 🏃‍♂️
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
                                className="px-8 py-3.5 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95"
                            >
                                전체 코스 보기
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {filtered.map((c, i) => {
                                // ✅ [수정] concept 값을 한글로 변환
                                const rawConcept = c.concept?.split(",")[0] || "";
                                const displayConcept = CONCEPTS[rawConcept as keyof typeof CONCEPTS] || rawConcept;

                                return (
                                    <Link key={c.id} href={`/courses/${c.id}`} className="block group relative">
                                        <div className="relative w-full aspect-[4/3] rounded-[20px] overflow-hidden bg-gray-100 mb-3 shadow-sm border border-gray-100">
                                            {c.imageUrl ? (
                                                <Image
                                                    src={c.imageUrl}
                                                    alt={c.title}
                                                    fill
                                                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                                                    sizes="(max-width: 768px) 100vw, 500px"
                                                    priority={i < 2}
                                                />
                                            ) : (
                                                <PlaceholderImage />
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>
                                            <button
                                                onClick={(e) => toggleFavorite(e, c.id)}
                                                className="absolute top-3 right-3 z-20 flex items-center justify-center w-11 h-11 rounded-full bg-black/40 backdrop-blur-md hover:bg-black/50 transition-all active:scale-90 shadow-sm"
                                            >
                                                <svg
                                                    className={`w-7 h-7 drop-shadow-sm transition-colors ${
                                                        favoriteIds.has(Number(c.id))
                                                            ? "text-red-500 fill-red-500"
                                                            : "text-white"
                                                    }`}
                                                    fill={favoriteIds.has(Number(c.id)) ? "currentColor" : "none"}
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                    strokeWidth={2}
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                                                    />
                                                </svg>
                                            </button>
                                            {hasClosedPlace(c) && (
                                                <div className="absolute bottom-3 right-3 z-10">
                                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/95 backdrop-blur-sm border border-red-100 shadow-md">
                                                        <span className="text-[12px] font-bold text-red-600 leading-none">
                                                            {getClosedPlaceCount(c)}곳 휴무
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
                                                <span className="bg-black/40 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-md font-medium border border-white/10">
                                                    #{c.region || "서울"}
                                                </span>
                                                {/* ✅ [수정] 변환된 한글 displayConcept 사용 */}
                                                <span className="bg-black/40 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-md font-medium border border-white/10">
                                                    #{displayConcept}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="px-1 pt-1">
                                            <div className="flex flex-wrap gap-2 mb-3">
                                                {c.region && (
                                                    <span className="inline-block px-2 py-1 bg-gray-100 rounded-md text-[13px] font-bold text-gray-600">
                                                        #{c.region}
                                                    </span>
                                                )}
                                                {c.duration ? (
                                                    <span className="inline-block px-2 py-1 bg-gray-100 rounded-md text-[13px] font-bold text-gray-600">
                                                        #{c.duration}
                                                    </span>
                                                ) : null}
                                            </div>
                                            <h3 className="text-[18px] font-bold text-gray-900 leading-snug mb-2 group-hover:text-gray-700 transition-colors break-keep">
                                                {c.title}
                                            </h3>
                                            <div className="text-xs font-medium">
                                                {(() => {
                                                    const views = Number(c.viewCount || 0);
                                                    if (views >= 1000)
                                                        return (
                                                            <span className="text-orange-600 font-bold">
                                                                👀 {(views / 1000).toFixed(1)}천명이 보는 중
                                                            </span>
                                                        );
                                                    if (c.reviewCount && c.reviewCount > 0)
                                                        return (
                                                            <span className="text-gray-700">
                                                                ★ {c.rating} ({c.reviewCount})
                                                            </span>
                                                        );
                                                    return null;
                                                })()}
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>

            {/* Modal */}
            {showCategoryModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center sm:justify-center backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full sm:max-w-lg sm:rounded-[32px] rounded-t-[32px] p-6 shadow-2xl animate-slide-up max-h-[85vh] flex flex-col">
                        <div className="flex items-center justify-between mb-6 shrink-0">
                            <h3 className="text-xl font-bold text-gray-900">필터</h3>
                            <button
                                onClick={() => setShowCategoryModal(false)}
                                className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </div>
                        <div className="overflow-y-auto no-scrollbar space-y-8 mb-6 flex-1">
                            {Object.entries(tagCategories).map(([group, tags]) => (
                                <div key={group}>
                                    <div className="text-[15px] font-bold text-gray-900 mb-3">{group}</div>
                                    <div className="flex flex-wrap gap-2">
                                        {tags.map((t) => (
                                            <button
                                                key={t}
                                                onClick={() => handleCategoryClick(t)}
                                                className={`px-3.5 py-2 rounded-xl text-[14px] font-medium transition-all duration-200 border ${
                                                    modalSelectedLabels.includes(t)
                                                        ? "bg-emerald-600 text-white border-emerald-600"
                                                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                                                }`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-3 shrink-0 pt-2 border-t border-gray-100">
                            <button
                                onClick={() => setModalSelectedLabels([])}
                                className="flex-1 py-4 rounded-2xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors"
                            >
                                초기화
                            </button>
                            <button
                                onClick={applyCategorySelection}
                                className="flex-[2] py-4 rounded-2xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all"
                            >
                                {modalSelectedLabels.length > 0
                                    ? `${modalSelectedLabels.length}개 적용하기`
                                    : "적용하기"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
