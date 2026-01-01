"use client";

import React, { useState, useEffect, useRef } from "react";
import Header from "@/components/Header";

interface FAQItem {
    id: number;
    question: string;
    answer: string;
    category: string;
    isOpen: boolean;
}

const FAQPage = () => {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);
    const [faqs, setFaqs] = useState<FAQItem[]>([
        {
            id: 1,
            question: "DoNa는 어떤 서비스인가요?",
            answer: "DoNa는 AI가 추천하는 완벽한 여행 코스를 제공하는 서비스입니다. 밀키트처럼 꺼내 먹는 여행 코스로, 복잡한 계획 없이도 완벽한 여행을 경험할 수 있습니다.",
            category: "서비스 소개",
            isOpen: false,
        },
        {
            id: 2,
            question: "회원가입은 어떻게 하나요?",
            answer: "홈페이지 상단의 '로그인' 버튼을 클릭하신 후, '회원가입' 탭을 선택하여 이메일과 비밀번호를 입력하시면 됩니다.",
            category: "계정 관리",
            isOpen: false,
        },
        {
            id: 3,
            question: "AI 추천 코스는 어떻게 작동하나요?",
            answer: "AI가 여러분의 취향, 현재 날씨, 이동 동선을 분석해서 완벽한 여행 코스를 추천해드립니다. 컨셉과 카테고리만 선택하면 바로 출발할 수 있어요!",
            category: "서비스 이용",
            isOpen: false,
        },
        {
            id: 4,
            question: "코스는 무료인가요?",
            answer: "기본 코스는 무료로 제공되며, 프리미엄 코스의 경우 별도 요금이 발생할 수 있습니다. 각 코스의 상세 페이지에서 가격 정보를 확인하실 수 있습니다.",
            category: "결제",
            isOpen: false,
        },
        {
            id: 5,
            question: "지도에서 현재 위치가 표시되지 않아요",
            answer: "브라우저 및 앱의 위치 권한을 '허용'으로 설정해주세요. DoNa는 사용자의 정확한 위치를 기반으로 가장 가까운 데이트 코스를 실시간으로 추천하기 위해 GPS 정보를 사용합니다. 설정 > 개인정보 보호 > 위치 서비스에서 DoNa에 대한 위치 권한을 확인해주세요.",
            category: "기술 문제",
            isOpen: false,
        },
        {
            id: 6,
            question: "코스 후기를 남길 수 있나요?",
            answer: "네, 코스를 이용하신 후에는 후기를 남기실 수 있습니다. 다른 사용자들에게 도움이 되는 소중한 정보가 됩니다.",
            category: "서비스 이용",
            isOpen: false,
        },
        {
            id: 7,
            question: "공식 출시일은 언제인가요?",
            answer: "DoNa는 2026년 1월 1일 정식 서비스를 시작합니다. 현재는 안정적인 서비스를 위한 최종 심사 단계입니다.",
            category: "서비스 소개",
            isOpen: false,
        },
    ]);

    const [selectedCategory, setSelectedCategory] = useState<string>("전체");
    const [searchTerm, setSearchTerm] = useState<string>("");
    const categoriesTrackRef = useRef<HTMLDivElement | null>(null);

    const handleSelectCategory = (category: string, ev: React.MouseEvent<HTMLButtonElement>) => {
        setSelectedCategory(category);
        try {
            const container = categoriesTrackRef.current;
            const button = ev.currentTarget as HTMLButtonElement;
            if (!container || !button) return;
            const containerRect = container.getBoundingClientRect();
            const buttonRect = button.getBoundingClientRect();
            const currentScrollLeft = container.scrollLeft;
            const deltaToCenter =
                buttonRect.left - containerRect.left - (containerRect.width / 2 - buttonRect.width / 2);
            const target = currentScrollLeft + deltaToCenter;
            container.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
        } catch {}
    };

    const categories = ["전체", "서비스 소개", "계정 관리", "서비스 이용", "결제", "기술 문제"];

    const toggleFAQ = (id: number) => {
        setFaqs(faqs.map((faq) => (faq.id === id ? { ...faq, isOpen: !faq.isOpen } : faq)));
    };

    const filteredFAQs = faqs.filter((faq) => {
        const matchesCategory = selectedCategory === "전체" || faq.category === selectedCategory;
        const matchesSearch =
            faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
            faq.answer.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    return (
        <div className="flex flex-col min-h-screen bg-white dark:bg-[#0f1710]">
            <main className="flex-grow container mx-auto px-4 py-8 bg-white dark:bg-[#0f1710]">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold mb-6 text-center text-black dark:text-white">자주 묻는 질문</h1>

                    {/* 검색 및 필터 */}
                    <div className="mb-8">
                        {/* 검색창 영역 */}
                        <div className="mb-4">
                            <div className="relative">
                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                    🔎
                                </span>
                                <input
                                    type="text"
                                    placeholder="질문을 검색해보세요..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="text-gray-800 dark:text-white w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-700 rounded-2xl bg-white dark:bg-[#1a241b] shadow-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500"
                                />
                            </div>
                        </div>

                        {/* 카테고리 버튼 영역 */}
                        <div
                            className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1"
                            ref={categoriesTrackRef}
                        >
                            {categories.map((category) => (
                                <button
                                    key={category}
                                    onClick={(e) => handleSelectCategory(category, e)}
                                    aria-pressed={selectedCategory === category}
                                    className={`${
                                        selectedCategory === category
                                            ? "bg-blue-600 dark:bg-blue-700 text-white border-blue-600 dark:border-blue-700 shadow"
                                            : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-700"
                                    } min-w-[88px] px-4 py-3 rounded-2xl text-sm font-semibold border text-center leading-snug break-keep hover:cursor-pointer`}
                                >
                                    {category}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* FAQ 목록 */}
                    <div className="space-y-4">
                        {filteredFAQs.length > 0 ? (
                            filteredFAQs.map((faq) => (
                                <div key={faq.id} className="bg-white dark:bg-[#1a241b] border border-gray-200 dark:border-gray-800 rounded-lg shadow-sm">
                                    <button
                                        onClick={() => toggleFAQ(faq.id)}
                                        className="hover:cursor-pointer w-full px-6 py-4 text-left flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                                                {faq.category}
                                            </span>
                                            <span className="font-medium text-gray-900 dark:text-white">{faq.question}</span>
                                        </div>
                                        <span
                                            className={`text-gray-400 dark:text-gray-500 transition-transform ${
                                                faq.isOpen ? "rotate-180" : ""
                                            }`}
                                        >
                                            ▼
                                        </span>
                                    </button>
                                    {faq.isOpen && (
                                        <div className="px-6 pb-4">
                                            <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                                                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{faq.answer}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-12">
                                <div className="text-6xl mb-4">🔍</div>
                                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">검색 결과가 없습니다</h3>
                                <p className="text-gray-600 dark:text-gray-400">다른 키워드로 검색해보세요.</p>
                            </div>
                        )}
                    </div>

                    {/* 추가 문의 안내 */}
                    <div className="mt-12 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-6 text-center">
                        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-300 mb-2">더 궁금한 점이 있으신가요?</h3>
                        <p className="text-blue-700 dark:text-blue-400 mb-4">
                            위의 질문에서 답을 찾지 못하셨다면 이메일로 문의해주세요:{" "}
                            <strong className="text-blue-800 dark:text-blue-300">12jason@donacourse.com</strong>
                        </p>
                        <a
                            href="/contact"
                            className="inline-block bg-blue-600 dark:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors hover:cursor-pointer mt-2"
                        >
                            문의하기
                        </a>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default FAQPage;
