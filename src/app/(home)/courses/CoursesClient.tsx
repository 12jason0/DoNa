"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useMemo, useCallback, useDeferredValue, useRef } from "react"; // 🟢 useDeferredValue 추가
import CourseCard from "@/components/CourseCard";
import CourseReportBanner from "@/components/CourseReportBanner";
import HeroSlider from "@/components/HeroSlider";
import TapFeedback from "@/components/TapFeedback";
import { apiFetch, authenticatedFetch } from "@/lib/authClient";
import { CATEGORY_ICONS } from "@/constants/onboardingData";
import { useLocale } from "@/context/LocaleContext";
import { translateCourseConcept } from "@/lib/courseTranslate";
import Image from "@/components/ImageFallback";
import { LayoutGrid } from "lucide-react";
import CourseLoadingOverlay from "@/components/CourseLoadingOverlay";
import { getPlaceStatus } from "@/lib/placeStatus";

// --- Type Definitions (기존과 100% 동일) ---
type PlaceClosedDay = { day_of_week: number | null; specific_date: Date | string | null; note?: string | null };
type Place = {
    id: number;
    name: string;
    imageUrl?: string;
    latitude?: number;
    longitude?: number;
    opening_hours?: string | null;
    closed_days?: PlaceClosedDay[];
    reservationUrl?: string | null;
};
type CoursePlace = { order_index: number; place: Place | null };
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
    grade?: "FREE" | "BASIC" | "PREMIUM";
    isLocked?: boolean;
}
type HeroSliderItem = {
    id: string;
    imageUrl?: string;
    location?: string;
    concept?: string;
    title?: string;
    tags?: string[];
};

interface CoursesClientProps {
    initialCourses: Course[];
    initialHeroCourses?: HeroSliderItem[];
}

