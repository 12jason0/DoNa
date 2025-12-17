"use client";

import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import MyFootprintMap from "@/components/MyFootprintMap";
import { CasefileItem, CompletedCourse } from "@/types/user";

interface FootprintTabProps {
    casefiles: CasefileItem[];
    completed: CompletedCourse[];
}

const FootprintTab = ({ casefiles, completed }: FootprintTabProps) => {
    const router = useRouter();

    const hasData = casefiles.length > 0 || completed.length > 0;

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
        })),
    ];

    const mapCourses = completed.map((course) => ({
        id: course.course_id,
        title: course.title,
        path: [],
    }));

    const bannerImageUrl = "https://stylemap-seoul.s3.ap-northeast-2.amazonaws.com/mypage/mypageMap.jpg";

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
                                <MyFootprintMap visitedPlaces={mapVisitedPlaces} courses={mapCourses} />
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
        </div>
    );
};

export default FootprintTab;
