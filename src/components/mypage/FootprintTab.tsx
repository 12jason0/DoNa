"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import MyFootprintMap from "@/components/MyFootprintMap";
import { CasefileItem, CompletedCourse } from "@/types/user";
import { getS3StaticUrl } from "@/lib/s3Static";

// 🟢 코스 이미지 로더 컴포넌트 (이미지가 없을 때 백그라운드에서 로드)
const CourseImageLoader = ({
    courseId,
    onImageLoaded,
}: {
    courseId: number | string;
    onImageLoaded: (url: string) => void;
}) => {
    const [loadedImageUrl, setLoadedImageUrl] = useState<string | null>(null);

    useEffect(() => {
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
    }, [courseId]); // onImageLoaded는 의존성에서 제외 (무한 루프 방지)

    // 이미지가 로드되면 Image 컴포넌트로 표시
    if (loadedImageUrl) {
        return <Image src={loadedImageUrl} alt="Course" fill className="object-cover" sizes="64px" />;
    }

    return <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl">📍</div>;
};

interface FootprintTabProps {
    casefiles: CasefileItem[];
    completed: CompletedCourse[];
}

const FootprintTab = ({ casefiles, completed }: FootprintTabProps) => {
    const router = useRouter();
    const [selectedCourse, setSelectedCourse] = useState<CompletedCourse | null>(null);
    const [showCourseModal, setShowCourseModal] = useState(false);
    const [courseDetail, setCourseDetail] = useState<any>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    // 🟢 각 코스의 이미지 URL을 저장 (코스 ID -> 이미지 URL)
    const [courseImages, setCourseImages] = useState<Record<number | string, string>>({});

    const hasData = casefiles.length > 0 || completed.length > 0;

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

    // 🟢 핀 클릭 핸들러
    const handlePlaceClick = async (place: {
        id: number | string;
        name: string;
        courseId?: number | string;
        type: "escape" | "course_spot";
    }) => {
        if (place.type === "course_spot" && place.courseId) {
            // 코스 상세 정보 가져오기
            setLoadingDetail(true);
            setShowCourseModal(true);
            try {
                const res = await fetch(`/api/courses/${place.courseId}`);
                if (res.ok) {
                    const data = await res.json();
                    setCourseDetail(data);
                    const foundCourse = completed.find((c) => c.course_id === Number(place.courseId));
                    if (foundCourse) {
                        setSelectedCourse(foundCourse);
                    }
                }
            } catch (error) {
                console.error("코스 상세 조회 실패:", error);
            } finally {
                setLoadingDetail(false);
            }
        }
    };

    // 📍 핀 매핑
    const mapVisitedPlaces = [
        ...casefiles.map((file, idx) => ({
            id: `case-${file.story_id}`,
            name: file.title,
            lat: 37.57 + idx * 0.01,
            lng: 126.98 - idx * 0.02,
            type: "escape" as const,
        })),
        ...completed.map((course, idx) => ({
            id: `course-${course.course_id}`,
            name: course.title,
            lat: 37.54 + idx * 0.02,
            lng: 127.05 - idx * 0.03,
            type: "course_spot" as const,
            courseId: course.course_id, // 🟢 코스 ID 추가
        })),
    ];

    const mapCourses = completed.map((course) => ({
        id: course.course_id,
        title: course.title,
        path: [],
    }));

    const bannerImageUrl = getS3StaticUrl("mypage/mypageMap.jpg");

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden relative">
                {/* 헤더 */}
                <div className="p-5 md:p-8 border-b border-gray-50 bg-white relative z-10">
                    <h3 className="text-lg md:text-2xl font-bold text-gray-900 mb-1 tracking-tight">내 발자취 👣</h3>
                    <p className="text-gray-500 text-xs md:text-sm font-medium">
                        내가 완료한 미션과 다녀온 코스들을 확인해보세요.
                    </p>
                </div>

                {/* 메인 영역 (높이 수정됨) */}
                {/* ✨ h-[350px]로 줄여서 모바일 한 화면에 꽉 차게 만듦 */}
                <div className="w-full h-[350px] md:h-[500px] relative bg-slate-50 overflow-hidden group">
                    {hasData ? (
                        /* [CASE 1: 데이터 있음] */
                        <div className="w-full h-full animate-[fadeIn_0.5s_ease-out] relative">
                            <div className="w-full h-full filter saturate-[0.6] sepia-[0.1] brightness-[1.05] contrast-[1.1]">
                                <MyFootprintMap
                                    visitedPlaces={mapVisitedPlaces}
                                    courses={mapCourses}
                                    onPlaceClick={handlePlaceClick}
                                />
                            </div>
                        </div>
                    ) : (
                        /* [CASE 2: 데이터 없음] */
                        <div className="w-full h-full relative flex flex-col items-center justify-center">
                            <div className="absolute inset-0 p-8">
                                <Image
                                    src={bannerImageUrl}
                                    alt="Korea Map Background"
                                    fill
                                    className="object-contain object-center grayscale opacity-50 mix-blend-multiply transform transition-transform duration-[10s] ease-in-out scale-100 group-hover:scale-105"
                                    priority
                                />
                            </div>
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-transparent via-white/20 to-white/90 pointer-events-none"></div>

                            {/* 카드 패딩 줄임 (p-6) */}
                            <div className="z-10 relative p-4 animate-[fadeIn_0.8s_ease-out]">
                                <div className="bg-white/90 backdrop-blur-xl p-6 md:p-10 rounded-[24px] shadow-[0_15px_40px_-12px_rgba(0,0,0,0.15)] border border-white/60 max-w-[280px] md:max-w-sm w-full text-center transform transition-transform hover:scale-[1.02] duration-300">
                                    <h4 className="text-lg md:text-xl font-extrabold text-gray-900 mb-2 leading-tight tracking-tight">
                                        나만의 지도를
                                        <br />
                                        완성해보세요!
                                    </h4>
                                    <div className="w-8 h-1 bg-gray-900/10 mx-auto mb-4 rounded-full"></div>
                                    <p className="text-gray-500 text-xs md:text-sm leading-relaxed mb-6 font-medium">
                                        지금은 빈 지도지만,
                                        <br />
                                        두나와 함께라면
                                        <br />
                                        <span className="text-gray-900 font-bold">예쁜 추억들로 가득 찰 거예요.</span>
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => router.push("/courses")}
                                        className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs md:text-sm font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 group tracking-tight"
                                    >
                                        <span>데이트 코스 보러가기</span>
                                        <svg
                                            className="w-3 h-3 md:w-4 md:h-4 group-hover:translate-x-1 transition-transform duration-300"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2.5"
                                                d="M13 7l5 5m0 0l-5 5m5-5H6"
                                            ></path>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 하단 통계 (높이 절약 위해 패딩 조정) */}
                <div className="px-6 py-4 border-t border-gray-50 bg-white/60 backdrop-blur-sm">
                    <div className="flex items-center justify-center gap-12">
                        <div className="text-center group cursor-default">
                            <div className="text-2xl md:text-3xl font-black text-gray-900 group-hover:text-[#5B21B6] transition-colors duration-300">
                                {completed.length}
                            </div>
                            <div className="text-[10px] md:text-[11px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                                완료 코스
                            </div>
                        </div>
                        <div className="w-px h-8 bg-gray-200"></div>
                        <div className="text-center group cursor-default">
                            <div className="text-2xl md:text-3xl font-black text-gray-900 group-hover:text-[#5B21B6] transition-colors duration-300">
                                {casefiles.length}
                            </div>
                            <div className="text-[10px] md:text-[11px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                                완료 사건
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 🟢 완료 코스 리스트 */}
            {completed.length > 0 && (
                <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-5 md:p-8 border-b border-gray-50">
                        <h3 className="text-lg md:text-2xl font-bold text-gray-900 mb-1 tracking-tight">완료한 코스</h3>
                        <p className="text-gray-500 text-xs md:text-sm font-medium">
                            총 {completed.length}개의 코스를 완료하셨습니다.
                        </p>
                    </div>
                    <div className="p-4 md:p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {completed.map((course) => (
                                <div
                                    key={course.course_id}
                                    onClick={() => {
                                        setSelectedCourse(course);
                                        handlePlaceClick({
                                            id: `course-${course.course_id}`,
                                            name: course.title,
                                            courseId: course.course_id,
                                            type: "course_spot",
                                        });
                                    }}
                                    className="bg-gray-50 hover:bg-gray-100 rounded-xl p-4 cursor-pointer transition-all border border-gray-200 hover:border-emerald-300 hover:shadow-md"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0 relative">
                                            {/* 🟢 우선순위: 코스 이미지 > 로드된 이미지 > 로더 */}
                                            {course.imageUrl ? (
                                                <Image
                                                    src={course.imageUrl}
                                                    alt={course.title}
                                                    fill
                                                    className="object-cover"
                                                    sizes="64px"
                                                    onError={async () => {
                                                        // 코스 이미지 로드 실패 시 첫 번째 장소 이미지 가져오기
                                                        const imageUrl = await getCourseImage(course.course_id);
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
                                                />
                                            ) : (
                                                <CourseImageLoader
                                                    courseId={course.course_id}
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
                                            <h4 className="font-bold text-gray-900 text-sm md:text-base mb-1 line-clamp-2">
                                                {course.title}
                                            </h4>
                                            {course.completedAt && (
                                                <p className="text-xs text-gray-500">
                                                    완료일: {new Date(course.completedAt).toLocaleDateString("ko-KR")}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
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
