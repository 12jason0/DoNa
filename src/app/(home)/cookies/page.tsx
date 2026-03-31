"use client";

import React, { useState } from "react";
import { useLocale } from "@/context/LocaleContext";
import { getCookiesStrings } from "@/i18n/legal/cookiesPack";

const CookiesPolicyPage = () => {
    const { locale } = useLocale();
    const s = getCookiesStrings(locale);
    const [expandedSection, setExpandedSection] = useState<string | null>(null);

    const toggleSection = (section: string) => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    const cookieData = [
        {
            name: "authToken",
            type: s.typeEssential,
            purpose: s.purposeAuthToken,
            duration: s.dur7days,
            provider: "DoNa",
        },
        {
            name: "user",
            type: s.typeEssential,
            purpose: s.purposeUser,
            duration: s.dur7days,
            provider: "DoNa",
        },
        {
            name: "loginTime",
            type: s.typeEssential,
            purpose: s.purposeLoginTime,
            duration: s.durBrowserClose,
            provider: "DoNa",
        },
        {
            name: "cookie_consent",
            type: s.typeEssential,
            purpose: s.purposeCookieConsent,
            duration: s.dur1year,
            provider: "DoNa",
        },
        {
            name: "hideAiAdUntil",
            type: s.typeFunctional,
            purpose: s.purposeHideAiAd,
            duration: s.durUserSetting,
            provider: "DoNa",
        },
        {
            name: "userPreferences",
            type: s.typeFunctional,
            purpose: s.purposeUserPreferences,
            duration: s.durPersistent,
            provider: "DoNa",
        },
        {
            name: "aboutPageData",
            type: s.typePerformance,
            purpose: s.purposeAboutPageData,
            duration: s.durSession,
            provider: "DoNa",
        },
        {
            name: "_kak*",
            type: s.typeThirdParty,
            purpose: s.purposeKak,
            duration: s.durByService,
            provider: "Kakao",
        },
    ];

    return (
        <div className="flex flex-col min-h-screen bg-white">
            <main className="grow container mx-auto px-4 py-8 bg-white">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">{s.pageTitle}</h1>
                    <p className="text-gray-600 mb-6">
                        {s.pageSubtitle}
                    </p>

                    <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed">
                        {/* 빠른 이동 */}
                        <div className="mb-6 flex flex-wrap gap-2">
                            <a
                                href="#what"
                                className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-800 text-sm hover:bg-white border"
                            >
                                {s.navWhat}
                            </a>
                            <a
                                href="#why"
                                className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-800 text-sm hover:bg-white border"
                            >
                                {s.navWhy}
                            </a>
                            <a
                                href="#types"
                                className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-800 text-sm hover:bg-white border"
                            >
                                {s.navTypes}
                            </a>
                            <a
                                href="#details"
                                className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-800 text-sm hover:bg-white border"
                            >
                                {s.navDetails}
                            </a>
                            <a
                                href="#manage"
                                className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-800 text-sm hover:bg-white border"
                            >
                                {s.navManage}
                            </a>
                            <a
                                href="#contact"
                                className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-800 text-sm hover:bg-white border"
                            >
                                {s.navContact}
                            </a>
                            <a
                                href="#updates"
                                className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-800 text-sm hover:bg-white border"
                            >
                                {s.navUpdates}
                            </a>
                        </div>
                        <p className="mb-6">{s.lastUpdated}</p>

                        {/* 쿠키란? */}
                        <section id="what" className="mb-8 scroll-mt-24">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">{s.whatTitle}</h2>
                            <p className="mb-4">
                                {s.whatP1}
                            </p>
                            <p className="mb-4">
                                {s.whatP2}
                            </p>
                        </section>

                        {/* 쿠키 사용 목적 */}
                        <section id="why" className="mb-8 scroll-mt-24">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">{s.whyTitle}</h2>
                            <div className="space-y-4">
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <h3 className="font-semibold mb-2">🔐 {s.authTitle}</h3>
                                    <p className="text-sm">{s.authDesc}</p>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <h3 className="font-semibold mb-2">⚙️ {s.featuresTitle}</h3>
                                    <p className="text-sm">
                                        {s.featuresDesc}
                                    </p>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <h3 className="font-semibold mb-2">📊 {s.analyticsTitle}</h3>
                                    <p className="text-sm">{s.analyticsDesc}</p>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <h3 className="font-semibold mb-2">🎯 {s.personalTitle}</h3>
                                    <p className="text-sm">{s.personalDesc}</p>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <h3 className="font-semibold mb-2">🖼️ {s.photoTitle}</h3>
                                    <p className="text-sm">
                                        {s.photoDesc}
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* 쿠키 유형 */}
                        <section id="types" className="mb-8 scroll-mt-24">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">{s.typesTitle}</h2>

                            {/* 필수 쿠키 */}
                            <div className="mb-6">
                                <button
                                    onClick={() => toggleSection("essential")}
                                    className="hover:cursor-pointer w-full flex justify-between items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                                >
                                    <div className="flex items-center">
                                        <span className="text-2xl mr-3">🔒</span>
                                        <div className="text-left">
                                            <h3 className="font-semibold">{s.essentialTitle}</h3>
                                            <p className="text-sm text-gray-600">{s.essentialSubtitle}</p>
                                        </div>
                                    </div>
                                    <span className="text-gray-500">{expandedSection === "essential" ? "▼" : "▶"}</span>
                                </button>
                                {expandedSection === "essential" && (
                                    <div className="mt-2 p-4 bg-white border border-green-200 rounded-lg">
                                        <p className="text-sm mb-3">{s.essentialDesc}</p>
                                        <ul className="space-y-2">
                                            <li className="text-sm">
                                                <strong>authToken:</strong> {s.essentialL1}
                                            </li>
                                            <li className="text-sm">
                                                <strong>user:</strong> {s.essentialL2}
                                            </li>
                                            <li className="text-sm">
                                                <strong>cookie_consent:</strong> {s.essentialL3}
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
                                            <h3 className="font-semibold">{s.functionalTitle}</h3>
                                            <p className="text-sm text-gray-600">{s.functionalSubtitle}</p>
                                        </div>
                                    </div>
                                    <span className="text-gray-500">
                                        {expandedSection === "functional" ? "▼" : "▶"}
                                    </span>
                                </button>
                                {expandedSection === "functional" && (
                                    <div className="mt-2 p-4 bg-white border border-blue-200 rounded-lg">
                                        <p className="text-sm mb-3">{s.functionalDesc}</p>
                                        <ul className="space-y-2">
                                            <li className="text-sm">
                                                <strong>userPreferences:</strong> {s.functionalL1}
                                            </li>
                                            <li className="text-sm">
                                                <strong>hideAiAdUntil:</strong> {s.functionalL2}
                                            </li>
                                            <li className="text-sm">
                                                <strong>{s.functionalL3Lbl}</strong> {s.functionalL3}
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
                                            <h3 className="font-semibold">{s.performanceTitle}</h3>
                                            <p className="text-sm text-gray-600">{s.performanceSubtitle}</p>
                                        </div>
                                    </div>
                                    <span className="text-gray-500">
                                        {expandedSection === "performance" ? "▼" : "▶"}
                                    </span>
                                </button>
                                {expandedSection === "performance" && (
                                    <div className="mt-2 p-4 bg-white border border-purple-200 rounded-lg">
                                        <p className="text-sm mb-3">{s.performanceDesc}</p>
                                        <ul className="space-y-2">
                                            <li className="text-sm">
                                                <strong>{s.performanceL1Lbl}</strong> {s.performanceL1}
                                            </li>
                                            <li className="text-sm">
                                                <strong>{s.performanceL2Lbl}</strong> {s.performanceL2}
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
                                            <h3 className="font-semibold">{s.thirdPartyTitle}</h3>
                                            <p className="text-sm text-gray-600">{s.thirdPartySubtitle}</p>
                                        </div>
                                    </div>
                                    <span className="text-gray-500">
                                        {expandedSection === "thirdparty" ? "▼" : "▶"}
                                    </span>
                                </button>
                                {expandedSection === "thirdparty" && (
                                    <div className="mt-2 p-4 bg-white border border-yellow-200 rounded-lg">
                                        <p className="text-sm mb-3">{s.thirdPartyDesc}</p>
                                        <ul className="space-y-2">
                                            <li className="text-sm">
                                                <strong>Kakao:</strong> {s.thirdPartyL1}
                                            </li>
                                            <li className="text-sm">
                                                <strong>Google Analytics:</strong> {s.thirdPartyL2}
                                            </li>
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* 쿠키 상세 정보 테이블 */}
                        <section id="details" className="mb-8 scroll-mt-24">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">{s.navDetails}</h2>
                            <div className="overflow-x-auto">
                                <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                {s.tableColName}
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                {s.tableColType}
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                {s.tableColPurpose}
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                {s.tableColDuration}
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                {s.tableColProvider}
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
                                                            cookie.type === s.typeEssential
                                                                ? "bg-green-100 text-green-800"
                                                                : cookie.type === s.typeFunctional
                                                                ? "bg-blue-100 text-blue-800"
                                                                : cookie.type === s.typePerformance
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
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">{s.manageTitle}</h2>

                            <div className="bg-gray-50 rounded-lg p-6 mb-4">
                                <h3 className="font-semibold mb-3">{s.manageBrowserTitle}</h3>
                                <p className="text-sm mb-4">{s.manageBrowserDesc}</p>

                                <div className="space-y-3">
                                    <details className="bg-white rounded-lg p-3">
                                        <summary className="cursor-pointer font-medium">Chrome</summary>
                                        <p className="mt-2 text-sm text-gray-600">
                                            {s.chromeSettings}
                                        </p>
                                    </details>

                                    <details className="bg-white rounded-lg p-3">
                                        <summary className="cursor-pointer font-medium">Safari</summary>
                                        <p className="mt-2 text-sm text-gray-600">
                                            {s.safariSettings}
                                        </p>
                                    </details>

                                    <details className="bg-white rounded-lg p-3">
                                        <summary className="cursor-pointer font-medium">Firefox</summary>
                                        <p className="mt-2 text-sm text-gray-600">
                                            {s.firefoxSettings}
                                        </p>
                                    </details>

                                    <details className="bg-white rounded-lg p-3">
                                        <summary className="cursor-pointer font-medium">Edge</summary>
                                        <p className="mt-2 text-sm text-gray-600">
                                            {s.edgeSettings}
                                        </p>
                                    </details>
                                </div>
                            </div>

                            <div className="bg-orange-50 border-l-4 border-orange-400 p-4">
                                <h3 className="font-semibold mb-2">⚠️ {s.manageBlockTitle}</h3>
                                <ul className="text-sm space-y-1 text-gray-700">
                                    <li>• {s.manageBlockL1}</li>
                                    <li>• {s.manageBlockL2}</li>
                                    <li>• {s.manageBlockL3}</li>
                                    <li>• {s.manageBlockL4}</li>
                                </ul>
                            </div>
                        </section>

                        {/* 문의처 */}
                        <section id="contact" className="mb-8 scroll-mt-24">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">{s.contactTitle}</h2>
                            <div className="bg-gray-50 rounded-lg p-6">
                                <p className="mb-4">{s.contactDesc}</p>
                                <div className="space-y-2 text-sm">
                                    <p>
                                        <strong>{s.contactEmailLabel} 12jason@donacouse.com</strong>
                                    </p>
                                    <p>
                                        <strong>{s.contactOfficerLabel}</strong> {s.contactOfficerName}
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* 정책 업데이트 */}
                        <section id="updates" className="mb-8 scroll-mt-24">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">{s.updatesTitle}</h2>
                            <p>{s.updatesDesc}</p>
                        </section>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default CookiesPolicyPage;
