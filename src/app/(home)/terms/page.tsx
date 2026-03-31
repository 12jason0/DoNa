"use client";

import { useLocale } from "@/context/LocaleContext";
import { getTermsStrings } from "@/i18n/legal/termsPack";

export default function TermsOfServicePage() {
    const { t, locale } = useLocale();
    const s = getTermsStrings(locale);
    const CONTACT_EMAIL = "12jason@donacouse.com";
    return (
        <div className="flex flex-col min-h-screen bg-white dark:bg-[#0f1710]">
            <main className="grow container mx-auto px-4 py-8 bg-white dark:bg-[#0f1710]">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{t("terms.title")}</h1>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">{t("terms.subtitle")}</p>

                    <div className="prose prose-lg max-w-none leading-relaxed">
                        <div className="mb-6 flex flex-wrap gap-2">
                            <a
                                href="#def"
                                className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 text-sm hover:bg-white dark:hover:bg-gray-700 border dark:border-gray-700"
                            >
                                {t("terms.navDef")}
                            </a>
                            <a
                                href="#change"
                                className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 text-sm hover:bg-white dark:hover:bg-gray-700 border dark:border-gray-700"
                            >
                                {t("terms.navChange")}
                            </a>
                            <a
                                href="#service"
                                className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 text-sm hover:bg-white dark:hover:bg-gray-700 border dark:border-gray-700"
                            >
                                {t("terms.navService")}
                            </a>
                            <a
                                href="#signup"
                                className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 text-sm hover:bg-white dark:hover:bg-gray-700 border dark:border-gray-700"
                            >
                                {t("terms.navSignup")}
                            </a>
                            <a
                                href="#duty"
                                className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 text-sm hover:bg-white dark:hover:bg-gray-700 border dark:border-gray-700"
                            >
                                {t("terms.navDuty")}
                            </a>
                            <a
                                href="#ip"
                                className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 text-sm hover:bg-white dark:hover:bg-gray-700 border dark:border-gray-700"
                            >
                                {t("terms.navIp")}
                            </a>
                        </div>

                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4">{s.art1_title}</h2>
                        <p className="text-gray-700 dark:text-gray-300 mb-6">{s.art1_body}</p>

                        <h2 id="def" className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4 scroll-mt-24">
                            {s.art2_title}
                        </h2>
                        <ul className="list-decimal pl-6 mb-6 text-gray-700 dark:text-gray-300 space-y-2">
                            <li>{s.art2_l1}</li>
                            <li>{s.art2_l2}</li>
                            <li>{s.art2_l3}</li>
                            <li>{s.art2_l4}</li>
                        </ul>

                        <h2 id="change" className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4 scroll-mt-24">
                            {s.art3_title}
                        </h2>
                        <ul className="list-decimal pl-6 mb-6 text-gray-700 dark:text-gray-300 space-y-2">
                            <li>{s.art3_l1}</li>
                            <li>{s.art3_l2}</li>
                            <li>{s.art3_l3}</li>
                        </ul>

                        <h2 id="service" className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4 scroll-mt-24">
                            {s.art4_title}
                        </h2>
                        <p className="text-gray-700 mb-4">{s.art4_p1}</p>
                        <p className="text-gray-700 mb-4">{s.art4_p2}</p>
                        <ul className="list-disc pl-6 mb-6 text-gray-700 dark:text-gray-300 space-y-1">
                            <li>{s.art4_srv1}</li>
                            <li>{s.art4_srv2}</li>
                            <li>{s.art4_srv3}</li>
                            <li>{s.art4_srv4}</li>
                            <li>{s.art4_srv5}</li>
                            <li>{s.art4_srv6}</li>
                            <li>{s.art4_srv7}</li>
                            <li>{s.art4_srv8}</li>
                        </ul>

                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{s.art41_title}</h3>
                        <ul className="list-disc pl-6 mb-6 text-gray-700 dark:text-gray-300 space-y-2">
                            <li>{s.art41_l1}</li>
                            <li>
                                {s.art41_l2_intro}
                                <ul className="list-disc pl-6 mt-2 space-y-1">
                                    <li>{s.art41_l2a}</li>
                                    <li>{s.art41_l2b}</li>
                                    <li>{s.art41_l2c}</li>
                                </ul>
                            </li>
                            <li>{s.art41_l3}</li>
                        </ul>

                        <h2 id="signup" className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4 scroll-mt-24">
                            {s.art5_title}
                        </h2>
                        <ul className="list-decimal pl-6 mb-6 text-gray-700 dark:text-gray-300 space-y-2">
                            <li>{s.art5_l1}</li>
                            <li>
                                {s.art5_l2_intro}
                                <ul className="list-disc pl-6 mt-2 space-y-1">
                                    <li>{s.art5_l2a}</li>
                                    <li>{s.art5_l2b}</li>
                                    <li>{s.art5_l2c}</li>
                                </ul>
                            </li>
                        </ul>

                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4">{s.art6_title}</h2>
                        <ul className="list-decimal pl-6 mb-6 text-gray-700 dark:text-gray-300 space-y-2">
                            <li>{s.art6_l1}</li>
                            <li>
                                {s.art6_l2_intro}
                                <ul className="list-disc pl-6 mt-2 space-y-1">
                                    <li>{s.art6_l2a}</li>
                                    <li>{s.art6_l2b}</li>
                                    <li>{s.art6_l2c}</li>
                                </ul>
                            </li>
                        </ul>

                        <h2 id="duty" className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4 scroll-mt-24">
                            {s.art7_title}
                        </h2>
                        <p className="text-gray-700 mb-4">{s.art7_intro}</p>
                        <ul className="list-disc pl-6 mb-6 text-gray-700 dark:text-gray-300 space-y-1">
                            <li>{s.art7_d1}</li>
                            <li>{s.art7_d2}</li>
                            <li>{s.art7_d3}</li>
                            <li>{s.art7_d4}</li>
                            <li>{s.art7_d5}</li>
                            <li>{s.art7_d6}</li>
                            <li>{s.art7_d7}</li>
                            <li className="font-semibold text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-md">
                                {s.art7_d8}
                            </li>
                            <li className="font-semibold text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-md">
                                {s.art7_d9}
                            </li>
                        </ul>

                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4">{s.art8_title}</h2>
                        <ul className="list-decimal pl-6 mb-6 text-gray-700 dark:text-gray-300 space-y-2">
                            <li>{s.art8_l1}</li>
                            <li>{s.art8_l2}</li>
                        </ul>

                        <h2 id="ip" className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4 scroll-mt-24">
                            {s.art9_title}
                        </h2>
                        <ul className="list-decimal pl-6 mb-6 text-gray-700 dark:text-gray-300 space-y-2">
                            <li>{s.art9_l1}</li>
                            <li>{s.art9_l2}</li>
                        </ul>

                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4">{s.art10_title}</h2>
                        <ul className="list-decimal pl-6 mb-6 text-gray-700 dark:text-gray-300 space-y-2">
                            <li>{s.art10_l1}</li>
                            <li>{s.art10_l2}</li>
                        </ul>

                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4">{s.art11_title}</h2>
                        <ul className="list-decimal pl-6 mb-6 text-gray-700 dark:text-gray-300 space-y-2">
                            <li>{s.art11_l1}</li>
                            <li>{s.art11_l2}</li>
                            <li>{s.art11_l3}</li>
                        </ul>

                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4">{s.art12_title}</h2>
                        <ul className="list-decimal pl-6 mb-6 text-gray-700 dark:text-gray-300 space-y-2">
                            <li>{s.art12_l1}</li>
                            <li>{s.art12_l2}</li>
                        </ul>

                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4">{s.art13_title}</h2>
                        <p className="text-gray-700 dark:text-gray-300 mb-6">{s.art13_body}</p>

                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4">{s.appendix_title}</h2>
                        <ul className="list-decimal pl-6 mb-6 text-gray-700 space-y-1">
                            <li>{s.appendix_l1}</li>
                            <li>{s.appendix_l2}</li>
                        </ul>

                        <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">📞 {t("terms.contactTitle")}</h3>
                            <p className="text-gray-700 dark:text-gray-300 text-sm">{t("terms.contactDesc")}</p>
                            <p className="text-gray-700 text-sm mt-2">
                                <strong>{t("terms.contactEmail")}:</strong> {CONTACT_EMAIL}
                                <br />
                                <strong>{t("terms.contactHours")}:</strong> {t("terms.contactHoursValue")}
                            </p>
                        </div>

                        <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{t("terms.businessTitle")}</h3>
                            <p className="text-gray-700 text-sm mb-1">
                                <strong>{t("terms.businessName")}:</strong> {t("terms.businessNameValue")}
                            </p>
                            <p className="text-gray-700 text-sm mb-1">
                                <strong>{t("terms.businessRep")}:</strong> {t("terms.businessRepValue")}
                            </p>
                            <p className="text-gray-700 text-sm mb-1">
                                <strong>{t("terms.businessRegNo")}:</strong> {t("terms.businessRegNoValue")}
                            </p>
                            <p className="text-gray-700 text-sm mb-1">
                                <strong>{t("terms.businessSaleNo")}:</strong> {t("terms.businessSaleNoValue")}
                            </p>
                            <p className="text-gray-700 text-sm mb-1">
                                <strong>{t("terms.businessAddress")}:</strong> {t("terms.businessAddressValue")}
                            </p>
                            <p className="text-gray-700 dark:text-gray-300 text-sm">
                                <strong>{t("terms.businessContact")}:</strong> {CONTACT_EMAIL}
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
