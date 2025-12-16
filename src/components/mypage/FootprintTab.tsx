"use client";

import React from "react";
import MyFootprintMap from "@/components/MyFootprintMap";
import { CasefileItem, CompletedCourse } from "@/types/user";

interface FootprintTabProps {
    casefiles: CasefileItem[];
    completed: CompletedCourse[];
}

const FootprintTab = ({ casefiles, completed }: FootprintTabProps) => {
    // 화면 테스트를 위해 서울 주변 임의 좌표 생성 로직 (기존 유지)
    const mapVisitedPlaces = [
        // 1. 완료한 사건 파일 (Escape) 매핑
        ...casefiles.map((file) => ({
            id: `case-${file.story_id}`,
            name: file.title,
            // 임시 좌표: 서울 중심에서 조금씩 떨어진 위치
            lat: 37.5665 + (Math.random() - 0.5) * 0.05,
            lng: 126.978 + (Math.random() - 0.5) * 0.05,
            type: "escape" as const,
        })),
        // 2. 완료한 코스 (Course) 매핑 (단일 마커로 표시)
        ...completed.map((course) => ({
            id: `course-${course.course_id}`,
            name: course.title,
            // 임시 좌표
            lat: 37.5665 + (Math.random() - 0.5) * 0.05,
            lng: 126.978 + (Math.random() - 0.5) * 0.05,
            type: "course_spot" as const,
        })),
    ];

    // 3. 코스 경로 데이터 매핑 (API에 경로 데이터가 있다면 사용)
    const mapCourses = completed.map((course) => ({
        id: course.course_id,
        title: course.title,
        path: [
            // 임시 경로 (직선)
            { lat: 37.5665, lng: 126.978 },
            {
                lat: 37.5665 + (Math.random() - 0.5) * 0.05,
                lng: 126.978 + (Math.random() - 0.5) * 0.05,
            },
        ],
    }));

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
                <div className="p-6 md:p-8 border-b border-gray-100">
                    <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">내 발자취 👣</h3>
                    <p className="text-gray-500 text-sm">내가 완료한 미션과 다녀온 코스들을 지도에서 확인해보세요.</p>
                </div>
                {/* 지도 컨테이너 */}
                <div className="w-full h-[500px] md:h-[600px] relative bg-gray-50">
                    {casefiles.length > 0 || completed.length > 0 ? (
                        <MyFootprintMap visitedPlaces={mapVisitedPlaces} courses={mapCourses} />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                            <div className="text-4xl mb-2">🗺️</div>
                            <p>아직 기록된 발자취가 없어요.</p>
                        </div>
                    )}
                </div>
                {/* 통계 정보 */}
                <div className="p-4 md:p-6 border-t border-gray-100 bg-gray-50">
                    <div className="flex items-center justify-center gap-6 md:gap-8 text-sm md:text-base">
                        <div className="text-center">
                            <div className="text-lg md:text-xl font-bold text-gray-900">{completed.length}</div>
                            <div className="text-gray-600">완료 코스</div>
                        </div>
                        <div className="w-px h-8 bg-gray-300"></div>
                        <div className="text-center">
                            <div className="text-lg md:text-xl font-bold text-gray-900">{casefiles.length}</div>
                            <div className="text-gray-600">완료 사건</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FootprintTab;
