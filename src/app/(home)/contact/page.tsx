"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/context/LocaleContext";

const ContactPage = () => {
    const { t } = useLocale();
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = name.trim();
        const trimmedEmail = email.trim();
        const trimmedSubject = subject.trim();
        const trimmedMessage = message.trim();
        if (!trimmedName || !trimmedEmail || !trimmedSubject || !trimmedMessage) {
            alert(t("contact.validationAlert"));
            return;
        }

        const body = t("contact.mailBody", {
            name: trimmedName,
            email: trimmedEmail,
            message: trimmedMessage,
        });
        const mailto = `mailto:12jason@donacouse.com?subject=${encodeURIComponent(trimmedSubject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailto;
    };

    return (
        <div className="flex flex-col min-h-screen bg-white dark:bg-[#0f1710]">
            <main className="grow container mx-auto px-4 py-8 bg-white dark:bg-[#0f1710]">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">{t("contact.pageTitle")}</h1>

                    <div className="mb-8">
                        <p className="text-lg text-gray-700 dark:text-white mb-4">{t("contact.introLead")}</p>
                        <p className="text-gray-600 dark:text-gray-400">{t("contact.introSub")}</p>
                    </div>

                    <div className="flex flex-col gap-8 mb-12">
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                                {t("contact.emailInquiryTitle")}
                            </h2>
                            <p className="text-blue-600 dark:text-blue-400 font-medium">12jason@donacouse.com</p>
                        </div>

                        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                                {t("contact.customerHoursTitle")}
                            </h2>
                            <div className="space-y-2 text-gray-700 dark:text-white">
                                <p>{t("contact.hoursWeekday")}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{t("contact.hoursLunch")}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-6 mb-8">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t("contact.faqTitle")}</h2>
                        <p className="text-gray-700 dark:text-white">
                            {t("contact.faqBefore")}
                            <Link href="/help" className="text-blue-600 dark:text-blue-400 hover:underline" prefetch>
                                {t("contact.faqLinkLabel")}
                            </Link>
                            {t("contact.faqAfter")}
                        </p>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-8">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">{t("contact.formTitle")}</h2>
                        <form className="space-y-6" onSubmit={handleSubmit}>
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t("contact.labelName")}
                                </label>
                                <input
                                    type="text"
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-800 dark:border-gray-700 text-gray-800 dark:text-white dark:bg-[#1a241b] rounded-lg focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent"
                                    placeholder={t("contact.placeholderName")}
                                />
                            </div>

                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t("contact.labelEmail")}
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 text-gray-800 dark:text-white dark:bg-[#1a241b] focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent"
                                    placeholder={t("contact.placeholderEmail")}
                                />
                            </div>

                            <div>
                                <label htmlFor="subject" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t("contact.labelSubject")}
                                </label>
                                <input
                                    type="text"
                                    id="subject"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 text-gray-800 dark:text-white dark:bg-[#1a241b] focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent"
                                    placeholder={t("contact.placeholderSubject")}
                                />
                            </div>

                            <div>
                                <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t("contact.labelMessage")}
                                </label>
                                <textarea
                                    id="message"
                                    rows={6}
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 text-gray-800 dark:text-white dark:bg-[#1a241b] focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent"
                                    placeholder={t("contact.placeholderMessage")}
                                ></textarea>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-blue-600 dark:bg-blue-700 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                            >
                                {t("contact.submitButton")}
                            </button>
                        </form>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ContactPage;
