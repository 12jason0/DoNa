"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
    Legend,
    PieChart,
    Pie,
    Cell,
} from "recharts";

interface StatsData {
    popularCourses: Array<{
        courseId: number;
        courseTitle: string;
        viewCount: number;
    }>;
    dailyActivity: Array<{
        date: string;
        dateLabel: string;
        count: number;
    }>;
    ageRangeStats: Array<{
        ageRange: string;
        count: number;
    }>;
    genderStats: Array<{
        gender: string;
        count: number;
    }>;
    summary: {
        totalInteractions: number;
        totalUsers: number;
        totalCourses: number;
    };
}

// 연령대별 고정 색상 매핑
const AGE_RANGE_COLORS: Record<string, string> = {
    "10대": "#3b82f6", // 파랑
    "20대": "#fbbf24", // 노랑
    "30대": "#10b981", // 초록
    "40대": "#ef4444", // 빨강
    "50대 이상": "#8b5cf6", // 보라
};

// 성별별 색상 매핑
const GENDER_COLORS: Record<string, string> = {
    M: "#3b82f6", // 남성: 파랑
    F: "#ec4899", // 여성: 핑크
};

// 연령대 색상 가져오기 함수
const getAgeRangeColor = (ageRange: string): string => {
    return AGE_RANGE_COLORS[ageRange] || "#6b7280"; // 기본값: 회색
};

// 성별 색상 가져오기 함수
const getGenderColor = (gender: string): string => {
    // "남성"/"여성" 또는 "M"/"F" 모두 처리
    if (gender === "남성" || gender === "M") return GENDER_COLORS["M"]; // 파랑
    if (gender === "여성" || gender === "F") return GENDER_COLORS["F"]; // 핑크
    return "#6b7280"; // 기본값: 회색
};

interface DemographicData {
    ageRange: string;
    gender: string;
    totalUsers: number;
    courses: Array<{
        courseId: number;
        title: string;
        subTitle: string | null;
        region: string;
        tags: string[];
        concept: string;
        duration: string;
        rating: number;
        viewCount: number;
        demographicViewCount: number;
    }>;
}

