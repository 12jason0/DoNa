"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "@/components/ImageFallback";
import CourseLockOverlay from "@/components/CourseLockOverlay";
import CourseCard from "@/components/CourseCard";
import { apiFetch, authenticatedFetch } from "@/lib/authClient"; // 🟢 쿠키 기반 API 호출
// TicketPlans 제거
// ✅ [필수] 한글 변환을 위해 CONCEPTS 가져오기
import { CONCEPTS } from "@/constants/onboardingData";

// import { Lock } from "lucide-react"; (삭제 또는 유지, 여기선 Overlay 내부 SVG 사용하므로 삭제 가능하지만, 안전하게 두거나 삭제)

// --- Type Definitions ---
type PlaceClosedDay = {
    day_of_week: number | null;
    specific_date: Date | string | null;
    note?: string | null;
};

type Place = {
    id: number;
    name: string;
    imageUrl?: string;
    latitude?: number;
    longitude?: number;
    opening_hours?: string | null;
    closed_days?: PlaceClosedDay[];
};

type CoursePlace = {
    order_index: number;
    place: Place | null;
};

export interface Course {
    id: string;
    title: string;
    description: string;
    duration: string;
    location: string;
    participants: number;
    imageUrl: string;
    concept: string;
    rating: number;
    reviewCount: number;
    viewCount: number;
    createdAt?: string | Date;
    coursePlaces?: CoursePlace[];
    grade?: "FREE" | "BASIC" | "PREMIUM"; // ✅
    isLocked?: boolean; // ✅
}

interface CoursesClientProps {
    initialCourses: Course[];
}

