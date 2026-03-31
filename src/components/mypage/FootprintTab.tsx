"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import Image from "@/components/ImageFallback";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { useLocale } from "@/context/LocaleContext";
import { useDragScroll } from "@/hooks/useDragScroll";
import { CasefileItem, CompletedCourse } from "@/types/user";
// 🟢 [Fix]: 누락된 아이콘 컴포넌트 임포트 추가
import { CheckCircle, Sparkles, MapPin, Zap, ChevronRight } from "lucide-react";

// 🟢 코스 이미지 로더 컴포넌트 (이미지가 없을 때 백그라운드에서 로드)
// 🟢 성능 최적화: 탭이 활성화되었을 때만 이미지 로드
const CourseImageLoader = ({
    courseId,
    onImageLoaded,
    isVisible = true, // 🟢 탭이 활성화되었는지 여부
}: {
    courseId: number | string;
    onImageLoaded: (url: string) => void;
    isVisible?: boolean; // 🟢 탭 활성화 여부
}) => {
    const [loadedImageUrl, setLoadedImageUrl] = useState<string | null>(null);

    useEffect(() => {
        // 🟢 탭이 활성화되지 않았으면 이미지 로드하지 않음
        if (!isVisible) return;

        const loadImage = async () => {
            try {
                const res = await fetch(`/api/courses/${courseId}`);
                if (res.ok) {
                    const data = await res.json();
                    const imageUrl =
                        data.imageUrl?.trim() ||
                        data.coursePlaces?.[0]?.place?.imageUrl?.trim() ||
                        data.coursePlaces?.[0]?.place?.image_url?.trim() ||
                        "";
                    if (imageUrl) {
                        setLoadedImageUrl(imageUrl);
                        onImageLoaded(imageUrl);
                    }
                }
            } catch (error) {
                console.error("Failed to load course image:", error);
            }
        };
        loadImage();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [courseId, isVisible]); // 🟢 isVisible 의존성 추가

    // 🟢 탭이 활성화되지 않았으면 플레이스홀더만 표시
    if (!isVisible) {
        return <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl">📍</div>;
    }

    // 이미지가 로드되면 Image 컴포넌트로 표시
    if (loadedImageUrl) {
        return (
            <Image
                src={loadedImageUrl}
                alt="Course"
                fill
                className="object-cover"
                sizes="64px"
                loading="lazy"
                fallbackContent={
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl">📍</div>
                }
            />
        );
    }

    return <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl">📍</div>;
};

/** 🟢 가로/세로 극단 비율이면 object-cover, 보통 비율(0.5~2)이면 object-contain */
const ASPECT_RATIO_MIN = 0.5;
const ASPECT_RATIO_MAX = 2;

const AspectAwareMemoryImage = memo(
    ({
        src,
        alt,
        className = "",
        ...rest
    }: {
        src: string;
        alt: string;
        className?: string;
        [key: string]: unknown;
    }) => {
        const [objectFit, setObjectFit] = useState<"cover" | "contain">("cover");

        const handleLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
            const img = e.currentTarget;
            const w = img.naturalWidth;
            const h = img.naturalHeight;
            if (!h || !w) return;
            const ratio = w / h;
            const fit = ratio >= ASPECT_RATIO_MIN && ratio <= ASPECT_RATIO_MAX ? "contain" : "cover";
            setObjectFit(fit);
        }, []);

        const fitClass = objectFit === "contain" ? "object-contain" : "object-cover";
        return (
            <Image
                src={src}
                alt={alt}
                fill
                className={`${fitClass} ${className}`.trim()}
                onLoad={handleLoad}
                {...rest}
            />
        );
    },
);
AspectAwareMemoryImage.displayName = "AspectAwareMemoryImage";

interface FootprintTabProps {
    casefiles: CasefileItem[];
    completed: CompletedCourse[];
    aiRecommendations?: any[]; // 🟢 오늘의 데이트 추천 코스 (savedCourses)
    userName?: string; // 🟢 사용자 이름
    personalStories?: any[]; // 🟢 개인 추억 (isPublic: false인 리뷰)
}

