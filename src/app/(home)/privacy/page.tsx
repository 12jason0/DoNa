"use client";

import { useLocale } from "@/context/LocaleContext";
import { getPrivacyStrings } from "@/i18n/legal/privacyPack";

export default function PrivacyPolicyPage() {
    const { t, locale } = useLocale();
    const s = getPrivacyStrings(locale);
    const CONTACT_EMAIL = "12jason@donacouse.com";
    const gaPartnersUrl = "https://www.google.com/policies/privacy/partners/";

    return (
        <div className="flex flex-col min-h-screen bg-white dark:bg-[#0f1710]">
            <main className="grow container mx-auto px-4 py-8 bg-white dark:bg-[#0f1710]">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{t("privacy.title")}</h1>
                    <p className="text-gray-600 dark:text-white mb-6">{t("privacy.subtitle")}</p>

                    <div className="prose prose-lg max-w-none leading-relaxed">
                        <div className="mb-6 flex flex-wrap gap-2">
                            <a
                                href="#purpose"
                                className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white text-sm hover:bg-white dark:hover:bg-gray-700 border dark:border-gray-700"
                            >
                                {t("privacy.navPurpose")}
                            </a>
                            <a
                                href="#retention"
                                className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white text-sm hover:bg-white dark:hover:bg-gray-700 border dark:border-gray-700"
                            >
                                {t("privacy.navRetention")}
                            </a>
                            <a
                                href="#items"
                                className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white text-sm hover:bg-white dark:hover:bg-gray-700 border dark:border-gray-700"
                            >
                                {t("privacy.navItems")}
                            </a>
                            <a
                                href="#behavior"
                                className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white text-sm hover:bg-white dark:hover:bg-gray-700 border dark:border-gray-700"
                            >
                                {t("privacy.navBehavior")}
                            </a>
                            <a
                                href="#rights"
                                className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white text-sm hover:bg-white dark:hover:bg-gray-700 border dark:border-gray-700"
                            >
                                {t("privacy.navRights")}
                            </a>
                            <a
                                href="#security"
                                className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white text-sm hover:bg-white dark:hover:bg-gray-700 border dark:border-gray-700"
                            >
                                {t("privacy.navSecurity")}
                            </a>
                            <a
                                href="/data-deletion"
                                className="px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm hover:bg-red-100 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800/50 font-medium"
                            >
                                {t("privacy.navDataDeletion")}
                            </a>
                        </div>

                        <p className="text-gray-700 dark:text-white mb-6">{s.intro_p}</p>

                        <h2 id="purpose" className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4 scroll-mt-24">
                            {s.art1_title}
                        </h2>
                        <p className="text-gray-700 dark:text-white mb-4">{s.art1_p}</p>
                        <ul className="list-disc pl-6 mb-6 text-gray-700 dark:text-white">
                            <li>{s.art1_li1}</li>
                            <li>{s.art1_li2}</li>
                            <li>{s.art1_li3}</li>
                            <li>{s.art1_li4}</li>
                        </ul>

                        <h2 id="retention" className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4 scroll-mt-24">
                            {s.art2_title}
                        </h2>
                        <p className="text-gray-700 dark:text-white mb-4">{s.art2_p}</p>

                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 mt-6">{s.sec21_title}</h3>
                        <ul className="list-disc pl-6 mb-6 text-gray-700 dark:text-white space-y-2">
                            <li>{s.sec21_li1}</li>
                            <li>{s.sec21_li2}</li>
                            <li>{s.sec21_li3}</li>
                            <li>{s.sec21_li4}</li>
                        </ul>

                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 mt-6">{s.sec22_title}</h3>
                        <p className="text-gray-700 dark:text-white mb-4">{s.sec22_p}</p>
                        <div className="overflow-x-auto mb-6">
                            <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-700 text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-800">
                                    <tr>
                                        <th className="border border-gray-300 dark:border-gray-700 px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">
                                            {s.tbl_h1}
                                        </th>
                                        <th className="border border-gray-300 dark:border-gray-700 px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">
                                            {s.tbl_h2}
                                        </th>
                                        <th className="border border-gray-300 dark:border-gray-700 px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">
                                            {s.tbl_h3}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="text-gray-700 dark:text-white">
                                    <tr>
                                        <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">{s.tbl_r1c1}</td>
                                        <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">{s.tbl_r1c2}</td>
                                        <td className="border border-gray-300 px-4 py-3 font-semibold">{s.tbl_r1c3}</td>
                                    </tr>
                                    <tr>
                                        <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">{s.tbl_r2c1}</td>
                                        <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">{s.tbl_r2c2}</td>
                                        <td className="border border-gray-300 px-4 py-3 font-semibold">{s.tbl_r2c3}</td>
                                    </tr>
                                    <tr>
                                        <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">{s.tbl_r3c1}</td>
                                        <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">{s.tbl_r3c2}</td>
                                        <td className="border border-gray-300 px-4 py-3 font-semibold">{s.tbl_r3c3}</td>
                                    </tr>
                                    <tr>
                                        <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">{s.tbl_r4c1}</td>
                                        <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">{s.tbl_r4c2}</td>
                                        <td className="border border-gray-300 px-4 py-3 font-semibold">{s.tbl_r4c3}</td>
                                    </tr>
                                    <tr>
                                        <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">{s.tbl_r5c1}</td>
                                        <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">{s.tbl_r5c2}</td>
                                        <td className="border border-gray-300 px-4 py-3 font-semibold">{s.tbl_r5c3}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <h2 id="items" className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4 scroll-mt-24">
                            {s.art3_title}
                        </h2>
                        <p className="text-gray-700 dark:text-white mb-4">{s.art3_p}</p>

                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{s.art3_s1_title}</h3>
                        <ul className="list-disc pl-6 mb-4 text-gray-700 dark:text-white">
                            <li>{s.art3_s1_li1}</li>
                            <li>{s.art3_s1_li2}</li>
                        </ul>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{s.art3_s2_title}</h3>
                        <ul className="list-disc pl-6 mb-4 text-gray-700 dark:text-white">
                            <li>{s.art3_s2_li1}</li>
                            <li>{s.art3_s2_li2}</li>
                        </ul>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{s.art3_s3_title}</h3>
                        <ul className="list-disc pl-6 mb-4 text-gray-700 dark:text-white">
                            <li>{s.art3_s3_li1}</li>
                            <li className="mt-2 font-semibold text-gray-900">{s.art3_s3_li2}</li>
                        </ul>

                        <h2 id="behavior" className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4 scroll-mt-24">
                            {s.art4_title}
                        </h2>
                        <p className="text-gray-700 dark:text-white mb-4">{s.art4_p}</p>
                        <ul className="list-disc pl-6 mb-4 text-gray-700 dark:text-white">
                            <li>{s.art4_li1}</li>
                            <li>{s.art4_li2}</li>
                            <li>{s.art4_li3}</li>
                            <li>
                                <strong>{s.art4_li4_title}</strong> {s.art4_li4_beforeLink}
                                <a
                                    href={gaPartnersUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                    www.google.com/policies/privacy/partners/
                                </a>
                                {s.art4_li4_suffix}
                            </li>
                        </ul>
                        <p className="text-gray-700 dark:text-white mb-6">{s.art4_p2}</p>

                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4">{s.art5_title}</h2>
                        <p className="text-gray-700 dark:text-white mb-6">{s.art5_p}</p>

                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4">{s.art6_title}</h2>
                        <p className="text-gray-700 dark:text-white mb-2">{s.art6_p}</p>
                        <ul className="list-disc pl-6 mb-6 text-gray-700 dark:text-white space-y-2">
                            <li>{s.art6_li1}</li>
                            <li>{s.art6_li2}</li>
                            <li>{s.art6_li3}</li>
                            <li>{s.art6_li4}</li>
                        </ul>

                        <h2 id="rights" className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4 scroll-mt-24">
                            {s.art7_title}
                        </h2>
                        <p className="text-gray-700 dark:text-white mb-4">{s.art7_p}</p>
                        <ul className="list-disc pl-6 mb-4 text-gray-700 dark:text-white">
                            <li>{s.art7_li1}</li>
                            <li>{s.art7_li2}</li>
                            <li>{s.art7_li3}</li>
                            <li>{s.art7_li4}</li>
                        </ul>
                        <p className="text-gray-700 dark:text-white mb-4">{s.art7_p2}</p>
                        <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 dark:border-blue-600 p-4 mb-6 rounded-r">
                            <p className="text-sm text-blue-800 dark:text-blue-300 mb-2">
                                <strong>💡 {s.art7_box_title}</strong>
                            </p>
                            <p className="text-sm text-blue-700 dark:text-blue-400 mb-3">{s.art7_box_p}</p>
                            <a
                                href="/data-deletion"
                                className="inline-block px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white text-sm font-bold rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                            >
                                {s.art7_box_cta}
                            </a>
                        </div>

                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4">{s.art8_title}</h2>
                        <p className="text-gray-700 dark:text-white mb-6">{s.art8_p}</p>

                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4">{s.art81_title}</h2>
                        <ul className="list-disc pl-6 mb-6 text-gray-700 dark:text-white space-y-2">
                            <li>{s.art81_li1}</li>
                            <li>{s.art81_li2}</li>
                            <li>{s.art81_li3}</li>
                        </ul>

                        <h2 id="security" className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4 scroll-mt-24">
                            {s.art9_title}
                        </h2>
                        <p className="text-gray-700 dark:text-white mb-4">{s.art9_p}</p>
                        <ul className="list-disc pl-6 mb-6 text-gray-700 dark:text-white">
                            <li>{s.art9_li1}</li>
                            <li>{s.art9_li2}</li>
                            <li>{s.art9_li3}</li>
                            <li>{s.art9_li4}</li>
                            <li>{s.art9_li5}</li>
                        </ul>

                        <h2 id="location" className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4 scroll-mt-24">
                            {s.art91_title}
                        </h2>
                        <p className="text-gray-700 dark:text-white mb-4">{s.art91_p}</p>

                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4">{s.art10_title}</h2>
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg mb-6">
                            <p className="text-gray-700 dark:text-white mb-2">
                                <strong>{s.art10_role}</strong>
                            </p>
                            <p className="text-gray-700 dark:text-white mb-1">{s.art10_name}</p>
                            <p className="text-gray-700 dark:text-white mb-1">{s.art10_job}</p>
                            <p className="text-gray-700 dark:text-white mb-1">
                                <strong>{s.art10_contact_label}</strong> {CONTACT_EMAIL}
                            </p>
                            <p className="text-gray-600 dark:text-white text-sm mt-2">{s.art10_footer}</p>
                        </div>

                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4">{s.art11_title}</h2>
                        <p className="text-gray-700 dark:text-white mb-2">{s.art11_p}</p>

                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4">{s.art12_title}</h2>
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg mb-6">
                            <p className="text-gray-700 dark:text-white mb-2">{s.art12_name}</p>
                            <p className="text-gray-700 dark:text-white mb-2">{s.art12_rep}</p>
                            <p className="text-gray-700 dark:text-white mb-2">{s.art12_reg}</p>
                            <p className="text-gray-700 dark:text-white mb-2">{s.art12_sale}</p>
                            <p className="text-gray-700 dark:text-white mb-2">{s.art12_addr}</p>
                            <p className="text-gray-700 dark:text-white mb-2">
                                <strong>{s.art12_contact_label}</strong> {CONTACT_EMAIL}
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