export default function CoursesClient({ initialCourses }: CoursesClientProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const conceptParam = searchParams.get("concept");

    // Initialize state
    const [courses, setCourses] = useState<Course[]>(initialCourses);
    const [sortBy, setSortBy] = useState<"views" | "latest">("views");
    const [activeConcept, setActiveConcept] = useState<string>(conceptParam || "");
    const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
    // 🟢 무한 스크롤 관련 state
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(initialCourses.length >= 30);
    const [offset, setOffset] = useState(30);
    // showSubscriptionModal 제거

    useEffect(() => {
        if (conceptParam) {
            setActiveConcept(conceptParam);
        } else {
            setActiveConcept("");
        }
    }, [conceptParam]);

    useEffect(() => {
        setCourses(initialCourses);
        setHasMore(initialCourses.length >= 30);
        setOffset(30);
    }, [initialCourses]);

    // 🟢 무한 스크롤: 추가 코스 로드 함수 (useCallback으로 최적화)
    const loadMoreCourses = useCallback(async () => {
        if (loadingMore || !hasMore) return;

        setLoadingMore(true);
        try {
            // 🟢 쿠키 기반 인증: apiFetch 사용
            const params = new URLSearchParams();
            params.set("limit", "30");
            params.set("offset", String(offset));
            if (conceptParam) {
                params.set("concept", conceptParam);
            }

            const { data, response } = await apiFetch(`/api/courses?${params.toString()}`, {
                cache: "force-cache", // 🟢 성능 최적화: 브라우저 캐시 활용
                next: { revalidate: 180 }, // 🟢 성능 최적화: 300초 -> 180초 (3분)
            });

            if (response.ok && data) {
                const coursesArray = Array.isArray(data) ? data : (data as any).courses || [];

                if (coursesArray.length > 0) {
                    setCourses((prev) => {
                        // 🟢 중복 제거 (같은 ID가 있으면 제외)
                        const existingIds = new Set(prev.map((c) => c.id));
                        const newUniqueCourses = coursesArray.filter((c: Course) => !existingIds.has(c.id));
                        return [...prev, ...newUniqueCourses];
                    });
                    setOffset((prev) => prev + 30);
                    // 🟢 30개 미만이면 더 이상 없음
                    setHasMore(coursesArray.length >= 30);
                } else {
                    setHasMore(false);
                }
            } else {
                console.error(`[무한 스크롤] API 오류 (${response.status}):`, data);
                setHasMore(false);
            }
        } catch (error) {
            console.error("추가 코스 로드 실패:", error);
            setHasMore(false);
        } finally {
            setLoadingMore(false);
        }
    }, [loadingMore, hasMore, offset, conceptParam]);

    // 🟢 스크롤 감지: 바닥에 도달하면 추가 로드 (throttle 적용)
    useEffect(() => {
        let ticking = false;

        const handleScroll = () => {
            if (ticking || loadingMore || !hasMore) return;
            ticking = true;

            requestAnimationFrame(() => {
                const scrollHeight = document.documentElement.scrollHeight;
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                const clientHeight = document.documentElement.clientHeight;

                // 🟢 바닥에서 300px 전에 미리 로드 (더 빠른 반응)
                if (scrollTop + clientHeight >= scrollHeight - 300) {
                    console.log(
                        `[무한 스크롤] 스크롤 감지: 바닥 근처 도달 (${Math.round(
                            scrollTop + clientHeight
                        )}/${scrollHeight})`
                    );
                    loadMoreCourses();
                }
                ticking = false;
            });
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, [loadMoreCourses, loadingMore, hasMore]);

    // --- Sorting Logic ---
    const sortedCourses = useMemo(() => {
        const list = [...courses];
        if (sortBy === "views") {
            list.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
        } else {
            list.sort((a: any, b: any) => {
                const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                if (tb !== ta) return tb - ta;
                return Number(b.id) - Number(a.id);
            });
        }
        return list;
    }, [courses, sortBy]);

    const STATIC_CONCEPTS: string[] = useMemo(
        () => [
            "가성비",
            "감성데이트",
            "골목투어",
            "공연·전시",
            "데이트",
            "맛집탐방",
            "문화예술",
            "쇼핑",
            "술자리",
            "실내데이트",
            "야경",
            "이색데이트",
            "인생",
            "인생샷",
            "전통문화",
            "종합",
            "체험",
            "카페투어",
            "테마파크",
            "핫플레이스",
            "힐링",
            "힙스터",
        ],
        []
    );

    // --- Filtering Logic ---
    const visibleCourses = useMemo(() => {
        if (!activeConcept) return sortedCourses;
        const target = activeConcept.trim().toLowerCase();
        return sortedCourses.filter(
            (c) =>
                String(c.concept || "")
                    .trim()
                    .toLowerCase() === target
        );
    }, [sortedCourses, activeConcept]);

    // --- Favorites Logic ---
    useEffect(() => {
        // 🟢 쿠키 기반 인증: authenticatedFetch 사용
        authenticatedFetch<any[]>("/api/users/favorites", {
            next: { revalidate: 300 },
        })
            .then((list) => {
                if (list) {
                    const ids = new Set<number>();
                    (list || []).forEach((f: any) => {
                        const id = Number(f?.course?.id ?? f?.course_id ?? f?.courseId ?? f?.id);
                        if (Number.isFinite(id)) ids.add(id);
                    });
                    setFavoriteIds(ids);
                }
            })
            .catch(() => {});
    }, []);

    const toggleFavorite = async (e: React.MouseEvent, courseId: string | number) => {
        e.stopPropagation();
        const idNum = Number(courseId);
        const liked = favoriteIds.has(idNum);
        try {
            // 🟢 쿠키 기반 인증: authenticatedFetch 사용
            if (!liked) {
                const success = await authenticatedFetch("/api/users/favorites", {
                    method: "POST",
                    body: JSON.stringify({ courseId: idNum }),
                });
                if (success !== null) {
                    setFavoriteIds((prev) => {
                        const s = new Set(prev);
                        s.add(idNum);
                        return s;
                    });
                } else {
                    // 인증 실패 시 로그인 페이지로 이동
                    if (confirm("로그인이 필요합니다.")) router.push("/login");
                }
            } else {
                const success = await authenticatedFetch(`/api/users/favorites?courseId=${idNum}`, {
                    method: "DELETE",
                });
                if (success !== null) {
                    setFavoriteIds((prev) => {
                        const s = new Set(prev);
                        s.delete(idNum);
                        return s;
                    });
                }
            }
        } catch {}
    };

    // handleLockedClick 제거됨 (CourseCard 내부로 이동)

    return (
        <div className="min-h-screen bg-[#F8F9FA]">
            {/* Header */}
            <div className="bg-white px-5 pt-6 pb-2 sticky top-0 z-30 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <div className="flex justify-between items-end mb-4">
                    <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight leading-none">완벽한 하루</h1>
                    <div className="flex items-center gap-3 text-sm">
                        <button
                            onClick={() => setSortBy("views")}
                            className={`${
                                sortBy === "views" ? "font-bold text-emerald-600" : "font-medium text-gray-400"
                            } transition-colors`}
                        >
                            인기순
                        </button>
                        <span className="text-gray-200 text-xs">|</span>
                        <button
                            onClick={() => setSortBy("latest")}
                            className={`${
                                sortBy === "latest" ? "font-bold text-emerald-600" : "font-medium text-gray-400"
                            } transition-colors`}
                        >
                            최신순
                        </button>
                    </div>
                </div>

                {/* Concept Chips */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 -mx-5 px-5">
                    <button
                        onMouseEnter={() => {
                            // 🟢 호버 시 prefetch로 빠른 전환
                            if (activeConcept !== "") {
                                router.prefetch("/courses");
                            }
                        }}
                        onClick={() => {
                            router.push("/courses");
                        }}
                        className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all border ${
                            activeConcept === ""
                                ? "bg-emerald-600 text-white border-emerald-600"
                                : "bg-white text-gray-500 border-gray-200 hover:border-emerald-600 hover:text-emerald-600"
                        }`}
                    >
                        전체
                    </button>

                    {STATIC_CONCEPTS.map((tag) => (
                        <button
                            key={tag}
                            onMouseEnter={() => {
                                // 🟢 호버 시 prefetch로 빠른 전환
                                if (activeConcept !== tag) {
                                    router.prefetch(`/courses?concept=${encodeURIComponent(tag)}`);
                                }
                            }}
                            onClick={() => {
                                if (activeConcept === tag) {
                                    router.push("/courses");
                                } else {
                                    router.push(`/courses?concept=${encodeURIComponent(tag)}`);
                                }
                            }}
                            className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all border ${
                                activeConcept === tag
                                    ? "bg-emerald-600 text-white border-emerald-600"
                                    : "bg-white text-gray-500 border-gray-200 hover:border-emerald-600 hover:text-emerald-600"
                            }`}
                        >
                            {tag}
                        </button>
                    ))}
                </div>
            </div>

            {/* List Area */}
            <div className="px-5 py-6 space-y-6">
                {visibleCourses.map((course, i) => (
                    <CourseCard
                        key={course.id}
                        course={course}
                        isPriority={i < 2}
                        isFavorite={favoriteIds.has(Number(course.id))}
                        onToggleFavorite={toggleFavorite}
                        // onLockedClick 제거
                        showNewBadge={true}
                        // Courses 페이지에는 휴무일 로직이 따로 없으므로 생략
                    />
                ))}

                {visibleCourses.length === 0 && (
                    <div className="text-center py-20">
                        <div className="text-5xl mb-4 grayscale opacity-50">🏝️</div>
                        <p className="text-gray-500 font-medium">조건에 맞는 코스가 없어요.</p>
                    </div>
                )}

                {/* 🟢 무한 스크롤 로딩 인디케이터 */}
                {loadingMore && (
                    <div className="text-center py-8">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                        <p className="text-gray-500 text-sm mt-2">더 많은 코스를 불러오는 중...</p>
                    </div>
                )}

                {!hasMore && visibleCourses.length > 0 && (
                    <div className="text-center py-8">
                        <p className="text-gray-400 text-sm">모든 코스를 불러왔습니다.</p>
                    </div>
                )}
            </div>
            {/* 결제 모달 제거 (CourseCard 내부로 이동) */}
        </div>
    );
}