export default function CoursesClient({ initialCourses, initialHeroCourses = [] }: CoursesClientProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { t } = useLocale();
    const conceptParam = searchParams.get("concept");

    const [courses, setCourses] = useState<Course[]>(initialCourses);
    const [activeConcept, setActiveConcept] = useState<string>(conceptParam || "");
    const [isNavigating, setIsNavigating] = useState(false); // 🟢 네비게이션 로딩 상태

    // 🟢 [Optimization 1] 낮은 우선순위 업데이트 처리
    // 필터 변경 시 무거운 렌더링을 뒤로 미뤄 브라우저 멈춤(Violation) 현상을 방지합니다.
    const deferredConcept = useDeferredValue(activeConcept);

    const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(initialCourses.length >= 30);
    const [offset, setOffset] = useState(30);
    const loadMoreRef = useRef<HTMLDivElement | null>(null);

    // 카테고리 마우스 드래그 스크롤
    const categoryScrollRef = useRef<HTMLDivElement | null>(null);
    const [categoryIsDragging, setCategoryIsDragging] = useState(false);
    const categoryDragRef = useRef({ x: 0, scrollLeft: 0 });
    const categoryDidDragRef = useRef(false);

    const handleCategoryMouseDown = useCallback((e: React.MouseEvent) => {
        if (!categoryScrollRef.current) return;
        setCategoryIsDragging(true);
        categoryDidDragRef.current = false;
        categoryDragRef.current = {
            x: e.clientX,
            scrollLeft: categoryScrollRef.current.scrollLeft,
        };
    }, []);

    const handleCategoryMouseMove = useCallback(
        (e: MouseEvent) => {
            if (!categoryIsDragging || !categoryScrollRef.current) return;
            const dx = e.clientX - categoryDragRef.current.x;
            if (Math.abs(dx) > 5) categoryDidDragRef.current = true;
            categoryScrollRef.current.scrollLeft = categoryDragRef.current.scrollLeft - dx;
        },
        [categoryIsDragging],
    );

    const handleCategoryMouseUp = useCallback(() => {
        setCategoryIsDragging(false);
    }, []);

    useEffect(() => {
        if (!categoryIsDragging) return;
        window.addEventListener("mousemove", handleCategoryMouseMove);
        window.addEventListener("mouseup", handleCategoryMouseUp);
        return () => {
            window.removeEventListener("mousemove", handleCategoryMouseMove);
            window.removeEventListener("mouseup", handleCategoryMouseUp);
        };
    }, [categoryIsDragging, handleCategoryMouseMove, handleCategoryMouseUp]);

    useEffect(() => {
        // 🟢 concept 파라미터 변경 시 로딩 상태 설정
        if (conceptParam && conceptParam !== activeConcept) {
            setIsNavigating(true);
        }
        setActiveConcept(conceptParam || "");
        // 🟢 초기 데이터가 로드되면 로딩 해제
        if (initialCourses.length > 0) {
            setTimeout(() => setIsNavigating(false), 100);
        }
    }, [conceptParam, activeConcept, initialCourses.length]);

    // 🟢 [Optimization]: 초기 코스 데이터 설정을 다음 프레임으로 지연
    useEffect(() => {
        // 초기 렌더링은 즉시, 상태 업데이트는 다음 프레임에서
        requestAnimationFrame(() => {
            setCourses(initialCourses);
            setHasMore(initialCourses.length >= 30);
            setOffset(30);
            // 🟢 데이터 로드 완료 시 로딩 해제
            setIsNavigating(false);
        });
    }, [initialCourses]);

    // [Optimization] 무한 스크롤 로직 (기존 기능 유지)
    const loadMoreCourses = useCallback(async () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        try {
            const params = new URLSearchParams();
            params.set("limit", "30");
            params.set("offset", String(offset));
            if (conceptParam) params.set("concept", conceptParam);

            const { data, response } = await apiFetch<{ data?: Course[]; courses?: Course[] }>(
                `/api/courses?${params.toString()}`,
                {
                    cache: "no-store", // 🟢 로드 더보기는 항상 최신 데이터 (캐시로 인한 중복/빈 목록 방지)
                },
            );

            if (response.ok && data) {
                const raw = Array.isArray(data) ? data : ((data as any)?.data ?? (data as any)?.courses ?? []);
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
                    setOffset((prev) => prev + 30);
                    setHasMore(normalized.length >= 30);
                } else {
                    setHasMore(false);
                }
            } else {
                setHasMore(false);
            }
        } catch (error) {
            setHasMore(false);
        } finally {
            setLoadingMore(false);
        }
    }, [loadingMore, hasMore, offset, conceptParam]);

    // IntersectionObserver 기반 무한 스크롤 (레이아웃 측정/리플로우 최소화)
    useEffect(() => {
        if (!loadMoreRef.current) return;
        const sentinel = loadMoreRef.current;
        let pending = false;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (!entry || !entry.isIntersecting) return;
                if (pending || loadingMore || !hasMore) return;
                pending = true;
                Promise.resolve(loadMoreCourses()).finally(() => {
                    pending = false;
                });
            },
            { root: null, rootMargin: "400px", threshold: 0 },
        );

        observer.observe(sentinel);
        return () => {
            observer.disconnect();
        };
    }, [loadMoreRef, loadMoreCourses, loadingMore, hasMore]);

    // 🟢 필터링 (카테고리 선택 시)
    const visibleCourses = useMemo(() => {
        let filtered = courses;
        if (deferredConcept && deferredConcept.trim()) {
            const target = deferredConcept.trim().toLowerCase();
            filtered = courses.filter((c) => {
                const concept = c.concept || "";
                return concept.trim().toLowerCase() === target;
            });
        }
        return [...filtered].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    }, [courses, deferredConcept]);

    const STATIC_CONCEPTS = useMemo(
        () => [
            "가성비",
            "감성데이트",
            "골목투어",
            "공연·전시",
            "맛집탐방",
            "문화예술",
            "쇼핑",
            "술자리",
            "실내데이트",
            "야경",
            "이색데이트",
            "인생샷",
            "전통문화",
            "기타",
            "체험",
            "카페투어",
            "테마파크",
            "핫플레이스",
            "힐링",
            "힙스터",
        ],
        [],
    );

    // 🟢 [Performance]: 카테고리 라벨 번역을 locale당 1회만 계산 (매 렌더마다 20회 호출 제거)
    const translatedConcepts = useMemo(() => {
        const fn = (k: string) => t(k as any);
        return new Map(STATIC_CONCEPTS.map((tag) => [tag, translateCourseConcept(tag, fn)]));
    }, [t, STATIC_CONCEPTS]);

    // 🟢 [Optimization]: 찜 목록 로딩을 200ms 지연하여 초기 렌더링 부하 감소
    useEffect(() => {
        const timer = setTimeout(() => {
            authenticatedFetch<any[]>("/api/users/favorites", { next: { revalidate: 300 } })
                .then((list) => {
                    if (list) {
                        // 다음 프레임에서 상태 업데이트하여 렌더링 부하 분산
                        requestAnimationFrame(() => {
                            const ids = new Set<number>();
                            list.forEach((f: any) => {
                                const id = Number(f?.course?.id ?? f?.course_id ?? f?.courseId ?? f?.id);
                                if (Number.isFinite(id)) ids.add(id);
                            });
                            setFavoriteIds(ids);
                        });
                    }
                })
                .catch(() => {});
        }, 200);

        return () => clearTimeout(timer);
    }, []);

    const toggleFavorite = useCallback(
        async (e: React.MouseEvent, courseId: string | number) => {
            e.stopPropagation();
            const idNum = Number(courseId);
            const liked = favoriteIds.has(idNum);
            try {
                if (!liked) {
                    const success = await authenticatedFetch("/api/users/favorites", {
                        method: "POST",
                        body: JSON.stringify({ courseId: idNum }),
                    });
                    if (success !== null) setFavoriteIds((prev) => new Set(prev).add(idNum));
                    else if (confirm(t("courses.loginRequired"))) router.push("/login");
                } else {
                    const success = await authenticatedFetch(`/api/users/favorites?courseId=${idNum}`, {
                        method: "DELETE",
                    });
                    if (success !== null)
                        setFavoriteIds((prev) => {
                            const s = new Set(prev);
                            s.delete(idNum);
                            return s;
                        });
                }
            } catch {}
        },
        [favoriteIds, router, t],
    );

    return (
        <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0f1710]">
            <div
                className="bg-white dark:bg-[#1a241b] px-5 pb-1.5 sticky z-30 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-gray-900/20 pt-[calc(env(safe-area-inset-top,0)+1.25rem)] top-[env(safe-area-inset-top,0)]"
            >
                <div>
                    <h1 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-none">
                        {t("courses.pageTitle")}
                    </h1>
                </div>
                {/* 🟢 큰 원형 아이콘 + 아래 텍스트 (예전 메인 카테고리 스타일) */}
                <div
                    ref={categoryScrollRef}
                    className={`flex gap-3 overflow-x-auto no-scrollbar pb-1.5 -mx-5 px-5 mt-3 touch-pan-x select-none ${
                        categoryIsDragging ? "cursor-grabbing" : "cursor-grab"
                    }`}
                    style={{ WebkitOverflowScrolling: "touch" }}
                    onMouseDown={handleCategoryMouseDown}
                >
                    <TapFeedback>
                        <button
                            onClick={() => {
                                if (categoryDidDragRef.current) return;
                                requestAnimationFrame(() => {
                                    setIsNavigating(true);
                                    router.prefetch("/courses");
                                    router.push("/courses");
                                });
                            }}
                            disabled={isNavigating}
                            className={`flex flex-col items-center gap-1 shrink-0 ${
                                isNavigating ? "opacity-50 cursor-wait" : ""
                            }`}
                        >
                            <div
                                className={`w-10 h-10 rounded-full p-1 flex items-center justify-center shrink-0 border-2 transition-all ${
                                    activeConcept === ""
                                        ? "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-500 dark:border-emerald-600"
                                        : "bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700"
                                }`}
                            >
                                <LayoutGrid
                                    size={18}
                                    className={
                                        activeConcept === ""
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : "text-gray-500 dark:text-gray-400"
                                    }
                                />
                            </div>
                            <span
                                className={`text-xs font-semibold whitespace-nowrap ${
                                    activeConcept === ""
                                        ? "text-emerald-700 dark:text-emerald-400"
                                        : "text-gray-600 dark:text-gray-400"
                                }`}
                            >
                                {t("courses.all")}
                            </span>
                        </button>
                    </TapFeedback>
                    {STATIC_CONCEPTS.map((tag) => {
                        const iconUrl = CATEGORY_ICONS[tag];
                        const isSelected = activeConcept === tag;
                        return (
                            <TapFeedback key={tag}>
                                <button
                                    onClick={() => {
                                        if (categoryDidDragRef.current) return;
                                        requestAnimationFrame(() => {
                                            setIsNavigating(true);
                                            const targetPath = isSelected
                                                ? "/courses"
                                                : `/courses?concept=${encodeURIComponent(tag)}`;
                                            router.prefetch(targetPath);
                                            router.push(targetPath);
                                        });
                                    }}
                                    disabled={isNavigating}
                                    className={`flex flex-col items-center gap-1 shrink-0 ${
                                        isNavigating ? "opacity-50 cursor-wait" : ""
                                    }`}
                                >
                                    <div
                                        className={`w-10 h-10 rounded-full p-1 flex items-center justify-center shrink-0 border-2 transition-all overflow-hidden ${
                                            isSelected
                                                ? "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-500 dark:border-emerald-600"
                                                : "bg-gray-50 dark:bg-gray-800/60 border-gray-100 dark:border-gray-700"
                                        }`}
                                    >
                                        {iconUrl ? (
                                            <Image
                                                src={iconUrl}
                                                alt={translatedConcepts.get(tag) ?? tag}
                                                width={40}
                                                height={40}
                                                className="object-contain p-0.5"
                                                quality={70}
                                            />
                                        ) : (
                                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 truncate px-1">
                                                {tag.slice(0, 1)}
                                            </span>
                                        )}
                                    </div>
                                    <span
                                        className={`text-xs font-semibold whitespace-nowrap ${
                                            isSelected
                                                ? "text-emerald-700 dark:text-emerald-400"
                                                : "text-gray-600 dark:text-gray-400"
                                        }`}
                                    >
                                        {translatedConcepts.get(tag) ?? tag}
                                    </span>
                                </button>
                            </TapFeedback>
                        );
                    })}
                </div>
            </div>

            {/* 🟢 HeroSlider - 지금 많이 선택한 코스 */}
            {initialHeroCourses.length > 0 && (
                <section className="pt-4 px-4 pb-6">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3 leading-snug tracking-tight px-1">
                        {t("courses.heroTitle")}
                    </h2>
                    <HeroSlider items={initialHeroCourses} />
                </section>
            )}

            {/* 🟢 구분선 + 코스 리스트 영역 */}
            <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a241b]">
                <div className="px-5 pt-6 pb-2">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-snug tracking-tight">
                        {t("courses.allCourses")}
                    </h2>
                </div>
                <div className="px-5 py-4 flex flex-col gap-6">
                    {/* 🟢 [Performance]: 네비게이션 로딩 표시 */}
                    {isNavigating && <CourseLoadingOverlay />}
                    {/* 🟢 [Optimization 3] 반복되는 컴포넌트 렌더링 최적화 */}
                    {visibleCourses.map((course, i) => {
                        // 🟢 코스 5개마다 제보 유도 배너 삽입
                        const shouldShowBanner = i > 0 && i % 5 === 0;
                        return (
                            <div key={course.id}>
                                {shouldShowBanner && (
                                    <div className="mb-6">
                                        <CourseReportBanner />
                                    </div>
                                )}
                                <TapFeedback className="block w-full">
                                    <CourseCard
                                        course={course}
                                        isPriority={i < 4}
                                        isFavorite={favoriteIds.has(Number(course.id))}
                                        onToggleFavorite={toggleFavorite}
                                        showNewBadge={true}
                                        hasClosedPlace={(c) =>
                                            (c.coursePlaces ?? []).some(
                                                (cp: CoursePlace) =>
                                                    cp.place &&
                                                    getPlaceStatus(
                                                        cp.place.opening_hours || null,
                                                        cp.place.closed_days || [],
                                                    ).status === "휴무",
                                            )
                                        }
                                        getClosedPlaceCount={(c) =>
                                            (c.coursePlaces ?? []).filter(
                                                (cp: CoursePlace) =>
                                                    cp.place &&
                                                    getPlaceStatus(
                                                        cp.place.opening_hours || null,
                                                        cp.place.closed_days || [],
                                                    ).status === "휴무",
                                            ).length
                                        }
                                    />
                                </TapFeedback>
                            </div>
                        );
                    })}
                    {visibleCourses.length === 0 && (
                        <div className="text-center py-20">
                            <div className="text-5xl mb-4 grayscale opacity-50">🏝️</div>
                            <p className="text-gray-500 dark:text-gray-400 font-medium">{t("courses.noResults")}</p>
                        </div>
                    )}
                    {loadingMore && (
                        <div className="text-center py-8">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">{t("courses.loadingMore")}</p>
                        </div>
                    )}
                    {!hasMore && visibleCourses.length > 0 && (
                        <div className="text-center py-8">
                            <p className="text-gray-400 dark:text-gray-500 text-sm">{t("courses.allLoaded")}</p>
                        </div>
                    )}
                    <div ref={loadMoreRef} aria-hidden="true" className="h-1"></div>
                </div>
            </div>
        </div>
    );
}
