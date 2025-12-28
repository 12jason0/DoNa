"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CasefileItem, CompletedCourse } from "@/types/user";

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
    userName?: string; // 🟢 사용자 이름
}

const FootprintTab = ({ casefiles, completed, userName = "회원" }: FootprintTabProps) => {
    const router = useRouter();
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [showMonthDropdown, setShowMonthDropdown] = useState(false); // 🟢 월 선택 드롭다운 표시 여부
    const [selectedCourse, setSelectedCourse] = useState<CompletedCourse | null>(null);
    const [showCourseModal, setShowCourseModal] = useState(false);
    const [courseDetail, setCourseDetail] = useState<any>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    // 🟢 각 코스의 이미지 URL을 저장 (코스 ID -> 이미지 URL)
    const [courseImages, setCourseImages] = useState<Record<number | string, string>>({});

    // 🟢 날짜별로 완료 항목 그룹화
    const itemsByDate = useMemo(() => {
        const map = new Map<string, { courses: CompletedCourse[]; casefiles: CasefileItem[] }>();

        completed.forEach((course) => {
            if (course.completedAt) {
                const date = new Date(course.completedAt);
                const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
                    date.getDate()
                ).padStart(2, "0")}`;
                if (!map.has(dateKey)) {
                    map.set(dateKey, { courses: [], casefiles: [] });
                }
                map.get(dateKey)!.courses.push(course);
            }
        });

        casefiles.forEach((casefile) => {
            if (casefile.completedAt) {
                const date = new Date(casefile.completedAt);
                const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
                    date.getDate()
                ).padStart(2, "0")}`;
                if (!map.has(dateKey)) {
                    map.set(dateKey, { courses: [], casefiles: [] });
                }
                map.get(dateKey)!.casefiles.push(casefile);
            }
        });

        return map;
    }, [completed, casefiles]);

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
        return itemsByDate.get(dateKey) || { courses: [], casefiles: [] };
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

    // 🟢 코스 이미지 가져오기 (코스 이미지가 없으면 첫 번째 장소 이미지 사용)
    const getCourseImage = async (courseId: number | string): Promise<string> => {
        // 이미 캐시된 이미지가 있으면 반환
        if (courseImages[courseId]) {
            return courseImages[courseId];
        }

        try {
            const res = await fetch(`/api/courses/${courseId}`);
            if (res.ok) {
                const data = await res.json();
                // 코스 이미지가 있으면 사용, 없으면 첫 번째 장소 이미지 사용
                const imageUrl =
                    data.imageUrl?.trim() ||
                    data.coursePlaces?.[0]?.place?.imageUrl?.trim() ||
                    data.coursePlaces?.[0]?.place?.image_url?.trim() ||
                    "";

                if (imageUrl) {
                    setCourseImages((prev) => ({ ...prev, [courseId]: imageUrl }));
                    return imageUrl;
                }
            }
        } catch (error) {
            console.error("코스 이미지 조회 실패:", error);
        }
        return "";
    };

    // 🟢 코스 클릭 핸들러
    const handleCourseClick = async (courseId: number | string) => {
        setLoadingDetail(true);
        setShowCourseModal(true);
        try {
            const res = await fetch(`/api/courses/${courseId}`);
            if (res.ok) {
                const data = await res.json();
                setCourseDetail(data);
                const foundCourse = completed.find((c) => c.course_id === Number(courseId));
                if (foundCourse) {
                    setSelectedCourse(foundCourse);
                }
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

                    {/* 🟢 버튼 섹션 (완료 코스, 완료 사건) */}
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
                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                            </svg>
                            <span className="text-sm font-medium text-gray-700">완료 사건</span>
                            <span className="text-sm font-bold text-gray-900 ml-1">{casefiles.length}</span>
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
                            const firstCasefile = dateItems?.casefiles?.[0];

                            return (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        if (day.hasItems) {
                                            setSelectedDate(day.date);
                                            // 🟢 첫 번째 코스가 있으면 바로 모달 표시
                                            if (firstCourse) {
                                                handleCourseClick(firstCourse.course_id);
                                            }
                                        }
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
                                                <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-200">
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
                                            ) : firstCasefile?.imageUrl ? (
                                                <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-200">
                                                    <Image
                                                        src={firstCasefile.imageUrl}
                                                        alt={firstCasefile.title}
                                                        width={40}
                                                        height={40}
                                                        className="w-full h-full object-cover"
                                                        loading="lazy"
                                                        quality={60}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
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

            {/* 선택한 날짜의 완료 항목 목록 */}
            {selectedDate &&
                selectedDateItems &&
                (selectedDateItems.courses.length > 0 || selectedDateItems.casefiles.length > 0) && (
                    <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-5 md:p-8 border-b border-gray-50">
                            <h3 className="text-lg md:text-2xl font-bold text-gray-900 mb-1 tracking-tight">
                                {selectedDate.getFullYear()}년 {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}
                                일
                            </h3>
                            <p className="text-gray-500 text-xs md:text-sm font-medium">이 날 완료한 항목들입니다.</p>
                        </div>
                        <div className="p-4 md:p-6 space-y-4">
                            {/* 완료한 코스 */}
                            {selectedDateItems.courses.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-bold text-gray-700 mb-3">
                                        완료한 코스 ({selectedDateItems.courses.length})
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {selectedDateItems.courses.map((course) => (
                                            <div
                                                key={course.course_id}
                                                onClick={() => {
                                                    setSelectedCourse(course);
                                                    handleCourseClick(course.course_id);
                                                }}
                                                className="bg-gray-50 hover:bg-gray-100 rounded-xl p-4 cursor-pointer transition-all border border-gray-200 hover:border-emerald-300 hover:shadow-md"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0 relative">
                                                        {course.imageUrl ? (
                                                            <Image
                                                                src={course.imageUrl}
                                                                alt={course.title}
                                                                fill
                                                                className="object-cover"
                                                                sizes="64px"
                                                                loading="lazy" // 🟢 성능 최적화: lazy loading 적용
                                                                quality={70} // 🟢 성능 최적화: quality 설정
                                                                onError={async () => {
                                                                    const imageUrl = await getCourseImage(
                                                                        course.course_id
                                                                    );
                                                                    if (imageUrl && !courseImages[course.course_id]) {
                                                                        setCourseImages((prev) => ({
                                                                            ...prev,
                                                                            [course.course_id]: imageUrl,
                                                                        }));
                                                                    }
                                                                }}
                                                            />
                                                        ) : courseImages[course.course_id] ? (
                                                            <Image
                                                                src={courseImages[course.course_id]}
                                                                alt={course.title}
                                                                fill
                                                                className="object-cover"
                                                                sizes="64px"
                                                                loading="lazy" // 🟢 성능 최적화: lazy loading 적용
                                                                quality={70} // 🟢 성능 최적화: quality 설정
                                                            />
                                                        ) : (
                                                            <CourseImageLoader
                                                                courseId={course.course_id}
                                                                isVisible={true} // 🟢 선택된 날짜의 항목은 활성화된 상태
                                                                onImageLoaded={(url) => {
                                                                    if (url) {
                                                                        setCourseImages((prev) => ({
                                                                            ...prev,
                                                                            [course.course_id]: url,
                                                                        }));
                                                                    }
                                                                }}
                                                            />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h5 className="font-bold text-gray-900 text-sm md:text-base mb-1 line-clamp-2">
                                                            {course.title}
                                                        </h5>
                                                        {course.completedAt && (
                                                            <p className="text-xs text-gray-500">
                                                                완료일:{" "}
                                                                {new Date(course.completedAt).toLocaleDateString(
                                                                    "ko-KR"
                                                                )}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 완료한 사건 */}
                            {selectedDateItems.casefiles.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-bold text-gray-700 mb-3">
                                        완료한 사건 ({selectedDateItems.casefiles.length})
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {selectedDateItems.casefiles.map((casefile) => (
                                            <div
                                                key={casefile.story_id}
                                                className="bg-gray-50 hover:bg-gray-100 rounded-xl p-4 cursor-pointer transition-all border border-gray-200 hover:border-emerald-300 hover:shadow-md"
                                                onClick={() => router.push(`/escape?storyId=${casefile.story_id}`)}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0 relative">
                                                        {casefile.imageUrl ? (
                                                            <Image
                                                                src={casefile.imageUrl}
                                                                alt={casefile.title}
                                                                fill
                                                                className="object-cover"
                                                                sizes="64px"
                                                                loading="lazy" // 🟢 성능 최적화: lazy loading 적용
                                                                quality={70} // 🟢 성능 최적화: quality 설정
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl">
                                                                🔒
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h5 className="font-bold text-gray-900 text-sm md:text-base mb-1 line-clamp-2">
                                                            {casefile.title}
                                                        </h5>
                                                        {casefile.completedAt && (
                                                            <p className="text-xs text-gray-500">
                                                                완료일:{" "}
                                                                {new Date(casefile.completedAt).toLocaleDateString(
                                                                    "ko-KR"
                                                                )}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

            {/* 🟢 코스 상세 모달 */}
            {showCourseModal && (
                <div
                    className="fixed inset-0 z-[5000] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in"
                    onClick={() => setShowCourseModal(false)}
                >
                    <div
                        className="bg-white rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl animate-zoom-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {loadingDetail ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
                            </div>
                        ) : courseDetail ? (
                            <>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-xl font-bold text-gray-900">코스 정보</h3>
                                    <button
                                        onClick={() => setShowCourseModal(false)}
                                        className="w-8 h-8  flex items-center justify-center bg-gray-100 rounded-full transition-colors text-black"
                                    >
                                        X
                                    </button>
                                </div>
                                {courseDetail.imageUrl && (
                                    <div className="w-full h-48 rounded-xl overflow-hidden mb-4 bg-gray-100">
                                        <Image
                                            src={courseDetail.imageUrl}
                                            alt={courseDetail.title}
                                            width={400}
                                            height={200}
                                            className="w-full h-full object-cover"
                                            loading="lazy" // 🟢 성능 최적화: 모달 이미지도 lazy loading
                                            quality={75} // 🟢 모달은 조금 더 높은 quality
                                        />
                                    </div>
                                )}
                                <h4 className="text-lg font-bold text-gray-900 mb-2">{courseDetail.title}</h4>
                                {courseDetail.description && (
                                    <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                                        {courseDetail.description}
                                    </p>
                                )}
                                <div className="flex gap-2 mb-4">
                                    {courseDetail.region && (
                                        <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
                                            {courseDetail.region}
                                        </span>
                                    )}
                                    {courseDetail.concept && (
                                        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                                            {courseDetail.concept}
                                        </span>
                                    )}
                                </div>
                                <button
                                    onClick={() => {
                                        setShowCourseModal(false);
                                        // 🟢 성능 최적화: prefetch 후 이동
                                        router.prefetch(`/courses/${courseDetail.id}`);
                                        router.push(`/courses/${courseDetail.id}`);
                                    }}
                                    className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors"
                                >
                                    코스 상세 보기
                                </button>
                            </>
                        ) : (
                            <div className="text-center py-8">
                                <p className="text-gray-500">코스 정보를 불러올 수 없습니다.</p>
                                <button
                                    onClick={() => setShowCourseModal(false)}
                                    className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
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
