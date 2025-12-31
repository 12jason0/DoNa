"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
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
                console.error("코스 이미지 로드 실패:", error);
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
        return <Image src={loadedImageUrl} alt="Course" fill className="object-cover" sizes="64px" loading="lazy" />;
    }

    return <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl">📍</div>;
};

interface FootprintTabProps {
    casefiles: CasefileItem[];
    completed: CompletedCourse[];
    aiRecommendations?: any[]; // 🟢 AI 추천 코스 (savedCourses)
    userName?: string; // 🟢 사용자 이름
}

const FootprintTab = ({ casefiles, completed, aiRecommendations = [], userName = "회원" }: FootprintTabProps) => {
    const router = useRouter();
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [showMonthDropdown, setShowMonthDropdown] = useState(false); // 🟢 월 선택 드롭다운 표시 여부
    const [selectedCourse, setSelectedCourse] = useState<CompletedCourse | null>(null);
    const [showCourseModal, setShowCourseModal] = useState(false);
    const [courseDetail, setCourseDetail] = useState<any>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [showDateCoursesModal, setShowDateCoursesModal] = useState(false); // 🟢 날짜별 코스 모달
    // 🟢 각 코스의 이미지 URL을 저장 (코스 ID -> 이미지 URL)
    const [courseImages, setCourseImages] = useState<Record<number | string, string>>({});

    // 🟢 날짜별로 완료 항목 그룹화
    const itemsByDate = useMemo(() => {
        const map = new Map<string, { courses: CompletedCourse[]; aiRecommendations: any[] }>();

        completed.forEach((course) => {
            if (course.completedAt) {
                const date = new Date(course.completedAt);
                const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
                    date.getDate()
                ).padStart(2, "0")}`;
                if (!map.has(dateKey)) {
                    map.set(dateKey, { courses: [], aiRecommendations: [] });
                }
                map.get(dateKey)!.courses.push(course);
            }
        });

        // 🟢 AI 추천 코스는 savedAt 기준으로 그룹화
        aiRecommendations.forEach((item) => {
            const savedAt = item.savedAt || item.course?.createdAt;
            if (savedAt) {
                const date = new Date(savedAt);
                const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
                    date.getDate()
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
                "0"
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

    // 🟢 선택한 날짜의 완료 항목
    const selectedDateItems = useMemo(() => {
        if (!selectedDate) return null;
        const dateKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(
            selectedDate.getDate()
        ).padStart(2, "0")}`;
        return itemsByDate.get(dateKey) || { courses: [], aiRecommendations: [] };
    }, [selectedDate, itemsByDate]);

    const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

    const prevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
        setShowMonthDropdown(false); // 🟢 월 변경 시 드롭다운 닫기
    };

    const nextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
        setShowMonthDropdown(false); // 🟢 월 변경 시 드롭다운 닫기
    };

    // 🟢 월 선택 핸들러
    const handleMonthSelect = (monthIndex: number) => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), monthIndex, 1));
        setShowMonthDropdown(false);
    };

    // 🟢 코스 이미지 가져오기 (코스 이미지가 없으면 첫 번째 장소 이미지 사용) - 최적화
    const getCourseImage = useCallback(
        async (courseId: number | string): Promise<string> => {
            // 이미 캐시된 이미지가 있으면 반환
            if (courseImages[courseId]) {
                return courseImages[courseId];
            }

            try {
                // 🟢 캐시 우선 사용 및 빠른 응답을 위한 최적화
                const res = await fetch(`/api/courses/${courseId}`, {
                    cache: "force-cache", // 🟢 캐시 우선 사용
                    next: { revalidate: 300 }, // 🟢 5분 캐시
                });
                if (res.ok) {
                    const data = await res.json();
                    // 코스 이미지가 있으면 사용, 없으면 첫 번째 장소 이미지 사용
                    const imageUrl =
                        data.imageUrl?.trim() ||
                        data.coursePlaces?.[0]?.place?.imageUrl?.trim() ||
                        data.coursePlaces?.[0]?.place?.image_url?.trim() ||
                        "";

                    if (imageUrl) {
                        // 🟢 [Performance]: requestAnimationFrame으로 상태 업데이트 분산
                        requestAnimationFrame(() => {
                            setCourseImages((prev) => {
                                if (prev[courseId]) return prev; // 이미 있으면 업데이트 안 함
                                return { ...prev, [courseId]: imageUrl };
                            });
                        });
                        return imageUrl;
                    }
                }
            } catch (error) {
                console.error("코스 이미지 조회 실패:", error);
            }
            return "";
        },
        [courseImages]
    );

    // 🟢 [Performance]: 모달이 열릴 때 모든 코스 이미지 즉시 병렬 로드 (최적화 강화)
    useEffect(() => {
        if (!showDateCoursesModal || !selectedDateItems) return;

        const allCourses = [
            ...(selectedDateItems.courses || []),
            ...(selectedDateItems.aiRecommendations || []).map((item) => item.course || item),
        ].filter((course) => {
            const courseId = course?.id || course?.course_id;
            return courseId && !courseImages[courseId] && !course?.imageUrl;
        });

        if (allCourses.length === 0) return;

        // 🟢 [Performance]: 첫 번째 이미지는 즉시, 나머지는 순차적으로 로드 (초기 렌더링 우선)
        allCourses.forEach((course, idx) => {
            const courseId = course?.id || course?.course_id;
            if (!courseId) return;

            if (idx === 0) {
                // 🟢 첫 번째 이미지는 즉시 로드
                getCourseImage(courseId).catch(() => {});
            } else {
                // 🟢 나머지는 약간의 지연 후 로드 (초기 렌더링 우선)
                setTimeout(() => {
                    getCourseImage(courseId).catch(() => {});
                }, idx * 20); // 🟢 20ms 간격으로 순차 로드
            }
        });
    }, [showDateCoursesModal, selectedDateItems, courseImages, getCourseImage]);

    // 🟢 코스 클릭 핸들러 (최적화: 즉시 기본 정보 표시 후 상세 정보 로드)
    const handleCourseClick = async (courseId: number | string) => {
        // 🟢 [Optimization]: 이미 있는 코스 정보로 즉시 모달 표시
        const foundCompleted = completed.find((c) => c.course_id === Number(courseId));
        const foundAiRecommendation = aiRecommendations.find(
            (item) => item.course?.id === Number(courseId) || item.course?.course_id === Number(courseId)
        );

        // 🟢 기본 정보로 즉시 모달 표시 (API 응답 전)
        if (foundCompleted) {
            setCourseDetail({
                id: foundCompleted.course_id,
                title: foundCompleted.title,
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
            setCourseDetail({
                id: course.id || course.course_id,
                title: course.title || "",
                description: course.description || "",
                imageUrl: course.imageUrl || "",
                region: course.region || "",
                concept: course.concept || "",
            });
            setShowCourseModal(true);
            setLoadingDetail(false); // 🟢 기본 정보는 이미 있으므로 로딩 완료
        } else {
            // 🟢 정보가 없으면 로딩 상태로 모달 표시
            setLoadingDetail(true);
            setShowCourseModal(true);
        }

        // 🟢 [Optimization]: 백그라운드에서 상세 정보 로드 (캐싱 활용)
        try {
            const res = await fetch(`/api/courses/${courseId}`, {
                cache: "force-cache", // 🟢 캐싱으로 성능 향상
                next: { revalidate: 300 }, // 🟢 5분간 캐시 유지
            });
            if (res.ok) {
                const data = await res.json();
                // 🟢 상세 정보 업데이트 (이미지, 설명 등 보완)
                setCourseDetail((prev: any) => ({
                    ...prev,
                    ...data,
                    // 🟢 이미지가 없으면 상세 정보의 이미지 사용
                    imageUrl: prev?.imageUrl || data.imageUrl || data.coursePlaces?.[0]?.place?.imageUrl || "",
                    description: prev?.description || data.description || "",
                }));
            }
        } catch (error) {
            console.error("코스 상세 조회 실패:", error);
        } finally {
            setLoadingDetail(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden relative">
                {/* 헤더 */}
                <div className="pt-5 pl-5 pr-5 border-b border-gray-50 bg-white relative z-10">
                    <h4 className="text-lg font-bold text-gray-900 mb-1 tracking-tight">내 발자취 👣</h4>
                    <p className="text-gray-500 text-xs md:text-sm font-medium">
                        내가 완료한 미션과 다녀온 코스들을 날짜별로 확인해보세요.
                    </p>
                </div>

                {/* 달력 영역 */}
                <div className="p-4 md:p-6">
                    {/* 🟢 달력 헤더 (월 네비게이션) - 가운데 정렬 */}
                    <div className="flex  mb-4">
                        <div className="relative">
                            <button
                                onClick={() => setShowMonthDropdown(!showMonthDropdown)}
                                className="text-lg font-bold text-gray-900 flex items-center gap-1 hover:text-emerald-600 transition-colors"
                            >
                                {monthNames[currentMonth.getMonth()]}의 {userName}
                                <svg
                                    className={`w-4 h-4 text-gray-400 transition-transform ${
                                        showMonthDropdown ? "rotate-180" : ""
                                    }`}
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
                                    <div className="fixed inset-0 z-10" onClick={() => setShowMonthDropdown(false)} />
                                    {/* 드롭다운 메뉴 */}
                                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20 min-w-[120px]">
                                        {monthNames.map((month, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => handleMonthSelect(idx)}
                                                className={`w-full text-left px-4 py-2 text-sm hover:bg-emerald-50 transition-colors ${
                                                    currentMonth.getMonth() === idx
                                                        ? "bg-emerald-50 text-emerald-600 font-bold"
                                                        : "text-gray-700"
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

                    {/* 🟢 버튼 섹션 (완료 코스, AI 추천) */}
                    <div className="flex items-center justify-center gap-3 mb-6">
                        <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                            <svg
                                className="w-5 h-5 text-gray-600"
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
                            <span className="text-sm font-medium text-gray-700">완료 코스</span>
                            <span className="text-sm font-bold text-gray-900 ml-1">{completed.length}</span>
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                            <svg
                                className="w-5 h-5 text-gray-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                                />
                            </svg>
                            <span className="text-sm font-medium text-gray-700">AI 추천</span>
                            <span className="text-sm font-bold text-gray-900 ml-1">{aiRecommendations.length}</span>
                        </button>
                    </div>

                    {/* 달력 그리드 */}
                    <div className="grid grid-cols-7 gap-1 mb-4">
                        {/* 요일 헤더 */}
                        {dayNames.map((day, idx) => (
                            <div
                                key={day}
                                className={`text-center text-xs font-medium py-2 ${
                                    idx === 0 ? "text-red-500" : "text-gray-500"
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
                            // 🟢 모든 항목 개수 계산
                            const totalItemsCount =
                                (dateItems?.courses?.length || 0) + (dateItems?.aiRecommendations?.length || 0);

                            return (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        if (day.hasItems) {
                                            setSelectedDate(day.date);
                                            const dateItems = itemsByDate.get(day.dateKey);

                                            // 🟢 모든 항목 통합 (완료 코스 + AI 추천)
                                            const allItems = [
                                                ...(dateItems?.courses || []),
                                                ...(dateItems?.aiRecommendations || []),
                                            ];

                                            if (allItems.length === 1) {
                                                // 🟢 [Case 1]: 코스가 1개일 때 -> 즉시 상세 모달
                                                const singleItem = allItems[0];
                                                const courseId =
                                                    singleItem.course_id ||
                                                    singleItem.course?.id ||
                                                    singleItem.course?.course_id;
                                                if (courseId) {
                                                    handleCourseClick(String(courseId));
                                                }
                                            } else if (allItems.length > 1) {
                                                // 🟢 [Case 2]: 코스가 2개 이상일 때 -> 가로 스크롤 상세 모달 오픈
                                                // 🟢 [Performance]: 모달을 열기 전에 이미지 프리로드 시작
                                                const dateItems = itemsByDate.get(day.dateKey);
                                                if (dateItems) {
                                                    // 🟢 이미지 프리로드를 먼저 시작 (모달 열기 전)
                                                    const allCourses = [
                                                        ...(dateItems.courses || []),
                                                        ...(dateItems.aiRecommendations || []).map(
                                                            (item) => item.course || item
                                                        ),
                                                    ];
                                                    allCourses.forEach((course, idx) => {
                                                        const courseId = course?.id || course?.course_id;
                                                        if (courseId && !courseImages[courseId] && !course?.imageUrl) {
                                                            // 🟢 첫 번째 이미지는 즉시 로드 시작
                                                            if (idx === 0) {
                                                                getCourseImage(courseId).catch(() => {});
                                                            } else {
                                                                // 🟢 나머지는 약간의 지연 후 로드 (초기 렌더링 우선)
                                                                setTimeout(() => {
                                                                    getCourseImage(courseId).catch(() => {});
                                                                }, idx * 30); // 🟢 30ms 간격으로 순차 로드
                                                            }
                                                        }
                                                    });
                                                }
                                                // 🟢 [Performance]: 다음 프레임에서 모달 열기 (이미지 프리로드 시간 확보)
                                                requestAnimationFrame(() => {
                                                    setShowDateCoursesModal(true);
                                                });
                                            }
                                        }
                                        // 🟢 [Case 3]: 항목이 없으면 아무 일도 일어나지 않음 (기본 동작)
                                    }}
                                    className={`relative aspect-square flex flex-col items-center justify-start pt-1.5 pb-1 transition-all ${
                                        !day.isCurrentMonth
                                            ? "opacity-30"
                                            : day.hasItems
                                            ? "cursor-pointer hover:bg-emerald-50 rounded-lg"
                                            : "cursor-default"
                                    }`}
                                >
                                    {/* 날짜 숫자 */}
                                    <span
                                        className={`text-sm ${
                                            !day.isCurrentMonth
                                                ? "text-gray-300"
                                                : isSunday || day.date.getDay() === 6 // 토요일도 빨간색
                                                ? "text-red-500"
                                                : isSelected
                                                ? "text-emerald-600 font-bold"
                                                : isToday
                                                ? "text-emerald-600 font-bold"
                                                : "text-gray-700"
                                        }`}
                                    >
                                        {day.date.getDate()}
                                    </span>

                                    {/* 점선 원형 아웃라인 - 모든 날짜에 표시 */}
                                    <div
                                        className={`absolute bottom-2 left-1/2 transform -translate-x-1/2 w-12 h-12 rounded-full border-2 border-dashed flex items-center justify-center ${
                                            isToday
                                                ? "border-emerald-600" // 🟢 오늘 날짜: 진한 녹색
                                                : day.hasItems
                                                ? "border-gray-300" // 🟢 완료 항목 있는 날짜: 회색
                                                : "border-gray-200" // 🟢 빈 날짜: 연한 회색
                                        }`}
                                    >
                                        {/* 완료 항목이 있으면 작은 표시점 또는 이미지 */}
                                        {day.hasItems &&
                                            (firstCourse?.imageUrl ? (
                                                <div className="relative w-10 h-10">
                                                    <div
                                                        className="w-10 h-10 rounded-full overflow-hidden border border-gray-200 cursor-pointer hover:scale-110 transition-transform z-20"
                                                        onClick={(e) => {
                                                            e.stopPropagation(); // 🟢 버튼 클릭 이벤트와 분리
                                                            if (firstCourse) {
                                                                handleCourseClick(firstCourse.course_id);
                                                            }
                                                        }}
                                                    >
                                                        <Image
                                                            src={firstCourse.imageUrl}
                                                            alt={firstCourse.title}
                                                            width={40}
                                                            height={40}
                                                            className="w-full h-full object-cover"
                                                            loading="lazy"
                                                            quality={60}
                                                        />
                                                    </div>
                                                    {/* 🟢 여러 개일 때 개수 배지 표시 */}
                                                    {totalItemsCount > 1 && (
                                                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white z-30">
                                                            <span className="text-[9px] font-black text-white">
                                                                {totalItemsCount}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : firstAiRecommendation?.course?.imageUrl ? (
                                                <div className="relative w-10 h-10">
                                                    <div
                                                        className="w-10 h-10 rounded-full overflow-hidden border border-gray-200 cursor-pointer hover:scale-110 transition-transform z-20"
                                                        onClick={(e) => {
                                                            e.stopPropagation(); // 🟢 버튼 클릭 이벤트와 분리
                                                            const courseId =
                                                                firstAiRecommendation.course?.id ||
                                                                firstAiRecommendation.course?.course_id;
                                                            if (courseId) {
                                                                handleCourseClick(String(courseId));
                                                            }
                                                        }}
                                                    >
                                                        <Image
                                                            src={firstAiRecommendation.course.imageUrl}
                                                            alt={firstAiRecommendation.course.title}
                                                            width={40}
                                                            height={40}
                                                            className="w-full h-full object-cover"
                                                            loading="lazy"
                                                            quality={60}
                                                        />
                                                    </div>
                                                    {/* 🟢 여러 개일 때 개수 배지 표시 */}
                                                    {totalItemsCount > 1 && (
                                                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white z-30">
                                                            <span className="text-[9px] font-black text-white">
                                                                {totalItemsCount}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="relative">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                                    {/* 🟢 여러 개일 때 개수 배지 표시 */}
                                                    {totalItemsCount > 1 && (
                                                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center border border-white z-30">
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
            </div>

            {/* 🟢 [Swipe Detail Modal]: 2개 이상의 코스 가로 스와이프 뷰 */}
            {showDateCoursesModal && selectedDate && selectedDateItems && (
                <div
                    className="fixed inset-0 z-[5000] bg-black/70 flex items-center justify-center backdrop-blur-md animate-in fade-in duration-300"
                    onClick={() => setShowDateCoursesModal(false)}
                >
                    {/* 닫기 버튼 */}
                    <button
                        onClick={() => setShowDateCoursesModal(false)}
                        className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center bg-white/20 backdrop-blur-md rounded-full transition-colors text-white hover:bg-white/30 z-10"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* 가로 스크롤 컨테이너: 카드들이 snap 정렬됨 */}
                    <div
                        className="flex w-full overflow-x-auto snap-x snap-mandatory scrollbar-hide px-8 gap-6 items-center"
                        style={{
                            WebkitOverflowScrolling: "touch",
                            maxHeight: "90vh",
                            scrollBehavior: "smooth", // 🟢 부드러운 스크롤
                            willChange: "scroll-position", // 🟢 GPU 가속으로 스크롤 성능 향상
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {[
                            ...(selectedDateItems.courses || []).map((c) => ({
                                ...c,
                                isAI: false,
                                course: c, // 🟢 완료 코스는 자기 자신이 course
                            })),
                            ...(selectedDateItems.aiRecommendations || []).map((item) => ({
                                ...item,
                                course: item.course || item,
                                isAI: true,
                            })),
                        ]
                            .filter((item) => {
                                // 🟢 유효한 코스 ID가 있는 항목만 필터링
                                const course = item.course || item;
                                const courseId = course?.id || course?.course_id || item.course_id;
                                return !!courseId;
                            })
                            .map((item, idx) => {
                                // 🟢 디버깅: 모든 코스가 표시되는지 확인
                                if (idx === 0) {
                                    console.log(
                                        "[FootprintTab] 가로 스크롤 모달 코스 개수:",
                                        [
                                            ...(selectedDateItems.courses || []),
                                            ...(selectedDateItems.aiRecommendations || []),
                                        ].length
                                    );
                                }
                                const course = item.course || item;
                                const courseId = course?.id || course?.course_id || item.course_id;
                                const isAI = item.isAI || !!item.savedAt;

                                return (
                                    <div
                                        key={`${courseId}-${idx}`}
                                        className="snap-center flex-shrink-0 w-[340px] bg-white rounded-[2.5rem] overflow-hidden shadow-2xl relative"
                                    >
                                        {/* 상단 이미지 (높이 최적화) */}
                                        <div className="relative w-full h-44 bg-gray-900">
                                            {course?.imageUrl || courseImages[courseId] ? (
                                                <Image
                                                    src={course?.imageUrl || courseImages[courseId] || ""}
                                                    alt={course?.title || "Course"}
                                                    fill
                                                    className="object-cover opacity-90"
                                                    sizes="340px"
                                                    priority={false} // 🟢 모달 내부 이미지는 priority 제거 (preload 경고 방지)
                                                    loading="lazy" // 🟢 모든 이미지 lazy loading (모달이 열릴 때만 로드)
                                                    quality={idx < 2 ? 70 : 60} // 🟢 첫 2개는 높은 quality, 나머지는 낮은 quality
                                                    fetchPriority="auto" // 🟢 auto로 설정하여 preload 경고 방지
                                                    unoptimized={false}
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-gray-200 animate-pulse flex items-center justify-center">
                                                    <div className="text-gray-400 text-2xl">📍</div>
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent"></div>

                                            {/* 배지 */}
                                            <div className="absolute bottom-4 left-5 flex gap-2">
                                                {!isAI ? (
                                                    <span className="px-2 py-0.5 bg-emerald-500 text-white text-[9px] font-black rounded-md flex items-center gap-1">
                                                        <CheckCircle className="w-2.5 h-2.5" /> VERIFIED
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 bg-amber-500 text-white text-[9px] font-black rounded-md flex items-center gap-1">
                                                        <Sparkles className="w-2.5 h-2.5" /> AI SELECTED
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* 내용 */}
                                        <div className="p-6">
                                            <div className="mb-4">
                                                <span className="text-emerald-600 text-[8px] font-black tracking-widest uppercase block mb-1">
                                                    PRIVATE ARCHIVING
                                                </span>
                                                <h4 className="text-lg font-black text-gray-900 leading-tight">
                                                    {course?.title || item.title || "코스"}
                                                </h4>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 mb-6">
                                                <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
                                                    <div className="flex items-center gap-1 mb-0.5">
                                                        <MapPin className="w-3 h-3 text-emerald-600" />
                                                        <span className="text-[8px] font-bold text-gray-400 uppercase">
                                                            REGION
                                                        </span>
                                                    </div>
                                                    <span className="text-xs font-black text-gray-800 truncate block">
                                                        {course?.region || item.region || "서울"}
                                                    </span>
                                                </div>
                                                <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
                                                    <div className="flex items-center gap-1 mb-0.5">
                                                        <Zap className="w-3 h-3 text-emerald-600" />
                                                        <span className="text-[8px] font-bold text-gray-400 uppercase">
                                                            CONCEPT
                                                        </span>
                                                    </div>
                                                    <span className="text-xs font-black text-gray-800 truncate block">
                                                        {course?.concept || item.concept || "데이트"}
                                                    </span>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => {
                                                    setShowDateCoursesModal(false);
                                                    router.push(`/courses/${courseId}`);
                                                }}
                                                className="w-full py-4 bg-gray-900 text-white rounded-xl font-black text-sm hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2"
                                            >
                                                <span>설계도 다시보기</span>
                                                <ChevronRight className="w-4 h-4 opacity-50" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>

                    {/* 안내 텍스트: 여러 개일 때만 표시 */}
                    {selectedDateItems.courses.length + selectedDateItems.aiRecommendations.length > 1 && (
                        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/60 text-xs font-bold animate-pulse">
                            옆으로 밀어서 더보기 ➔
                        </div>
                    )}
                </div>
            )}
            {/* 🟢 [Compact Version]: 세로 높이 최적화 및 상업적 UI */}
            {showCourseModal && (
                <div
                    className="fixed inset-0 z-[5000] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setShowCourseModal(false)}
                >
                    <div
                        className="bg-white rounded-[2rem] w-full max-w-[380px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {loadingDetail && !courseDetail ? (
                            <div className="flex flex-col items-center justify-center py-16">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mb-3"></div>
                                <p className="text-gray-400 text-xs font-bold tracking-tighter">아카이브 로드 중...</p>
                            </div>
                        ) : courseDetail ? (
                            <div className="relative">
                                {/* 상단 이미지 영역: h-64 -> h-52로 축소 */}
                                <div className="relative w-full h-52 bg-gray-900">
                                    {courseDetail.imageUrl && (
                                        <Image
                                            src={courseDetail.imageUrl}
                                            alt={courseDetail.title}
                                            fill
                                            className="object-cover opacity-85"
                                            priority
                                            sizes="380px"
                                        />
                                    )}
                                    <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-black/10"></div>

                                    <button
                                        onClick={() => setShowCourseModal(false)}
                                        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-black/40 transition-all"
                                    >
                                        ｘ
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
                                <div className="p-6">
                                    <div className="mb-4">
                                        <span className="text-emerald-600 text-[9px] font-black tracking-[0.2em] uppercase mb-1 block">
                                            Private Archiving
                                        </span>
                                        <h4 className="text-xl font-black text-gray-900 leading-tight tracking-tighter">
                                            {courseDetail.title}
                                        </h4>
                                    </div>

                                    <p className="text-gray-500 text-[13px] leading-snug mb-5 line-clamp-3 font-medium">
                                        {courseDetail.description || "저장된 코스 상세 내역입니다."}
                                    </p>

                                    {/* 정보 그리드: 간격 축소 */}
                                    <div className="grid grid-cols-2 gap-3 mb-6">
                                        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100/50">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <MapPin className="w-3 h-3 text-emerald-600" />
                                                <span className="text-[9px] font-bold text-gray-400 uppercase">
                                                    Region
                                                </span>
                                            </div>
                                            <span className="text-xs font-black text-gray-800">
                                                {courseDetail.region || "서울"}
                                            </span>
                                        </div>
                                        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100/50">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <Zap className="w-3 h-3 text-emerald-600" />
                                                <span className="text-[9px] font-bold text-gray-400 uppercase">
                                                    Concept
                                                </span>
                                            </div>
                                            <span className="text-xs font-black text-gray-800">
                                                {courseDetail.concept || "데이트"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* CTA 버튼: 높이 조정 */}
                                    <button
                                        onClick={() => {
                                            setShowCourseModal(false);
                                            router.push(`/courses/${courseDetail.id}`);
                                        }}
                                        className="w-full py-4 bg-gray-900 text-white rounded-xl font-black text-base hover:bg-black transition-all active:scale-[0.98] shadow-lg flex items-center justify-center gap-2"
                                    >
                                        <span>설계도 다시보기</span>
                                        <ChevronRight className="w-4 h-4 opacity-50" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-12 p-6">
                                <p className="text-gray-400 text-sm font-bold">정보를 불러올 수 없습니다.</p>
                                <button
                                    onClick={() => setShowCourseModal(false)}
                                    className="mt-4 px-6 py-2 bg-gray-100 text-gray-900 rounded-lg text-sm font-bold"
                                >
                                    닫기
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FootprintTab;
