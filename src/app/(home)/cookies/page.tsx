"use client";

import React, { useState } from "react";

const CookiesPolicyPage = () => {
    const [expandedSection, setExpandedSection] = useState<string | null>(null);

    const toggleSection = (section: string) => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    const cookieData = [
        {
            name: "authToken",
            type: "필수",
            purpose: "사용자 로그인 상태 유지",
            duration: "7일",
            provider: "DoNa",
        },
        {
            name: "user",
            type: "필수",
            purpose: "사용자 기본 정보 저장",
            duration: "7일",
            provider: "DoNa",
        },
        {
            name: "loginTime",
            type: "필수",
            purpose: "로그인 시간 기록",
            duration: "브라우저 종료 시까지",
            provider: "DoNa",
        },
        {
            name: "cookie_consent",
            type: "필수",
            purpose: "쿠키 동의 여부 저장",
            duration: "1년",
            provider: "DoNa",
        },
        {
            name: "hideAiAdUntil",
            type: "기능성",
            purpose: "AI 광고 숨김 설정",
            duration: "사용자 설정",
            provider: "DoNa",
        },
        {
            name: "userCoupons",
            type: "기능성",
            purpose: "AI 추천 쿠폰 수 저장",
            duration: "영구",
            provider: "DoNa",
        },
        {
            name: "aboutPageData",
            type: "성능",
            purpose: "페이지 데이터 캐싱",
            duration: "세션",
            provider: "DoNa",
        },
        {
            name: "_kak*",
            type: "제3자",
            purpose: "카카오 로그인 및 지도 서비스",
            duration: "서비스별 상이",
            provider: "Kakao",
        },
    ];

    return (
        <div className="flex flex-col min-h-screen bg-white">
            <main className="flex-grow container mx-auto px-4 py-8 bg-white">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">쿠키 정책</h1>
                    <p className="text-gray-600 mb-6">
                        쿠키의 사용 목적과 관리 방법을 한눈에 확인할 수 있도록 정리했습니다.
                    </p>

                    {/* 베타 서비스 안내 */}
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-8">
                        <p className="text-sm text-blue-800">
                            🚀 현재 베타 서비스 운영 중입니다. 정식 서비스 시작 시 더 상세한 쿠키 정책으로 업데이트될
                            예정입니다.
                        </p>
                    </div>

                    <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed">
                        {/* 빠른 이동 */}
                        <div className="mb-6 flex flex-wrap gap-2">
                            <a
                                href="#what"
                                className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-800 text-sm hover:bg-white border"
                            >
                                쿠키란?
                            </a>
                            <a
                                href="#why"
                                className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-800 text-sm hover:bg-white border"
                            >
                                사용 목적
                            </a>
                            <a
                                href="#types"
                                className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-800 text-sm hover:bg-white border"
                            >
                                쿠키 유형
                            </a>
                            <a
                                href="#details"
                                className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-800 text-sm hover:bg-white border"
                            >
                                상세 정보
                            </a>
                            <a
                                href="#manage"
                                className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-800 text-sm hover:bg-white border"
                            >
                                관리 방법
                            </a>
                            <a
                                href="#contact"
                                className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-800 text-sm hover:bg-white border"
                            >
                                문의처
                            </a>
                            <a
                                href="#updates"
                                className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-800 text-sm hover:bg-white border"
                            >
                                정책 업데이트
                            </a>
                        </div>
                        <p className="mb-6">최종 업데이트: 2025년 1월 10일</p>

                        {/* 쿠키란? */}
                        <section id="what" className="mb-8 scroll-mt-24">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">쿠키란 무엇인가요?</h2>
                            <p className="mb-4">
                                쿠키는 웹사이트를 방문할 때 브라우저에 저장되는 작은 텍스트 파일입니다. 쿠키는
                                웹사이트가 제대로 작동하도록 하고, 더 안전하게 만들며, 더 나은 사용자 경험을 제공하고,
                                웹사이트 개선에 도움이 되는 정보를 제공합니다.
                            </p>
                            <p className="mb-4">
                                DoNa는 사용자 경험을 개선하고 맞춤형 서비스를 제공하기 위해 쿠키와 유사한 기술을
                                사용합니다.
                            </p>
                        </section>

                        {/* 쿠키 사용 목적 */}
                        <section id="why" className="mb-8 scroll-mt-24">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">쿠키를 사용하는 이유</h2>
                            <div className="space-y-4">
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <h3 className="font-semibold mb-2">🔐 인증 및 보안</h3>
                                    <p className="text-sm">로그인 상태를 유지하고 계정을 안전하게 보호합니다.</p>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <h3 className="font-semibold mb-2">⚙️ 기능 및 성능</h3>
                                    <p className="text-sm">
                                        서비스 속도를 향상시키고 사용자 설정을 저장하여 편리한 이용을 돕습니다.
                                    </p>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <h3 className="font-semibold mb-2">📊 분석 및 개선</h3>
                                    <p className="text-sm">서비스 이용 패턴을 분석하여 더 나은 서비스를 제공합니다.</p>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <h3 className="font-semibold mb-2">🎯 개인화</h3>
                                    <p className="text-sm">사용자의 선호도에 맞는 맞춤형 여행 코스를 추천합니다.</p>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <h3 className="font-semibold mb-2">🖼️ 사진 데이터 이용 범위</h3>
                                    <p className="text-sm">
                                        이용자가 업로드한 사진 데이터는 오직 서비스 내 '추억 액자' 기능 제공을 위한
                                        목적으로만 사용되며, 추천 알고리즘 학습, 광고 타게팅, 외부 제공 등 그 밖의
                                        용도로는 사용하지 않습니다.
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* 쿠키 유형 */}
                        <section id="types" className="mb-8 scroll-mt-24">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">사용하는 쿠키 유형</h2>

                            {/* 필수 쿠키 */}
                            <div className="mb-6">
                                <button
                                    onClick={() => toggleSection("essential")}
                                    className="hover:cursor-pointer w-full flex justify-between items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                                >
                                    <div className="flex items-center">
                                        <span className="text-2xl mr-3">🔒</span>
                                        <div className="text-left">
                                            <h3 className="font-semibold">필수 쿠키</h3>
                                            <p className="text-sm text-gray-600">
                                                서비스 이용에 반드시 필요한 쿠키입니다
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-gray-500">{expandedSection === "essential" ? "▼" : "▶"}</span>
                                </button>
                                {expandedSection === "essential" && (
                                    <div className="mt-2 p-4 bg-white border border-green-200 rounded-lg">
                                        <p className="text-sm mb-3">
                                            이 쿠키들은 웹사이트가 제대로 작동하는 데 필수적이며, 시스템에서 끌 수
                                            없습니다. 일반적으로 개인정보 설정, 로그인 또는 양식 작성과 같은 서비스
                                            요청에 해당하는 작업을 수행할 때만 설정됩니다.
                                        </p>
                                        <ul className="space-y-2">
                                            <li className="text-sm">
                                                <strong>authToken:</strong> 사용자 인증 유지
                                            </li>
                                            <li className="text-sm">
                                                <strong>user:</strong> 사용자 정보 저장
                                            </li>
                                            <li className="text-sm">
                                                <strong>cookie_consent:</strong> 쿠키 동의 상태 저장
                                            </li>
                                        </ul>
                                    </div>
                                )}
                            </div>

                            {/* 기능성 쿠키 */}
                            <div className="mb-6">
                                <button
                                    onClick={() => toggleSection("functional")}
                                    className="hover:cursor-pointer w-full flex justify-between items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                                >
                                    <div className="flex items-center">
                                        <span className="text-2xl mr-3">⚙️</span>
                                        <div className="text-left">
                                            <h3 className="font-semibold">기능성 쿠키</h3>
                                            <p className="text-sm text-gray-600">향상된 기능과 개인화를 제공합니다</p>
                                        </div>
                                    </div>
                                    <span className="text-gray-500">
                                        {expandedSection === "functional" ? "▼" : "▶"}
                                    </span>
                                </button>
                                {expandedSection === "functional" && (
                                    <div className="mt-2 p-4 bg-white border border-blue-200 rounded-lg">
                                        <p className="text-sm mb-3">
                                            이 쿠키들은 향상된 기능과 개인화를 제공합니다. 이를 허용하지 않으면 일부
                                            또는 모든 기능이 제대로 작동하지 않을 수 있습니다.
                                        </p>
                                        <ul className="space-y-2">
                                            <li className="text-sm">
                                                <strong>userCoupons:</strong> AI 추천 쿠폰 관리
                                            </li>
                                            <li className="text-sm">
                                                <strong>hideAiAdUntil:</strong> 광고 표시 설정
                                            </li>
                                            <li className="text-sm">
                                                <strong>선호도 설정:</strong> 사용자 맞춤 설정 저장
                                            </li>
                                        </ul>
                                    </div>
                                )}
                            </div>

                            {/* 성능 쿠키 */}
                            <div className="mb-6">
                                <button
                                    onClick={() => toggleSection("performance")}
                                    className="hover:cursor-pointer w-full flex justify-between items-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
                                >
                                    <div className="flex items-center">
                                        <span className="text-2xl mr-3">📊</span>
                                        <div className="text-left">
                                            <h3 className="font-semibold">성능 쿠키</h3>
                                            <p className="text-sm text-gray-600">
                                                서비스 성능 개선을 위한 정보를 수집합니다
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-gray-500">
                                        {expandedSection === "performance" ? "▼" : "▶"}
                                    </span>
                                </button>
                                {expandedSection === "performance" && (
                                    <div className="mt-2 p-4 bg-white border border-purple-200 rounded-lg">
                                        <p className="text-sm mb-3">
                                            이 쿠키들은 방문자가 웹사이트를 어떻게 사용하는지 이해하는 데 도움이 됩니다.
                                            모든 정보는 익명으로 수집되고 집계됩니다.
                                        </p>
                                        <ul className="space-y-2">
                                            <li className="text-sm">
                                                <strong>페이지 캐시:</strong> 빠른 로딩을 위한 데이터 임시 저장
                                            </li>
                                            <li className="text-sm">
                                                <strong>세션 데이터:</strong> 일시적인 사용자 활동 추적
                                            </li>
                                        </ul>
                                    </div>
                                )}
                            </div>

                            {/* 제3자 쿠키 */}
                            <div className="mb-6">
                                <button
                                    onClick={() => toggleSection("thirdparty")}
                                    className="hover:cursor-pointer w-full flex justify-between items-center p-4 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors"
                                >
                                    <div className="flex items-center">
                                        <span className="text-2xl mr-3">🌐</span>
                                        <div className="text-left">
                                            <h3 className="font-semibold">제3자 쿠키</h3>
                                            <p className="text-sm text-gray-600">외부 서비스 제공업체의 쿠키입니다</p>
                                        </div>
                                    </div>
                                    <span className="text-gray-500">
                                        {expandedSection === "thirdparty" ? "▼" : "▶"}
                                    </span>
                                </button>
                                {expandedSection === "thirdparty" && (
                                    <div className="mt-2 p-4 bg-white border border-yellow-200 rounded-lg">
                                        <p className="text-sm mb-3">
                                            이 쿠키들은 제3자 서비스 제공업체에 의해 설정됩니다.
                                        </p>
                                        <ul className="space-y-2">
                                            <li className="text-sm">
                                                <strong>Kakao:</strong> 카카오 로그인, 카카오맵 서비스
                                            </li>
                                            <li className="text-sm">
                                                <strong>Google Analytics:</strong> 웹사이트 분석 (향후 도입 예정)
                                            </li>
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* 쿠키 상세 정보 테이블 */}
                        <section id="details" className="mb-8 scroll-mt-24">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">쿠키 상세 정보</h2>
                            <div className="overflow-x-auto">
                                <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                쿠키명
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                유형
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                목적
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                보유기간
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                제공자
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {cookieData.map((cookie, index) => (
                                            <tr key={index} className="hover:bg-gray-50 odd:bg-white even:bg-gray-50">
                                                <td className="px-2 py-2 text-sm font-medium text-gray-900 whitespace-nowrap">
                                                    {cookie.name}
                                                </td>
                                                <td className="px-2 py-1 text-sm text-gray-500 whitespace-nowrap">
                                                    <span
                                                        className={`px-2 py-1 rounded-full text-xs inline-block whitespace-nowrap ${
                                                            cookie.type === "필수"
                                                                ? "bg-green-100 text-green-800"
                                                                : cookie.type === "기능성"
                                                                ? "bg-blue-100 text-blue-800"
                                                                : cookie.type === "성능"
                                                                ? "bg-purple-100 text-purple-800"
                                                                : "bg-yellow-100 text-yellow-800"
                                                        }`}
                                                    >
                                                        {cookie.type}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-500">{cookie.purpose}</td>
                                                <td className="px-4 py-3 text-sm text-gray-500">{cookie.duration}</td>
                                                <td className="px-4 py-3 text-sm text-gray-500">{cookie.provider}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        {/* 쿠키 관리 방법 */}
                        <section id="manage" className="mb-8 scroll-mt-24">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">쿠키를 관리하는 방법</h2>

                            <div className="bg-gray-50 rounded-lg p-6 mb-4">
                                <h3 className="font-semibold mb-3">브라우저 설정을 통한 쿠키 관리</h3>
                                <p className="text-sm mb-4">
                                    대부분의 웹 브라우저는 브라우저 설정을 통해 쿠키를 관리할 수 있는 방법을 제공합니다.
                                    브라우저 설정에서 쿠키를 삭제하거나 차단할 수 있습니다.
                                </p>

                                <div className="space-y-3">
                                    <details className="bg-white rounded-lg p-3">
                                        <summary className="cursor-pointer font-medium">Chrome</summary>
                                        <p className="mt-2 text-sm text-gray-600">
                                            설정 → 개인정보 및 보안 → 쿠키 및 기타 사이트 데이터
                                        </p>
                                    </details>

                                    <details className="bg-white rounded-lg p-3">
                                        <summary className="cursor-pointer font-medium">Safari</summary>
                                        <p className="mt-2 text-sm text-gray-600">
                                            환경설정 → 개인정보 보호 → 쿠키 및 웹사이트 데이터 관리
                                        </p>
                                    </details>

                                    <details className="bg-white rounded-lg p-3">
                                        <summary className="cursor-pointer font-medium">Firefox</summary>
                                        <p className="mt-2 text-sm text-gray-600">
                                            설정 → 개인정보 및 보안 → 쿠키 및 사이트 데이터
                                        </p>
                                    </details>

                                    <details className="bg-white rounded-lg p-3">
                                        <summary className="cursor-pointer font-medium">Edge</summary>
                                        <p className="mt-2 text-sm text-gray-600">
                                            설정 → 쿠키 및 사이트 권한 → 쿠키 및 사이트 데이터 관리 및 삭제
                                        </p>
                                    </details>
                                </div>
                            </div>

                            <div className="bg-orange-50 border-l-4 border-orange-400 p-4">
                                <h3 className="font-semibold mb-2">⚠️ 쿠키 거부 시 제한사항</h3>
                                <ul className="text-sm space-y-1 text-gray-700">
                                    <li>• 로그인 상태가 유지되지 않아 매번 로그인이 필요합니다</li>
                                    <li>• 개인 맞춤 추천 서비스를 이용할 수 없습니다</li>
                                    <li>• 일부 기능이 제한되거나 정상 작동하지 않을 수 있습니다</li>
                                    <li>• 사용자 설정이 저장되지 않습니다</li>
                                </ul>
                            </div>
                        </section>

                        {/* 문의처 */}
                        <section id="contact" className="mb-8 scroll-mt-24">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">문의하기</h2>
                            <div className="bg-gray-50 rounded-lg p-6">
                                <p className="mb-4">쿠키 정책에 대한 문의사항이 있으시면 아래로 연락해 주세요.</p>
                                <div className="space-y-2 text-sm">
                                    <p>
                                        <strong>이메일: 12jason@donacouse.com</strong>
                                    </p>
                                    <p>
                                        <strong>개인정보보호책임자:</strong> 오승용
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* 정책 업데이트 */}
                        <section id="updates" className="mb-8 scroll-mt-24">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">정책 업데이트</h2>
                            <p>
                                이 쿠키 정책은 필요에 따라 업데이트될 수 있습니다. 중요한 변경사항이 있을 경우
                                웹사이트를 통해 공지하겠습니다.
                            </p>
                        </section>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default CookiesPolicyPage;