export default function AdminDashboard() {
    const [statsData, setStatsData] = useState<StatsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 조합 통계 관련 상태
    const [selectedAgeRange, setSelectedAgeRange] = useState("");
    const [selectedGender, setSelectedGender] = useState("");
    const [demographicData, setDemographicData] = useState<DemographicData | null>(null);
    const [demographicLoading, setDemographicLoading] = useState(false);
    const [demographicError, setDemographicError] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/admin/stats")
            .then((res) => {
                if (!res.ok) {
                    throw new Error("통계 데이터를 불러올 수 없습니다.");
                }
                return res.json();
            })
            .then((data) => {
                setStatsData(data);
                setLoading(false);
            })
            .catch((err) => {
                console.error("통계 데이터 로딩 오류:", err);
                setError(err.message || "데이터를 불러오는 중 오류가 발생했습니다.");
                setLoading(false);
            });
    }, []);

    const handleDemographicSearch = async () => {
        if (!selectedAgeRange || !selectedGender) {
            setDemographicData(null);
            return;
        }

        setDemographicLoading(true);
        setDemographicError(null);

        try {
            const response = await fetch(
                `/api/admin/stats/demographic?ageRange=${encodeURIComponent(
                    selectedAgeRange
                )}&gender=${encodeURIComponent(selectedGender)}`
            );

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "데이터를 불러올 수 없습니다.");
            }

            const data = await response.json();
            setDemographicData(data);
        } catch (err: any) {
            console.error("조합 통계 조회 오류:", err);
            setDemographicError(err.message || "데이터를 불러오는 중 오류가 발생했습니다.");
            setDemographicData(null);
        } finally {
            setDemographicLoading(false);
        }
    };

    // 연령대나 성별이 변경되면 자동으로 조회
    useEffect(() => {
        if (selectedAgeRange && selectedGender) {
            handleDemographicSearch();
        } else {
            // 필터가 없으면 조합 통계 데이터 초기화
            setDemographicData(null);
            setDemographicError(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedAgeRange, selectedGender]);

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-800">DoNa 관리자 대시보드</h1>

            {/* 통계 대시보드 섹션 */}
            <section className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-800">실시간 분석 대시보드</h2>

                {loading && (
                    <div className="bg-white p-8 rounded-xl shadow-sm border text-center text-gray-500">
                        데이터 로딩 중...
                    </div>
                )}

                {error && <div className="bg-red-50 border border-red-200 p-4 rounded-lg text-red-700">{error}</div>}

                {statsData && (
                    <>
                        {/* 요약 통계 카드 */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                <div className="text-sm text-gray-500 mb-1">전체 활동 로그</div>
                                <div className="text-3xl font-bold text-gray-900">
                                    {statsData.summary.totalInteractions.toLocaleString()}
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                <div className="text-sm text-gray-500 mb-1">활성 사용자</div>
                                <div className="text-3xl font-bold text-gray-900">
                                    {statsData.summary.totalUsers.toLocaleString()}
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                <div className="text-sm text-gray-500 mb-1">공개 코스 수</div>
                                <div className="text-3xl font-bold text-gray-900">
                                    {statsData.summary.totalCourses.toLocaleString()}
                                </div>
                            </div>
                        </div>

                        {/* 그래프 섹션 */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* 인기 코스 막대 그래프 (조합 통계 포함) */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-gray-700">
                                        {demographicData
                                            ? `${demographicData.ageRange} ${demographicData.gender} 인기 코스 TOP 10`
                                            : "인기 데이트 코스 TOP 5"}
                                    </h3>
                                </div>

                                {/* 필터 선택 */}
                                <div className="flex gap-2 mb-4">
                                    <select
                                        value={selectedAgeRange}
                                        onChange={(e) => setSelectedAgeRange(e.target.value)}
                                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                                    >
                                        <option value="">전체 연령대</option>
                                        <option value="10대">10대</option>
                                        <option value="20대">20대</option>
                                        <option value="30대">30대</option>
                                        <option value="40대">40대</option>
                                        <option value="50대 이상">50대 이상</option>
                                    </select>
                                    <select
                                        value={selectedGender}
                                        onChange={(e) => setSelectedGender(e.target.value)}
                                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                                    >
                                        <option value="">전체 성별</option>
                                        <option value="M">남성</option>
                                        <option value="F">여성</option>
                                    </select>
                                    {(selectedAgeRange || selectedGender) && (
                                        <button
                                            onClick={() => {
                                                setSelectedAgeRange("");
                                                setSelectedGender("");
                                                setDemographicData(null);
                                            }}
                                            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
                                        >
                                            초기화
                                        </button>
                                    )}
                                </div>

                                {/* 그래프 또는 테이블 표시 */}
                                {demographicLoading ? (
                                    <div className="h-64 flex items-center justify-center text-gray-400">
                                        조회 중...
                                    </div>
                                ) : demographicData && demographicData.courses.length > 0 ? (
                                    <div className="h-96 overflow-y-auto">
                                        <div className="mb-3 text-sm text-gray-500">
                                            해당 그룹 사용자 수: {demographicData.totalUsers.toLocaleString()}명
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                                                <thead className="bg-gray-50 sticky top-0">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                            순위
                                                        </th>
                                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                            코스명
                                                        </th>
                                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                            지역
                                                        </th>
                                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                            태그
                                                        </th>
                                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                            조회수
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {demographicData.courses.map((course, index) => (
                                                        <tr key={course.courseId} className="hover:bg-gray-50">
                                                            <td className="px-3 py-2 whitespace-nowrap font-semibold text-gray-900">
                                                                {index + 1}
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <div className="font-medium text-gray-900">
                                                                    {course.title}
                                                                </div>
                                                                {course.subTitle && (
                                                                    <div className="text-xs text-gray-500">
                                                                        {course.subTitle}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                                                                {course.region}
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <div className="flex flex-wrap gap-1">
                                                                    {course.tags.slice(0, 2).map((tag, i) => (
                                                                        <span
                                                                            key={i}
                                                                            className="inline-flex px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-800"
                                                                        >
                                                                            {tag}
                                                                        </span>
                                                                    ))}
                                                                    {course.tags.length > 2 && (
                                                                        <span className="text-xs text-gray-400">
                                                                            +{course.tags.length - 2}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2 whitespace-nowrap">
                                                                <div className="font-semibold text-green-600">
                                                                    {course.demographicViewCount.toLocaleString()}
                                                                </div>
                                                                <div className="text-xs text-gray-400">
                                                                    전체: {course.viewCount.toLocaleString()}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : demographicData && demographicData.courses.length === 0 ? (
                                    <div className="h-64 flex items-center justify-center text-gray-400">
                                        데이터가 없습니다
                                    </div>
                                ) : (
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={statsData.popularCourses}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                <XAxis
                                                    dataKey="courseTitle"
                                                    stroke="#888888"
                                                    fontSize={12}
                                                    angle={-45}
                                                    textAnchor="end"
                                                    height={80}
                                                />
                                                <YAxis stroke="#888888" fontSize={12} />
                                                <Tooltip
                                                    cursor={{ fill: "#f3f4f6" }}
                                                    formatter={(value: number | undefined) => [
                                                        value ? value.toLocaleString() : "0",
                                                        "조회수",
                                                    ]}
                                                />
                                                <Bar
                                                    dataKey="viewCount"
                                                    fill="#10b981"
                                                    radius={[4, 4, 0, 0]}
                                                    name="조회수"
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}

                                {demographicError && (
                                    <div className="mt-2 text-sm text-red-600">{demographicError}</div>
                                )}
                            </div>

                            {/* 활동량 라인 그래프 */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                <h3 className="text-lg font-semibold text-gray-700 mb-4">최근 7일 활동 트렌드</h3>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={statsData.dailyActivity}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="dateLabel" stroke="#888888" fontSize={12} />
                                            <YAxis stroke="#888888" fontSize={12} />
                                            <Tooltip
                                                formatter={(value: number | undefined) => [
                                                    value ? value.toLocaleString() : "0",
                                                    "로그 건수",
                                                ]}
                                            />
                                            <Legend />
                                            <Line
                                                type="monotone"
                                                dataKey="count"
                                                stroke="#3b82f6"
                                                strokeWidth={2}
                                                name="로그 건수"
                                                dot={{ fill: "#3b82f6", r: 4 }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* 연령대별 사용자 통계 (Pie Chart) */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                <h3 className="text-lg font-semibold text-gray-700 mb-4">연령대별 사용자 분포</h3>
                                <div className="h-64">
                                    {statsData.ageRangeStats.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={statsData.ageRangeStats}
                                                    cx="50%"
                                                    cy="50%"
                                                    labelLine={false}
                                                    label={({ ageRange, percent }: any) =>
                                                        `${ageRange || ""} ${percent ? (percent * 100).toFixed(0) : 0}%`
                                                    }
                                                    outerRadius={80}
                                                    fill="#8884d8"
                                                    dataKey="count"
                                                >
                                                    {statsData.ageRangeStats.map((entry, index) => (
                                                        <Cell
                                                            key={`cell-${index}`}
                                                            fill={getAgeRangeColor(entry.ageRange)}
                                                        />
                                                    ))}
                                                </Pie>
                                                <Tooltip
                                                    formatter={(value: number | undefined) => [
                                                        value ? value.toLocaleString() : "0",
                                                        "명",
                                                    ]}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-gray-400">
                                            데이터가 없습니다
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 성별별 사용자 통계 (Bar Chart) */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                <h3 className="text-lg font-semibold text-gray-700 mb-4">성별별 사용자 분포</h3>
                                <div className="h-64">
                                    {statsData.genderStats.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={statsData.genderStats}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                <XAxis
                                                    dataKey="gender"
                                                    stroke="#888888"
                                                    fontSize={12}
                                                    tickFormatter={(value) =>
                                                        value === "M" ? "남성" : value === "F" ? "여성" : value
                                                    }
                                                />
                                                <YAxis stroke="#888888" fontSize={12} />
                                                <Tooltip
                                                    cursor={{ fill: "#f3f4f6" }}
                                                    formatter={(value: number | undefined) => [
                                                        value ? value.toLocaleString() : "0",
                                                        "명",
                                                    ]}
                                                    labelFormatter={(value) =>
                                                        value === "M" ? "남성" : value === "F" ? "여성" : value
                                                    }
                                                />
                                                <Bar
                                                    dataKey="count"
                                                    radius={[4, 4, 0, 0]}
                                                    name="사용자 수"
                                                    shape={(props: any) => {
                                                        const {
                                                            payload,
                                                            stackedBarStart,
                                                            tooltipPosition,
                                                            parentViewBox,
                                                            isActive,
                                                            dataKey,
                                                            ...rectProps
                                                        } = props;
                                                        return (
                                                            <rect {...rectProps} fill={getGenderColor(payload.gender)} />
                                                        );
                                                    }}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-gray-400">
                                            데이터가 없습니다
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </section>

            {/* 메뉴 카드 그리드 */}
            <section className="space-y-4">
                <h2 className="text-2xl font-bold text-gray-800">관리 메뉴</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* 1. 코스 관리 */}
                    <Link href="/admin/courses" className="block group">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-green-500 transition cursor-pointer h-full">
                            <div className="text-3xl mb-4">🗺️</div>
                            <h3 className="text-xl font-bold text-gray-900 group-hover:text-green-600">코스 관리</h3>
                            <p className="text-gray-500 mt-2 text-sm">
                                데이트 코스를 생성, 수정하고 코스에 장소를 배치합니다.
                            </p>
                        </div>
                    </Link>

                    {/* 2. 장소 관리 */}
                    <Link href="/admin/places" className="block group">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-green-500 transition cursor-pointer h-full">
                            <div className="text-3xl mb-4">📍</div>
                            <h3 className="text-xl font-bold text-gray-900 group-hover:text-green-600">
                                장소 데이터베이스
                            </h3>
                            <p className="text-gray-500 mt-2 text-sm">
                                개별 장소(카페, 식당 등) 데이터를 추가하고 수정합니다.
                            </p>
                        </div>
                    </Link>

                    {/* 3. 알림 발송 */}
                    <Link href="/admin/notifications" className="block group">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-green-500 transition cursor-pointer h-full">
                            <div className="text-3xl mb-4">📢</div>
                            <h3 className="text-xl font-bold text-gray-900 group-hover:text-green-600">
                                푸시 알림 발송
                            </h3>
                            <p className="text-gray-500 mt-2 text-sm">
                                전체 유저 또는 구독자에게 이벤트 알림을 보냅니다.
                            </p>
                        </div>
                    </Link>

                    {/* 4. 장소 제보 검토 */}
                    <Link href="/admin/suggest" className="block group">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-green-500 transition cursor-pointer h-full">
                            <div className="text-3xl mb-4">📨</div>
                            <h3 className="text-xl font-bold text-gray-900 group-hover:text-green-600">
                                장소 제보 검토
                            </h3>
                            <p className="text-gray-500 mt-2 text-sm">
                                유저가 보낸 제보를 검토하고 주소/설명 보강 및 상태를 관리합니다.
                            </p>
                        </div>
                    </Link>

                    {/* 5. 방탈출 스토리 */}
                    <Link href="/admin/escape-stories" className="block group">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-green-500 transition cursor-pointer h-full">
                            <div className="text-3xl mb-4">🕵️‍♀️</div>
                            <h3 className="text-xl font-bold text-gray-900 group-hover:text-green-600">
                                이스케이프 스토리
                            </h3>
                            <p className="text-gray-500 mt-2 text-sm">방탈출 게임 시나리오와 스토리를 관리합니다.</p>
                        </div>
                    </Link>

                    {/* 6. 환불 관리 */}
                    <Link href="/admin/refunds" className="block group">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-green-500 transition cursor-pointer h-full">
                            <div className="text-3xl mb-4">💰</div>
                            <h3 className="text-xl font-bold text-gray-900 group-hover:text-green-600">
                                환불 관리
                            </h3>
                            <p className="text-gray-500 mt-2 text-sm">구독권 환불 요청을 확인하고 승인/거부합니다.</p>
                        </div>
                    </Link>
                </div>
            </section>
        </div>
    );
}