const FootprintTab = ({
    casefiles,
    completed,
    aiRecommendations = [],
    userName: userNameProp,
    personalStories = [],
}: FootprintTabProps) => {
    const { t } = useLocale();
    const userName = userNameProp || t("mypage.footprintTab.defaultUser");
    const router = useRouter();
    const searchParams = useSearchParams();
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    // 🟢 함수형 초기화로 매 렌더링마다 new Date() 호출 방지
    const [currentMonth, setCurrentMonth] = useState(() => new Date());
    const [showMonthDropdown, setShowMonthDropdown] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState<CompletedCourse | null>(null);
    const [showCourseModal, setShowCourseModal] = useState(false);
    const [courseDetail, setCourseDetail] = useState<any>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [showDateCoursesModal, setShowDateCoursesModal] = useState(false);
    // 🟢 각 코스의 이미지 URL을 저장 (코스 ID -> 이미지 URL)
    const [courseImages, setCourseImages] = useState<Record<number | string, string>>({});
    // 🟢 서브 탭 상태 (달력, 추억) - URL 파라미터에 따라 초기값 설정
    const [activeView, setActiveView] = useState<"calendar" | "memories">(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            return params.get("view") === "memories" ? "memories" : "calendar";
        }
        return "calendar";
    });
    // 🟢 추억 상세 모달 상태
    const [selectedMemory, setSelectedMemory] = useState<any | null>(null);
    const [showMemoryModal, setShowMemoryModal] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const memoryScrollRef = useRef<HTMLDivElement>(null);
    const memoryDragHandlers = useDragScroll(memoryScrollRef, showMemoryModal);

    // 🟢 URL 파라미터에서 추억 ID를 읽어서 자동으로 모달 열기
    useEffect(() => {
        const viewParam = searchParams.get("view");
        const memoryIdParam = searchParams.get("id");

        // view=memories가 있으면 추억 탭으로 전환
        if (viewParam === "memories") {
            setActiveView("memories");

            // id 파라미터가 있고 추억이 있으면 모달 열기
            if (memoryIdParam && personalStories.length > 0) {
                const memoryId = Number(memoryIdParam);
                const foundMemory = personalStories.find((story: any) => story.id === memoryId);

                if (foundMemory) {
                    setSelectedMemory(foundMemory);
                    setShowMemoryModal(true);

                    // URL에서 id 파라미터 제거 (모달이 닫힐 때 다시 열리지 않도록)
                    const newSearchParams = new URLSearchParams(searchParams.toString());
                    newSearchParams.delete("id");
                    const newUrl = newSearchParams.toString()
                        ? `/mypage?tab=footprint&view=memories&${newSearchParams.toString()}`
                        : `/mypage?tab=footprint&view=memories`;
                    router.replace(newUrl, { scroll: false });
                }
            }
        }
    }, [searchParams, personalStories, router]);

    // 🟢 모달이 열릴 때 첫 번째 사진으로 스크롤
    useEffect(() => {
        if (showMemoryModal && memoryScrollRef.current) {
            setCurrentImageIndex(0);
            memoryScrollRef.current.scrollLeft = 0;
        }
    }, [showMemoryModal]);

    // 🟢 앱 네이티브: 추억 상세(사진 보기) 모달 열림/닫힘 시 상태바 검은색 전환
    useEffect(() => {
        if (typeof window !== "undefined" && (window as any).ReactNativeWebView) {
            (window as any).ReactNativeWebView.postMessage(
                JSON.stringify({ type: showMemoryModal ? "memoryDetailOpen" : "memoryDetailClose" }),
            );
        }
        return () => {
            if (typeof window !== "undefined" && (window as any).ReactNativeWebView) {
                (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: "memoryDetailClose" }));
            }
        };
    }, [showMemoryModal]);

    // 🟢 앱 네이티브: 발자취 달력 클릭 시 뜨는 추천 코스 모달 / 코스 상세 모달 열림/닫힘 시 광고 숨김
    const anyModalOpen = showDateCoursesModal || showCourseModal;
    useEffect(() => {
        if (typeof window !== "undefined" && (window as any).ReactNativeWebView) {
            (window as any).ReactNativeWebView.postMessage(
                JSON.stringify({
                    type: anyModalOpen ? "dateCoursesModalOpen" : "dateCoursesModalClose",
                }),
            );
        }
        return () => {
            if (typeof window !== "undefined" && (window as any).ReactNativeWebView) {
                (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: "dateCoursesModalClose" }));
            }
        };
    }, [anyModalOpen]);

    // 🟢 드래그 기능을 위한 상태
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const [touchEndX, setTouchEndX] = useState<number | null>(null);
    // 🟢 가로 스크롤 컨테이너 ref
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const dateCoursesDragHandlers = useDragScroll(scrollContainerRef, showDateCoursesModal);

    // 🟢 날짜별로 완료 항목 그룹화 (개인 추억 제외)
    const itemsByDate = useMemo(() => {
        const map = new Map<string, { courses: CompletedCourse[]; aiRecommendations: any[] }>();

        completed.forEach((course) => {
            if (course.completedAt) {
                const date = new Date(course.completedAt);
                const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
                    date.getDate(),
                ).padStart(2, "0")}`;
                if (!map.has(dateKey)) {
                    map.set(dateKey, { courses: [], aiRecommendations: [] });
                }
                map.get(dateKey)!.courses.push(course);
            }
        });

        // 🟢 오늘의 데이트 추천 코스는 savedAt 기준으로 그룹화
        aiRecommendations.forEach((item) => {
            const savedAt = item.savedAt || item.course?.createdAt;
            if (savedAt) {
                const date = new Date(savedAt);
                const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
                    date.getDate(),
                ).padStart(2, "0")}`;
                if (!map.has(dateKey)) {
                    map.set(dateKey, { courses: [], aiRecommendations: [] });
                }
                map.get(dateKey)!.aiRecommendations.push(item);
            }
        });

        return map;
    }, [completed, aiRecommendations]);

    // 🟢 달력 날짜 생성
    const calendarDays = useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - startDate.getDay()); // 해당 월의 첫 번째 일요일

        const days: Array<{ date: Date; isCurrentMonth: boolean; dateKey: string; hasItems: boolean }> = [];
        const currentDate = new Date(startDate);

        for (let i = 0; i < 42; i++) {
            const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(
                2,
                "0",
            )}-${String(currentDate.getDate()).padStart(2, "0")}`;
            days.push({
                date: new Date(currentDate),
                isCurrentMonth: currentDate.getMonth() === month,
                dateKey,
                hasItems: itemsByDate.has(dateKey),
            });
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return days;
    }, [currentMonth, itemsByDate]);

    // 🟢 선택한 날짜의 완료 항목 (개인 추억 제외)
    const selectedDateItems = useMemo(() => {
        if (!selectedDate) return null;
        const dateKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(
            selectedDate.getDate(),
        ).padStart(2, "0")}`;
        return itemsByDate.get(dateKey) || { courses: [], aiRecommendations: [] };
    }, [selectedDate, itemsByDate]);

    // 🟢 데이터가 있는지 확인 (데이터가 없으면 라이트 모드로 표시)
    const hasData = useMemo(() => {
        if (activeView === "calendar") {
            return completed.length > 0 || aiRecommendations.length > 0;
        } else {
            return personalStories.length > 0;
        }
    }, [completed, aiRecommendations, personalStories, activeView]);

    const monthNames = useMemo(
        () =>
            [
                t("mypage.footprintTab.month1"),
                t("mypage.footprintTab.month2"),
                t("mypage.footprintTab.month3"),
                t("mypage.footprintTab.month4"),
                t("mypage.footprintTab.month5"),
                t("mypage.footprintTab.month6"),
                t("mypage.footprintTab.month7"),
                t("mypage.footprintTab.month8"),
                t("mypage.footprintTab.month9"),
                t("mypage.footprintTab.month10"),
                t("mypage.footprintTab.month11"),
                t("mypage.footprintTab.month12"),
            ],
        [t],
    );
    const dayNames = useMemo(
        () =>
            [
                t("mypage.footprintTab.day0"),
                t("mypage.footprintTab.day1"),
                t("mypage.footprintTab.day2"),
                t("mypage.footprintTab.day3"),
                t("mypage.footprintTab.day4"),
                t("mypage.footprintTab.day5"),
                t("mypage.footprintTab.day6"),
            ],
        [t],
    );

    const prevMonth = useCallback(() => {
        setCurrentMonth((prev) => {
            const newDate = new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
            return newDate;
        });
        setShowMonthDropdown(false);
    }, []);

    const nextMonth = useCallback(() => {
        setCurrentMonth((prev) => {
            const newDate = new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
            return newDate;
        });
        setShowMonthDropdown(false);
    }, []);

    // 🟢 드래그 끝 - 월 변경 처리 (ref 사용으로 최적화)
    const touchStartXRef = useRef<number | null>(null);
    const touchEndXRef = useRef<number | null>(null);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        touchEndXRef.current = null;
        touchStartXRef.current = e.targetTouches[0].clientX;
        setTouchEndX(null);
        setTouchStartX(touchStartXRef.current);
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        touchEndXRef.current = e.targetTouches[0].clientX;
        setTouchEndX(touchEndXRef.current);
    }, []);

    const handleTouchEnd = useCallback(() => {
        const startX = touchStartXRef.current;
        const endX = touchEndXRef.current;

        if (!startX || !endX) {
            setTouchStartX(null);
            setTouchEndX(null);
            return;
        }

        const distance = startX - endX;
        const minSwipeDistance = 50;

        if (distance > minSwipeDistance) {
            nextMonth();
        }
        if (distance < -minSwipeDistance) {
            prevMonth();
        }

        touchStartXRef.current = null;
        touchEndXRef.current = null;
        setTouchStartX(null);
        setTouchEndX(null);
    }, [nextMonth, prevMonth]);

    // 🟢 월 선택 핸들러
    const handleMonthSelect = useCallback((monthIndex: number) => {
        setCurrentMonth((prev) => new Date(prev.getFullYear(), monthIndex, 1));
        setShowMonthDropdown(false);
    }, []);

    // 🟢 코스 이미지 ref로 관리하여 불필요한 재생성 방지
    const courseImagesRef = useRef<Record<number | string, string>>({});
    courseImagesRef.current = courseImages;

    // 🟢 코스 이미지 가져오기 (코스 이미지가 없으면 첫 번째 장소 이미지 사용) - 최적화
    const getCourseImage = useCallback(
        async (courseId: number | string): Promise<string> => {
            // 이미 캐시된 이미지가 있으면 반환
            if (courseImagesRef.current[courseId]) {
                return courseImagesRef.current[courseId];
            }

            try {
                // 🟢 캐시 우선 사용 및 빠른 응답을 위한 최적화
                const res = await fetch(`/api/courses/${courseId}`, {
                    cache: "force-cache",
                    next: { revalidate: 300 },
                });
                if (res.ok) {
                    const data = await res.json();
                    const imageUrl =
                        data.imageUrl?.trim() ||
                        data.coursePlaces?.[0]?.place?.imageUrl?.trim() ||
                        data.coursePlaces?.[0]?.place?.image_url?.trim() ||
                        "";

                    if (imageUrl) {
                        // 🟢 이미 있으면 업데이트 안 함
                        if (!courseImagesRef.current[courseId]) {
                            setCourseImages((prev) => {
                                if (prev[courseId]) return prev;
                                return { ...prev, [courseId]: imageUrl };
                            });
                        }
                        return imageUrl;
                    }
                }
            } catch (error) {
                console.error("Failed to fetch course image:", error);
            }
            return "";
        },
        [], // courseImages 의존성 제거
    );

    // 🟢 [Performance]: 모달이 열릴 때 모든 코스 이미지 즉시 병렬 로드
    useEffect(() => {
        if (!showDateCoursesModal || !selectedDateItems) return;

        const allCourses = [
            ...(selectedDateItems.courses || []),
            ...(selectedDateItems.aiRecommendations || []).map((item) => item.course || item),
        ].filter((course) => {
            const courseId = course?.id || course?.course_id;
            return courseId && !courseImagesRef.current[courseId] && !course?.imageUrl;
        });

        if (allCourses.length === 0) return;

        // 🟢 모든 이미지를 즉시 병렬로 로드하여 빠른 표시
        allCourses.forEach((course) => {
            const courseId = course?.id || course?.course_id;
            if (courseId) {
                getCourseImage(courseId).catch(() => {});
            }
        });
    }, [showDateCoursesModal, selectedDateItems, getCourseImage]);

    // 🟢 모달 열릴 때 스크롤 시작 위치
    useEffect(() => {
        if (showDateCoursesModal && scrollContainerRef.current) {
            scrollContainerRef.current.scrollLeft = 0;
        }
    }, [showDateCoursesModal]);

    // 🟢 코스 클릭 핸들러 (최적화: 즉시 기본 정보 표시 후 상세 정보 로드)
    const handleCourseClick = useCallback(
        async (courseId: number | string) => {
            // 🟢 courseId 유효성 검사
            if (!courseId) {
                console.error("[FootprintTab] Missing course ID.");
                return;
            }

            // 🟢 [Optimization]: 이미 있는 코스 정보로 즉시 모달 표시
            const foundCompleted = completed.find((c) => c.course_id === Number(courseId));
            const foundAiRecommendation = aiRecommendations.find(
                (item) => item.course?.id === Number(courseId) || item.course?.course_id === Number(courseId),
            );

            // 🟢 기본 정보로 즉시 모달 표시 (API 응답 전)
            if (foundCompleted) {
                const courseIdValue = foundCompleted.course_id;
                setCourseDetail({
                    id: courseIdValue,
                    title: foundCompleted.title || "",
                    description: foundCompleted.description || "",
                    imageUrl: foundCompleted.imageUrl || "",
                    region: foundCompleted.region || "",
                    concept: foundCompleted.concept || "",
                });
                setSelectedCourse(foundCompleted);
                setShowCourseModal(true);
                setLoadingDetail(false); // 🟢 기본 정보는 이미 있으므로 로딩 완료
            } else if (foundAiRecommendation?.course) {
                const course = foundAiRecommendation.course;
                const courseIdValue = course.id || course.course_id || Number(courseId);
                setCourseDetail({
                    id: courseIdValue,
                    title: course.title || "",
                    description: course.description || "",
                    imageUrl: course.imageUrl || "",
                    region: course.region || "",
                    concept: course.concept || "",
                });
                setSelectedCourse(null); // 🟢 오늘의 데이트 추천은 completed가 아니므로 null
                setShowCourseModal(true);
                setLoadingDetail(false); // 🟢 기본 정보는 이미 있으므로 로딩 완료
            } else {
                // 🟢 정보가 없으면 로딩 상태로 모달 표시
                setCourseDetail({
                    id: Number(courseId),
                    title: "",
                    description: "",
                    imageUrl: "",
                    region: "",
                    concept: "",
                });
                setSelectedCourse(null);
                setLoadingDetail(true);
                setShowCourseModal(true);
            }

            // 🟢 [Optimization]: 백그라운드에서 상세 정보 로드 (인증된 API 호출)
            try {
                // 🟢 인증이 필요한 API 호출
                const { apiFetch } = await import("@/lib/authClient");
                const { data, response } = await apiFetch<any>(`/api/courses/${courseId}`, {
                    cache: "force-cache", // 🟢 캐싱으로 성능 향상
                    next: { revalidate: 300 }, // 🟢 5분간 캐시 유지
                });

                if (response.ok && data) {
                    // 🟢 상세 정보 업데이트 (이미지, 설명 등 보완)
                    setCourseDetail((prev: any) => ({
                        ...prev,
                        ...data,
                        // 🟢 ID가 없으면 유지
                        id: prev?.id || data.id || Number(courseId),
                        // 🟢 이미지가 없으면 상세 정보의 이미지 사용
                        imageUrl: prev?.imageUrl || data.imageUrl || data.coursePlaces?.[0]?.place?.imageUrl || "",
                        // 🟢 설명이 없으면 상세 정보의 설명 사용
                        description: prev?.description || data.description || "",
                        // 🟢 제목이 없으면 상세 정보의 제목 사용
                        title: prev?.title || data.title || "",
                        // 🟢 지역이 없으면 상세 정보의 지역 사용
                        region: prev?.region || data.region || "",
                        // 🟢 컨셉이 없으면 상세 정보의 컨셉 사용
                        concept: prev?.concept || data.concept || "",
                    }));
                } else {
                    console.error("[FootprintTab] Course detail fetch failed:", response.status);
                    // 🟢 API 호출 실패 시 기본 정보라도 유지
                }
            } catch (error) {
                console.error("[FootprintTab] Course detail fetch error:", error);
                // 🟢 에러 발생 시에도 기본 정보는 유지
            } finally {
                setLoadingDetail(false);
            }
        },
        [completed, aiRecommendations],
    );

    return (
        <div className="space-y-6">
            <div
                className={`bg-white dark:bg-[#1a241b] rounded-[24px] shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden relative`}
            >
                {/* 헤더 */}
                <div className="pt-5 pl-5 pr-5 border-gray-50 dark:border-gray-800 bg-white dark:bg-[#1a241b] relative z-10">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">{t("mypage.footprintTab.myFootprint")}</h4>
                        {/* 🟢 서브 탭 (달력, 추억) - 오른쪽 정렬 */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setActiveView("calendar")}
                                className={`px-4 py-2 rounded-full font-medium text-sm transition-all whitespace-nowrap ${
                                    activeView === "calendar"
                                        ? "bg-gray-900 dark:bg-gray-800 text-white"
                                        : "bg-gray-100 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400"
                                }`}
                            >
                                {t("mypage.footprintTab.calendar")}
                            </button>
                            <button
                                onClick={() => setActiveView("memories")}
                                className={`px-4 py-2 rounded-full font-medium text-sm transition-all whitespace-nowrap ${
                                    activeView === "memories"
                                        ? "bg-gray-900 dark:bg-gray-800 text-white"
                                        : "bg-gray-100 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400"
                                }`}
                            >
                                {t("mypage.footprintTab.memories")}
                            </button>
                        </div>
                    </div>
                    <div className="mb-4 pb-4 border-b border-gray-100 dark:border-gray-800"></div>
                    {activeView === "calendar" && (
                        <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm font-medium">
                            {t("mypage.footprintTab.footprintCalendarHint")}
                        </p>
                    )}
                    {activeView === "memories" && (
                        <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm font-medium">
                            {t("mypage.footprintTab.footprintMemoriesHint")}
                        </p>
                    )}
                </div>

                {/* 🟢 달력 영역 또는 추억 영역 */}
                {activeView === "calendar" ? (
                    <div
                        className="p-4 md:p-6"
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                    >
                        {/* 🟢 달력 헤더 (월 네비게이션) - 왼쪽 정렬 */}
                        <div className="flex flex-col mb-4">
                            {/* 년도 표시 (왼쪽 정렬) */}
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                                {currentMonth.getFullYear()}년
                            </div>
                            <div className="relative">
                                <button
                                    onClick={() => setShowMonthDropdown(!showMonthDropdown)}
                                    className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-1 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                                >
                                    {monthNames[currentMonth.getMonth()]} {userName}
                                    <svg
                                        className="w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform"
                                        style={{ transform: showMonthDropdown ? "rotate(180deg)" : "rotate(0deg)" }}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M19 9l-7 7-7-7"
                                        />
                                    </svg>
                                </button>

                                {/* 월 선택 드롭다운 */}
                                {showMonthDropdown && (
                                    <>
                                        {/* 오버레이 */}
                                        <div
                                            className="fixed inset-0 z-10"
                                            onClick={() => setShowMonthDropdown(false)}
                                        />
                                        {/* 드롭다운 메뉴 */}
                                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-white dark:bg-[#1a241b] rounded-lg shadow-lg border border-gray-200 dark:border-gray-800 py-2 z-20 min-w-[120px]">
                                            {monthNames.map((month, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleMonthSelect(idx)}
                                                    className={`w-full text-left px-4 py-2 text-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors ${
                                                        currentMonth.getMonth() === idx
                                                            ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-bold"
                                                            : "text-gray-700 dark:text-gray-300"
                                                    }`}
                                                >
                                                    {month}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* 🟢 버튼 섹션 (완료 코스, 오늘의 데이트 추천) */}
                        <div className="flex items-center justify-center gap-3 mb-6">
                            <button
                                className={`flex items-center gap-2 px-4 py-2.5 bg-white ${
                                    hasData ? "dark:bg-gray-800/50" : ""
                                } border ${
                                    hasData
                                        ? "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                                        : "border-gray-200 hover:bg-gray-50"
                                } rounded-xl transition-colors`}
                            >
                                <svg
                                    className="w-5 h-5 text-gray-600 dark:text-gray-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                                    />
                                </svg>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t("mypage.footprintTab.completedCourses")}</span>
                                <span className="text-sm font-bold text-gray-900 dark:text-white ml-1">
                                    {completed.length}
                                </span>
                            </button>
                            <button className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="w-5 h-5 text-gray-600 dark:text-gray-400"
                                >
                                    <path d="M12 6V2H8" />
                                    <path d="M15 11v2" />
                                    <path d="M2 12h2" />
                                    <path d="M20 12h2" />
                                    <path d="M20 16a2 2 0 0 1-2 2H8.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 4 20.286V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
                                    <path d="M9 11v2" />
                                </svg>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {t("mypage.footprintTab.recommendedDate")}
                                </span>
                                <span className="text-sm font-bold text-gray-900 dark:text-white ml-1">
                                    {aiRecommendations.length}
                                </span>
                            </button>
                        </div>

                        {/* 달력 그리드 */}
                        <div className="grid grid-cols-7 gap-1 mb-4">
                            {/* 요일 헤더 */}
                            {dayNames.map((day, idx) => (
                                <div
                                    key={day}
                                    className={`text-center text-xs font-medium py-2 ${
                                        idx === 0
                                            ? "text-red-500 dark:text-red-400"
                                            : "text-gray-500 dark:text-gray-400"
                                    }`}
                                >
                                    {day}
                                </div>
                            ))}

                            {/* 날짜 셀 */}
                            {calendarDays.map((day, idx) => {
                                const isSelected =
                                    selectedDate &&
                                    day.date.getDate() === selectedDate.getDate() &&
                                    day.date.getMonth() === selectedDate.getMonth() &&
                                    day.date.getFullYear() === selectedDate.getFullYear();
                                const isToday =
                                    day.date.getDate() === new Date().getDate() &&
                                    day.date.getMonth() === new Date().getMonth() &&
                                    day.date.getFullYear() === new Date().getFullYear();
                                const isSunday = day.date.getDay() === 0;

                                const dateItems = day.hasItems ? itemsByDate.get(day.dateKey) : null;
                                const firstCourse = dateItems?.courses?.[0];
                                const firstAiRecommendation = dateItems?.aiRecommendations?.[0];
                                // 🟢 모든 항목 개수 계산 (개인 추억 제외)
                                const totalItemsCount =
                                    (dateItems?.courses?.length || 0) + (dateItems?.aiRecommendations?.length || 0);

                                return (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            if (day.hasItems) {
                                                setSelectedDate(day.date);
                                                const dateItems = itemsByDate.get(day.dateKey);

                                                // 🟢 모든 항목 통합 (완료 코스 + 오늘의 데이트 추천, 개인 추억 제외)
                                                const allItems = [
                                                    ...(dateItems?.courses || []),
                                                    ...(dateItems?.aiRecommendations || []),
                                                ];

                                                if (allItems.length >= 1) {
                                                    // 🟢 [Case 1 & 2]: 코스 1개든 2개든 동일한 모달 (가로 스크롤, 동일 카드 UI)
                                                    setSelectedDate(day.date);
                                                    const dateItems = itemsByDate.get(day.dateKey);
                                                    if (dateItems) {
                                                        const allCourses = [
                                                            ...(dateItems.courses || []),
                                                            ...(dateItems.aiRecommendations || []).map(
                                                                (item) => item.course || item,
                                                            ),
                                                        ];
                                                        allCourses.forEach((course) => {
                                                            const courseId = course?.id || course?.course_id;
                                                            if (
                                                                courseId &&
                                                                !courseImages[courseId] &&
                                                                !course?.imageUrl
                                                            ) {
                                                                getCourseImage(courseId).catch(() => {});
                                                            }
                                                        });
                                                    }
                                                    requestAnimationFrame(() => {
                                                        setShowDateCoursesModal(true);
                                                    });
                                                    // 🟢 앱에 즉시 전달해 추천 데이트 모달 열릴 때 광고 숨김
                                                    if (
                                                        typeof window !== "undefined" &&
                                                        (window as any).ReactNativeWebView
                                                    ) {
                                                        (window as any).ReactNativeWebView.postMessage(
                                                            JSON.stringify({ type: "dateCoursesModalOpen" }),
                                                        );
                                                    }
                                                }
                                            }
                                            // 🟢 [Case 3]: 항목이 없으면 아무 일도 일어나지 않음 (기본 동작)
                                        }}
                                        className={`relative aspect-square flex flex-col items-center justify-start pt-1.5 pb-1 transition-all ${
                                            !day.isCurrentMonth
                                                ? "opacity-30"
                                                : day.hasItems
                                                  ? "cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg"
                                                  : "cursor-default"
                                        }`}
                                    >
                                        {/* 날짜 숫자 */}
                                        <span
                                            className={`text-sm ${
                                                !day.isCurrentMonth
                                                    ? "text-gray-300 dark:text-gray-600"
                                                    : isSunday || day.date.getDay() === 6 // 토요일도 빨간색
                                                      ? "text-red-500 dark:text-red-400"
                                                      : isSelected
                                                        ? "text-emerald-600 dark:text-emerald-400 font-bold"
                                                        : isToday
                                                          ? "text-emerald-600 dark:text-emerald-400 font-bold"
                                                          : "text-gray-700 dark:text-gray-300"
                                            }`}
                                        >
                                            {day.date.getDate()}
                                        </span>

                                        {/* 점선 원형 아웃라인 - 모든 날짜에 표시 */}
                                        <div
                                            className={`absolute bottom-2 left-1/2 transform -translate-x-1/2 w-12 h-12 rounded-full border-2 border-dashed flex items-center justify-center ${
                                                isToday
                                                    ? "border-emerald-600 dark:border-emerald-500" // 🟢 오늘 날짜: 진한 녹색
                                                    : day.hasItems
                                                      ? "border-gray-300 dark:border-gray-600" // 🟢 완료 항목 있는 날짜: 회색
                                                      : "border-gray-200 dark:border-gray-700" // 🟢 빈 날짜: 연한 회색
                                            }`}
                                        >
                                            {/* 완료 항목이 있으면 작은 표시점 또는 이미지 (개인 추억 제외) */}
                                            {day.hasItems &&
                                                (firstCourse?.imageUrl ? (
                                                    <div className="relative w-10 h-10">
                                                        <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-200 dark:border-gray-700 pointer-events-none z-20">
                                                            <Image
                                                                src={firstCourse.imageUrl}
                                                                alt={firstCourse.title}
                                                                width={40}
                                                                height={40}
                                                                className="w-full h-full object-cover"
                                                                loading="lazy"
                                                                quality={60}
                                                                fallbackContent={
                                                                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                                                                        📍
                                                                    </div>
                                                                }
                                                            />
                                                        </div>
                                                        {/* 🟢 여러 개일 때 개수 배지 표시 */}
                                                        {totalItemsCount > 1 && (
                                                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 dark:bg-emerald-600 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800 z-30 pointer-events-none">
                                                                <span className="text-[9px] font-black text-white">
                                                                    {totalItemsCount}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : firstAiRecommendation?.course?.imageUrl ? (
                                                    <div className="relative w-10 h-10">
                                                        <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-200 dark:border-gray-700 pointer-events-none z-20">
                                                            <Image
                                                                src={firstAiRecommendation.course.imageUrl}
                                                                alt={firstAiRecommendation.course.title}
                                                                width={40}
                                                                height={40}
                                                                className="w-full h-full object-cover"
                                                                loading="lazy"
                                                                quality={60}
                                                                fallbackContent={
                                                                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                                                                        📍
                                                                    </div>
                                                                }
                                                            />
                                                        </div>
                                                        {/* 🟢 여러 개일 때 개수 배지 표시 */}
                                                        {totalItemsCount > 1 && (
                                                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 dark:bg-emerald-600 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-800 z-30 pointer-events-none">
                                                                <span className="text-[9px] font-black text-white">
                                                                    {totalItemsCount}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="relative pointer-events-none">
                                                        <div className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400"></div>
                                                        {/* 🟢 여러 개일 때 개수 배지 표시 */}
                                                        {totalItemsCount > 1 && (
                                                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 dark:bg-emerald-600 rounded-full flex items-center justify-center border border-white dark:border-gray-800 z-30">
                                                                <span className="text-[8px] font-black text-white">
                                                                    {totalItemsCount}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                        </div>

                                        {/* 선택된 날짜 표시 */}
                                        {isSelected && (
                                            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-12 h-12 rounded-full border-2 border-emerald-600 border-solid"></div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    /* 🟢 추억 영역 - 타임라인 형식 */
                    <div className="p-4 md:p-6">
                        {personalStories.length === 0 ? (
                            <div className="text-center py-16">
                                <div className="mb-4 flex items-center justify-center">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="currentColor"
                                        className="w-16 h-16 text-pink-500 dark:text-pink-400"
                                    >
                                        <path d="M6 4C6 3.44772 6.44772 3 7 3H21C21.5523 3 22 3.44772 22 4V16C22 16.5523 21.5523 17 21 17H18V20C18 20.5523 17.5523 21 17 21H3C2.44772 21 2 20.5523 2 20V8C2 7.44772 2.44772 7 3 7H6V4ZM8 7H17C17.5523 7 18 7.44772 18 8V15H20V5H8V7ZM16 15.7394V9H4V18.6321L11.4911 11.6404L16 15.7394ZM7 13.5C7.82843 13.5 8.5 12.8284 8.5 12C8.5 11.1716 7.82843 10.5 7 10.5C6.17157 10.5 5.5 11.1716 5.5 12C5.5 12.8284 6.17157 13.5 7 13.5Z"></path>
                                    </svg>
                                </div>
                                <p className="text-base text-gray-500 dark:text-gray-400 font-medium">
                                    {t("mypage.footprintTab.noPersonalMemories")}
                                </p>
                                <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                                    {t("mypage.footprintTab.leaveMemoryHint")}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {(() => {
                                    // 🟢 월별로 그룹화
                                    const storiesByMonth = new Map<string, typeof personalStories>();
                                    personalStories.forEach((story) => {
                                        const date = new Date(story.createdAt);
                                        const monthKey = `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
                                        if (!storiesByMonth.has(monthKey)) {
                                            storiesByMonth.set(monthKey, []);
                                        }
                                        storiesByMonth.get(monthKey)!.push(story);
                                    });

                                    // 🟢 최신순으로 정렬
                                    const sortedMonths = Array.from(storiesByMonth.entries()).sort((a, b) => {
                                        const dateA = new Date(a[1][0].createdAt);
                                        const dateB = new Date(b[1][0].createdAt);
                                        return dateB.getTime() - dateA.getTime();
                                    });

                                    return sortedMonths.map(([monthKey, stories], monthIdx) => (
                                        <div key={monthKey} className="space-y-4">
                                            {/* 월 헤더 */}
                                            <h5 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                                                {monthKey}
                                            </h5>

                                            {/* 추억 카드 리스트 - 1열 레이아웃 */}
                                            <div className="grid grid-cols-1 gap-4">
                                                {stories
                                                    .sort(
                                                        (a, b) =>
                                                            new Date(b.createdAt).getTime() -
                                                            new Date(a.createdAt).getTime(),
                                                    )
                                                    .map((story, storyIdx) => {
                                                        const date = new Date(story.createdAt);
                                                        const dayOfWeek = dayNames[date.getDay()];
                                                        const isPriorityImage = monthIdx === 0 && storyIdx < 3;

                                                        return (
                                                            <div
                                                                key={story.id}
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    // 🟢 추억 회상 모달만 열기 (코스 페이지로 이동하지 않음)
                                                                    setSelectedMemory(story);
                                                                    setShowMemoryModal(true);
                                                                }}
                                                                className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden cursor-pointer hover:shadow-lg transition-all border border-gray-100 dark:border-gray-700 group"
                                                            >
                                                                {/* 이미지 영역 - 비율에 따라 cover/contain 분기 */}
                                                                {story.imageUrls?.[0] ? (
                                                                    <div className="relative w-full h-48 bg-gray-100 dark:bg-gray-700">
                                                                        <AspectAwareMemoryImage
                                                                            src={story.imageUrls[0]}
                                                                            alt={t("mypage.footprintTab.personalMemory")}
                                                                            className="group-hover:scale-105 transition-transform duration-300"
                                                                            sizes="(max-width: 768px) 100vw, 50vw"
                                                                            priority={isPriorityImage}
                                                                            loading={isPriorityImage ? "eager" : "lazy"}
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <div className="w-full h-48 bg-linear-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
                                                                        <span className="text-4xl">💕</span>
                                                                    </div>
                                                                )}

                                                                {/* 내용 영역 */}
                                                                <div className="p-4">
                                                                    {/* 날짜 */}
                                                                    <div className="text-xs font-medium mb-2 text-gray-500 dark:text-gray-400">
                                                                        {date.getFullYear()}년 {date.getMonth() + 1}월{" "}
                                                                        {date.getDate()}일 ({dayOfWeek})
                                                                    </div>

                                                                    {/* 코스명 (메인) */}
                                                                    <div className="text-base font-bold mb-1 line-clamp-2 text-gray-900 dark:text-white">
                                                                        {story.course?.title || t("mypage.footprintTab.personalMemory")}
                                                                    </div>
                                                                    {/* 선택한 태그 (칩 형태, DoNa + 1개만) */}
                                                                    {story.tags &&
                                                                        story.tags.length > 0 &&
                                                                        (() => {
                                                                            const doNa = story.tags.find(
                                                                                (t: string) => t === "DoNa",
                                                                            );
                                                                            const others = story.tags.filter(
                                                                                (t: string) => t !== "DoNa",
                                                                            );
                                                                            const displayTags = [
                                                                                ...(doNa ? [doNa] : []),
                                                                                ...others.slice(0, 1),
                                                                            ];
                                                                            return displayTags.length > 0 ? (
                                                                                <div className="flex flex-wrap gap-1.5 mb-3">
                                                                                    {displayTags.map((t: string) => (
                                                                                        <span
                                                                                            key={t}
                                                                                            className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                                                                                        >
                                                                                            #{t}
                                                                                        </span>
                                                                                    ))}
                                                                                </div>
                                                                            ) : null;
                                                                        })()}

                                                                    {/* 별점 */}
                                                                    <div className="flex items-center gap-1">
                                                                        {[...Array(5)].map((_, i) => (
                                                                            <span
                                                                                key={i}
                                                                                className={`text-sm ${
                                                                                    i < story.rating
                                                                                        ? "text-yellow-400"
                                                                                        : "text-gray-300 dark:text-gray-600"
                                                                                }`}
                                                                            >
                                                                                ⭐
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 🟢 [통합 모달]: 1개/2개/3개 모두 동일 카드 UI, 2개 이상이면 가로 스크롤 + 오른쪽 peek */}
            {showDateCoursesModal &&
                selectedDate &&
                selectedDateItems &&
                (() => {
                    const modalItems = [
                        ...(selectedDateItems.courses || []).map((c) => ({
                            ...c,
                            isAI: false,
                            isPersonalStory: false,
                            course: c,
                        })),
                        ...(selectedDateItems.aiRecommendations || []).map((item) => ({
                            ...item,
                            course: item.course || item,
                            isAI: true,
                            isPersonalStory: false,
                        })),
                    ].filter((item) => {
                        const course = item.course || item;
                        const courseId = course?.id || course?.course_id || item.course_id || item.id;
                        return !!courseId;
                    });
                    const isMulti = modalItems.length > 1;
                    // 🟢 카드 300px - 보기 좋은 크기 + 양옆 peek 여유
                    const CARD_W = 300;
                    const PEEK_PADDING = `max(16px, calc((100vw - 32px - ${CARD_W}px) / 2))`;

                    return (
                        <div
                            className="fixed inset-0 z-5000 bg-black/60 dark:bg-black/80 flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300"
                            onClick={() => setShowDateCoursesModal(false)}
                        >
                            {/* 1개: 중앙 고정 | 2개+: 가로 스크롤 + 오른쪽에 다른 코스 peek */}
                            <div
                                ref={scrollContainerRef}
                                className={`w-full flex-1 flex scrollbar-hide items-center min-h-0 ${isMulti ? "overflow-x-auto snap-x snap-mandatory cursor-grab active:cursor-grabbing" : "overflow-visible justify-center"}`}
                                {...(isMulti ? dateCoursesDragHandlers : {})}
                                style={
                                    isMulti
                                        ? {
                                              WebkitOverflowScrolling: "touch",
                                              scrollBehavior: "smooth",
                                              willChange: "scroll-position",
                                          }
                                        : undefined
                                }
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div
                                    className={`flex items-center shrink-0 ${isMulti ? "gap-4" : ""}`}
                                    style={
                                        isMulti
                                            ? {
                                                  paddingLeft: PEEK_PADDING,
                                                  paddingRight: PEEK_PADDING,
                                              }
                                            : undefined
                                    }
                                >
                                    {modalItems.map((item, idx) => {
                                        const course = item.course || item;
                                        const courseId = course?.id || course?.course_id || item.course_id;
                                        const isAI = item.isAI || !!item.savedAt;

                                        return (
                                            <div
                                                key={`${courseId}-${idx}`}
                                                className={`shrink-0 bg-white dark:bg-[#1a241b] rounded-4xl overflow-hidden shadow-2xl relative flex flex-col ${isMulti ? "snap-center" : "w-full max-w-[380px]"}`}
                                                style={isMulti ? { width: CARD_W, minWidth: CARD_W } : undefined}
                                            >
                                                {/* 상단 이미지 - showCourseModal과 동일 h-52 */}
                                                <div className="relative w-full h-52 bg-gray-900 dark:bg-gray-800">
                                                    <Image
                                                        src={course?.imageUrl || courseImages[courseId] || ""}
                                                        alt={course?.title || "Course"}
                                                        fill
                                                        className="object-cover opacity-85"
                                                        sizes={isMulti ? "300px" : "380px"}
                                                        priority={idx < 3}
                                                        loading={idx < 3 ? "eager" : "lazy"}
                                                        quality={idx < 3 ? 75 : 65}
                                                        fetchPriority={idx < 3 ? "high" : "auto"}
                                                        fallbackContent={
                                                            <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                                                <div className="text-gray-400 dark:text-gray-500 text-2xl">
                                                                    📍
                                                                </div>
                                                            </div>
                                                        }
                                                        fallbackClassName="bg-gray-200 dark:bg-gray-700"
                                                    />
                                                    <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-black/10"></div>

                                                    {/* 닫기 버튼 - 이미지 내부 오른쪽 위 (사진 위에 겹침) */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setShowDateCoursesModal(false);
                                                        }}
                                                        className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center bg-black/40 dark:bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/50 dark:hover:bg-black/60 transition-colors z-20 border-0"
                                                    >
                                                        x
                                                    </button>

                                                    {/* 배지 */}
                                                    <div className="absolute bottom-4 left-5 flex gap-1.5">
                                                        {!isAI ? (
                                                            <span className="px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-black rounded-md shadow-md flex items-center gap-1">
                                                                <CheckCircle className="w-2.5 h-2.5" /> VERIFIED
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-black rounded-md shadow-md flex items-center gap-1">
                                                                <Sparkles className="w-2.5 h-2.5" /> AI SELECTED
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* 내용 - 작은 카드 기준 고정 높이 (텍스트 양에 따라 카드 크기 변동 방지) */}
                                                <div className="p-6 bg-white dark:bg-[#1a241b] min-h-[220px] flex flex-col">
                                                    <div className="mb-4">
                                                        <span className="text-emerald-600 dark:text-emerald-400 text-[9px] font-black tracking-[0.2em] uppercase mb-1 block">
                                                            {t("mypage.footprintTab.privateArchiving")}
                                                        </span>
                                                        <h4 className="text-xl font-black text-gray-900 dark:text-white leading-tight tracking-tighter line-clamp-2">
                                                            {course?.title || item.title || t("mypage.footprintTab.course")}
                                                        </h4>
                                                    </div>

                                                    <p className="text-gray-500 dark:text-gray-400 text-[13px] leading-snug mb-5 line-clamp-3 font-medium">
                                                        {course?.description ||
                                                            item.description ||
                                                            t("mypage.footprintTab.savedCourseDesc")}
                                                    </p>

                                                    <div className="grid grid-cols-2 gap-3 mb-6">
                                                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 border border-gray-100/50 dark:border-gray-700">
                                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                                <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                                                <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase">
                                                                    {t("mypage.footprintTab.region")}
                                                                </span>
                                                            </div>
                                                            <span className="text-xs font-black text-gray-800 dark:text-gray-200">
                                                                {course?.region || item.region || t("mypage.footprintTab.regionSeoul")}
                                                            </span>
                                                        </div>
                                                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 border border-gray-100/50 dark:border-gray-700">
                                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                                <Zap className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                                                <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase">
                                                                    {t("mypage.footprintTab.concept")}
                                                                </span>
                                                            </div>
                                                            <span className="text-xs font-black text-gray-800 dark:text-gray-200">
                                                                {course?.concept || item.concept || t("mypage.footprintTab.conceptDate")}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={() => {
                                                            if (courseId) {
                                                                setShowDateCoursesModal(false);
                                                                router.push(`/courses/${courseId}`);
                                                            } else {
                                                                console.error(
                                                                    "[FootprintTab] 가로 스크롤 모달: 코스 ID가 없어 이동할 수 없습니다.",
                                                                );
                                                                alert(t("mypage.footprintTab.alertLoadFailed"));
                                                            }
                                                        }}
                                                        disabled={!courseId}
                                                        className="w-full py-3 bg-gray-900 dark:bg-gray-800 text-white rounded-xl font-black text-sm hover:bg-black dark:hover:bg-gray-700 transition-all active:scale-[0.98] shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        <span>{t("mypage.footprintTab.viewCourse")}</span>
                                                        <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 안내 텍스트: 2개 이상일 때만 표시 */}
                            {isMulti && (
                                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/60 dark:text-white/50 text-xs font-bold animate-pulse z-10 pointer-events-none">
                                    {t("mypage.footprintTab.swipeMore")}
                                </div>
                            )}
                        </div>
                    );
                })()}
            {/* 🟢 [Compact Version]: 세로 높이 최적화 및 상업적 UI */}
            {showCourseModal && (
                <div
                    className="fixed inset-0 z-5000 bg-black/60 dark:bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setShowCourseModal(false)}
                >
                    <div
                        className="bg-white dark:bg-[#1a241b] rounded-4xl w-full max-w-[380px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {loadingDetail && !courseDetail ? (
                            <div className="flex flex-col items-center justify-center py-16">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 dark:border-emerald-500 mb-3"></div>
                                <p className="text-gray-400 dark:text-gray-500 text-xs font-bold tracking-tighter">
                                    {t("mypage.footprintTab.archiveLoading")}
                                </p>
                            </div>
                        ) : courseDetail ? (
                            <div className="relative">
                                {/* 상단 이미지 영역: h-64 -> h-52로 축소 */}
                                <div className="relative w-full h-52 bg-gray-900 dark:bg-gray-800">
                                    <Image
                                        src={courseDetail.imageUrl || ""}
                                        alt={courseDetail.title}
                                        fill
                                        className="object-cover opacity-85"
                                        priority
                                        sizes="380px"
                                        fallbackContent={
                                            <div className="w-full h-full flex items-center justify-center">
                                                <div className="text-gray-400 dark:text-gray-500 text-2xl">📍</div>
                                            </div>
                                        }
                                        fallbackClassName="bg-gray-200 dark:bg-gray-700"
                                    />
                                    <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-black/10"></div>

                                    <button
                                        onClick={() => setShowCourseModal(false)}
                                        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-black/20 dark:bg-black/30 backdrop-blur-md rounded-full text-white hover:bg-black/30 dark:hover:bg-black/40 transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>

                                    {/* 배지 영역: 폰트 사이즈 및 간격 최적화 */}
                                    <div className="absolute bottom-4 left-5 flex gap-1.5">
                                        {selectedCourse ? (
                                            <span className="px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-black rounded-md shadow-md flex items-center gap-1">
                                                <CheckCircle className="w-2.5 h-2.5" /> VERIFIED
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-black rounded-md shadow-md flex items-center gap-1">
                                                <Sparkles className="w-2.5 h-2.5" /> AI SELECTED
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* 콘텐츠 영역: p-8 -> p-6으로 축소 */}
                                <div className="p-6 bg-white dark:bg-[#1a241b]">
                                    <div className="mb-4">
                                        <span className="text-emerald-600 dark:text-emerald-400 text-[9px] font-black tracking-[0.2em] uppercase mb-1 block">
                                            {t("mypage.footprintTab.privateArchiving")}
                                        </span>
                                        <h4 className="text-xl font-black text-gray-900 dark:text-white leading-tight tracking-tighter">
                                            {courseDetail.title}
                                        </h4>
                                    </div>

                                    <p className="text-gray-500 dark:text-gray-400 text-[13px] leading-snug mb-5 line-clamp-3 font-medium">
                                        {courseDetail.description || t("mypage.footprintTab.savedCourseDesc")}
                                    </p>

                                    {/* 정보 그리드: 간격 축소 */}
                                    <div className="grid grid-cols-2 gap-3 mb-6">
                                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 border border-gray-100/50 dark:border-gray-700">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                                <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase">
                                                    {t("mypage.footprintTab.region")}
                                                </span>
                                            </div>
                                            <span className="text-xs font-black text-gray-800 dark:text-gray-200">
                                                {courseDetail.region || t("mypage.footprintTab.regionSeoul")}
                                            </span>
                                        </div>
                                        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 border border-gray-100/50 dark:border-gray-700">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <Zap className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                                <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase">
                                                    {t("mypage.footprintTab.concept")}
                                                </span>
                                            </div>
                                            <span className="text-xs font-black text-gray-800 dark:text-gray-200">
                                                {courseDetail.concept || t("mypage.footprintTab.conceptDate")}
                                            </span>
                                        </div>
                                    </div>

                                    {/* CTA 버튼 */}
                                    <button
                                        onClick={() => {
                                            if (courseDetail?.id) {
                                                setShowCourseModal(false);
                                                router.push(`/courses/${courseDetail.id}`);
                                            } else {
                                                console.error("[FootprintTab] Cannot navigate without course ID.");
                                                alert(t("mypage.footprintTab.alertLoadFailed"));
                                            }
                                        }}
                                        disabled={!courseDetail?.id}
                                        className="w-full py-3 bg-gray-900 dark:bg-gray-800 text-white rounded-xl font-black text-sm hover:bg-black dark:hover:bg-gray-700 transition-all active:scale-[0.98] shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <span>코스 보러가기</span>
                                        <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-12 p-6">
                                <p className="text-gray-400 dark:text-gray-500 text-sm font-bold">
                                    정보를 불러올 수 없습니다.
                                </p>
                                <button
                                    onClick={() => setShowCourseModal(false)}
                                    className="mt-4 px-6 py-2 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-lg text-sm font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                >
                                    닫기
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 🟢 추억 상세 모달 - 인스타그램 스토리 스타일 */}
            {showMemoryModal && selectedMemory && (
                <div
                    className="fixed inset-0 z-5000 bg-black dark:bg-black flex flex-col animate-in fade-in duration-300"
                    onClick={() => setShowMemoryModal(false)}
                    style={{
                        // 🟢 상단/하단 safe area 영역도 검은색으로 채우기
                        paddingTop: "env(safe-area-inset-top, 0)",
                        paddingBottom: "env(safe-area-inset-bottom, 0)",
                    }}
                >
                    {/* 🟢 상단 바 영역 (검은색 배경) - 상태바 영역 포함 */}
                    <div
                        className="absolute top-0 left-0 right-0 bg-black dark:bg-black z-10"
                        style={{
                            height: "env(safe-area-inset-top, 0)",
                        }}
                    />

                    {/* 🟢 하단 네비게이션 바 영역 (안드로이드용, 검은색 배경) */}
                    <div
                        className="absolute bottom-0 left-0 right-0 bg-black dark:bg-black z-10"
                        style={{
                            height: "env(safe-area-inset-bottom, 0)",
                        }}
                    />

                    {/* 상단 바 영역 - Region, 점 인디케이터, X 버튼 */}
                    <div
                        className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 bg-black dark:bg-black pt-4 pb-4"
                        style={{
                            top: "env(safe-area-inset-top, 0)",
                        }}
                    >
                        {/* 왼쪽: Region */}
                        {selectedMemory.course?.region && (
                            <div className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white text-xs rounded-full z-20">
                                <span className="text-sm font-medium text-white dark:text-gray-300">
                                    {selectedMemory.course.region}
                                </span>
                            </div>
                        )}

                        {/* 중앙: 점 인디케이터 */}
                        {selectedMemory.imageUrls && selectedMemory.imageUrls.length > 1 ? (
                            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
                                {selectedMemory.imageUrls.map((_: any, i: number) => (
                                    <div
                                        key={i}
                                        className={`h-1 rounded-full transition-all ${
                                            i === currentImageIndex ? "bg-white w-8" : "bg-white/40 w-1"
                                        }`}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="flex-1" /> // Region이 없을 때 중앙 정렬을 위한 공간
                        )}

                        {/* 오른쪽: X 버튼 */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowMemoryModal(false);
                            }}
                            className="text-white hover:text-white/80 transition-colors p-4 z-20"
                        >
                            <X className="w-6 h-6 stroke-2" />
                        </button>
                    </div>

                    {/* 가로 스크롤 사진 갤러리 - 상하단 여백 적용 */}
                    {selectedMemory.imageUrls && selectedMemory.imageUrls.length > 0 ? (
                        <div
                            ref={memoryScrollRef}
                            className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide cursor-grab active:cursor-grabbing"
                            {...memoryDragHandlers}
                            style={{
                                height: "calc(100vh - 120px)", // 상하단 여백 60px씩
                                marginTop: "60px",
                                marginBottom: "60px",
                                overflowY: "hidden",
                                overscrollBehavior: "none",
                                WebkitOverflowScrolling: "touch",
                                scrollBehavior: "smooth",
                                touchAction: "pan-x",
                            }}
                            onScroll={(e) => {
                                const container = e.currentTarget;
                                const scrollLeft = container.scrollLeft;
                                const itemWidth = container.clientWidth;
                                const newIndex = Math.round(scrollLeft / itemWidth);
                                setCurrentImageIndex(newIndex);
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {selectedMemory.placeData && typeof selectedMemory.placeData === "object"
                                ? (() => {
                                      // 🟢 placeData가 있으면 장소별로 그룹화
                                      const placeData = selectedMemory.placeData as Record<
                                          string,
                                          { photos: string[]; tags: string[] }
                                      >;
                                      const stepIndices = Object.keys(placeData).sort((a, b) => Number(a) - Number(b));
                                      let photoIndex = 0;

                                      return stepIndices.flatMap((stepIndex) => {
                                          const stepData = placeData[stepIndex];
                                          const photos = stepData.photos || [];
                                          const tags = stepData.tags || [];

                                          return photos.map((imageUrl: string, photoIdx: number) => {
                                              const currentIdx = photoIndex++;
                                              return (
                                                  <div
                                                      key={`${stepIndex}-${photoIdx}`}
                                                      className="shrink-0 w-full h-full snap-center flex items-center justify-center relative"
                                                      style={{ height: "calc(100vh - 120px)" }}
                                                  >
                                                      {/* 사진 - 비율에 따라 cover/contain 분기 */}
                                                      <div className="absolute inset-0 bg-black">
                                                          <AspectAwareMemoryImage
                                                              src={imageUrl}
                                                              alt={t("mypage.footprintTab.memoryPhotoAlt", { index: String(currentIdx + 1) })}
                                                              sizes="100vw"
                                                              {...(currentIdx < 2 ? { priority: true } : {})}
                                                          />
                                                      </div>
                                                  </div>
                                              );
                                          });
                                      });
                                  })()
                                : // 🟢 placeData가 없으면 기존 방식 (하위 호환성)
                                  selectedMemory.imageUrls.map((imageUrl: string, idx: number) => (
                                      <div
                                          key={idx}
                                          className="shrink-0 w-full h-full snap-center flex items-center justify-center relative"
                                          style={{ height: "calc(100vh - 120px)" }}
                                      >
                                          {/* 사진 - 비율에 따라 cover/contain 분기 */}
                                          <div className="absolute inset-0 bg-black">
                                              <AspectAwareMemoryImage
                                                  src={imageUrl}
                                                  alt={t("mypage.footprintTab.memoryPhotoAlt", { index: String(idx + 1) })}
                                                  sizes="100vw"
                                                  {...(idx < 2 ? { priority: true } : {})}
                                              />
                                          </div>
                                      </div>
                                  ))}
                        </div>
                    ) : (
                        <div
                            className="flex items-center justify-center bg-black"
                            style={{
                                height: "calc(100vh - 120px)",
                                marginTop: "60px",
                                marginBottom: "60px",
                            }}
                        >
                            <div className="w-full h-full bg-linear-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    className="w-24 h-24 text-pink-500 dark:text-pink-400"
                                >
                                    <path d="M6 4C6 3.44772 6.44772 3 7 3H21C21.5523 3 22 3.44772 22 4V16C22 16.5523 21.5523 17 21 17H18V20C18 20.5523 17.5523 21 17 21H3C2.44772 21 2 20.5523 2 20V8C2 7.44772 2.44772 7 3 7H6V4ZM8 7H17C17.5523 7 18 7.44772 18 8V15H20V5H8V7ZM16 15.7394V9H4V18.6321L11.4911 11.6404L16 15.7394ZM7 13.5C7.82843 13.5 8.5 12.8284 8.5 12C8.5 11.1716 7.82843 10.5 7 10.5C6.17157 10.5 5.5 11.1716 5.5 12C5.5 12.8284 6.17157 13.5 7 13.5Z"></path>
                                </svg>
                            </div>
                        </div>
                    )}

                    {/* 하단 날짜 및 태그 표시 (왼쪽 정렬) */}
                    <div
                        className="absolute bottom-0 left-0 right-0 z-20 flex flex-col"
                        style={{
                            paddingBottom: "calc(env(safe-area-inset-bottom, 0) + 1.5rem)",
                            paddingLeft: "1.5rem",
                            paddingTop: "2rem",
                            background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%)",
                        }}
                    >
                        {/* 날짜 */}
                        <div className="text-white text-sm font-medium mb-2">
                            {(() => {
                                const date = new Date(selectedMemory.createdAt);
                                const dayOfWeek = dayNames[date.getDay()];
                                return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${dayOfWeek})`;
                            })()}
                        </div>

                        {/* 🟢 현재 사진에 해당하는 태그 표시 */}
                        {(() => {
                            // placeData에서 현재 사진의 태그 가져오기
                            if (selectedMemory.placeData && typeof selectedMemory.placeData === "object") {
                                const placeData = selectedMemory.placeData as Record<
                                    string,
                                    { photos: string[]; tags: string[] }
                                >;
                                const stepIndices = Object.keys(placeData).sort((a, b) => Number(a) - Number(b));
                                let photoIndex = 0;

                                // 현재 인덱스에 해당하는 태그 찾기
                                for (const stepIndex of stepIndices) {
                                    const stepData = placeData[stepIndex];
                                    const photos = stepData.photos || [];
                                    const tags = stepData.tags || [];

                                    if (
                                        currentImageIndex >= photoIndex &&
                                        currentImageIndex < photoIndex + photos.length
                                    ) {
                                        // 현재 사진이 이 장소의 사진임
                                        if (tags.length > 0) {
                                            return (
                                                <div className="flex flex-wrap gap-2">
                                                    {tags.map((tag: string, idx: number) => (
                                                        <span
                                                            key={idx}
                                                            className="px-2 py-1 bg-white/20 backdrop-blur-sm text-white text-xs rounded-full"
                                                        >
                                                            #{tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            );
                                        }
                                        break;
                                    }
                                    photoIndex += photos.length;
                                }
                            }
                            return null;
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
};

// 🟢 성능 최적화: React.memo로 불필요한 리렌더링 방지
export default memo(FootprintTab);
