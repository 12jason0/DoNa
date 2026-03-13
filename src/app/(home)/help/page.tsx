"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Header from "@/components/Header";
import { useLocale } from "@/context/LocaleContext";

interface FAQItem {
    id: number;
    question: string;
    answer: string;
    category: string;
    isOpen: boolean;
}

const FAQPage = () => {
    const { t } = useLocale();
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const faqsBase = useMemo<FAQItem[]>(
        () => [
            { id: 1, question: t("help.faq1Question"), answer: t("help.faq1Answer"), category: t("help.faq1Category"), isOpen: false },
            { id: 2, question: t("help.faq2Question"), answer: t("help.faq2Answer"), category: t("help.faq2Category"), isOpen: false },
            { id: 3, question: t("help.faq3Question"), answer: t("help.faq3Answer"), category: t("help.faq3Category"), isOpen: false },
            { id: 4, question: t("help.faq4Question"), answer: t("help.faq4Answer"), category: t("help.faq4Category"), isOpen: false },
            { id: 5, question: t("help.faq5Question"), answer: t("help.faq5Answer"), category: t("help.faq5Category"), isOpen: false },
            { id: 6, question: t("help.faq6Question"), answer: t("help.faq6Answer"), category: t("help.faq6Category"), isOpen: false },
            { id: 7, question: t("help.faq7Question"), answer: t("help.faq7Answer"), category: t("help.faq7Category"), isOpen: false },
        ],
        [t]
    );
    const [faqs, setFaqs] = useState<FAQItem[]>(faqsBase);
    useEffect(() => {
        setFaqs(faqsBase);
    }, [faqsBase]);

    const categories = useMemo(
        () => [t("help.categoryAll"), t("help.categoryService"), t("help.categoryAccount"), t("help.categoryUse"), t("help.categoryPayment"), t("help.categoryTech")],
        [t]
    );

    const [selectedCategory, setSelectedCategory] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState<string>("");
    const categoriesTrackRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (categories[0]) setSelectedCategory(categories[0]);
    }, [categories]);

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

    const toggleFAQ = (id: number) => {
        setFaqs(faqs.map((faq) => (faq.id === id ? { ...faq, isOpen: !faq.isOpen } : faq)));
    };

    const activeCategory = selectedCategory || categories[0];
    const filteredFAQs = faqs.filter((faq) => {
        const matchesCategory = activeCategory === categories[0] || faq.category === activeCategory;
        const matchesSearch =
            faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
            faq.answer.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    return (
        <div className="flex flex-col min-h-screen bg-white dark:bg-[#0f1710]">
            <main className="grow container mx-auto px-4 py-8 bg-white dark:bg-[#0f1710]">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold mb-6 text-center text-black dark:text-white">{t("help.title")}</h1>

                    <div className="mb-8">
                        <div className="mb-4">
                            <div className="relative">
                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                    🔎
                                </span>
                                <input
                                    type="text"
                                    placeholder={t("help.searchPlaceholder")}
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
                                    aria-pressed={activeCategory === category}
                                    className={`${
                                        activeCategory === category
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
                                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t("help.noResultsTitle")}</h3>
                                <p className="text-gray-600 dark:text-gray-400">{t("help.noResultsDesc")}</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-12 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-6 text-center">
                        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-300 mb-2">{t("help.moreHelpTitle")}</h3>
                        <p className="text-blue-700 dark:text-blue-400 mb-4">
                            {t("help.moreHelpText")}{" "}
                            <strong className="text-blue-800 dark:text-blue-300">12jason@donacouse.com</strong>
                        </p>
                        <a
                            href="/contact"
                            className="inline-block bg-blue-600 dark:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors hover:cursor-pointer mt-2"
                        >
                            {t("help.contactBtn")}
                        </a>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default FAQPage;
