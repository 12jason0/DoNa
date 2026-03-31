"use client";

import { useLocale } from "@/context/LocaleContext";
import { getDataDeletionStrings } from "@/i18n/legal/dataDeletionPack";

export default function DataDeletionPage() {
    const { locale } = useLocale();
    const s = getDataDeletionStrings(locale);
    const CONTACT_EMAIL = "12jason@donacouse.com";
    return (
        <div className="flex flex-col min-h-screen bg-white dark:bg-[#0f1710]">
            <main className="grow container mx-auto px-4 py-8 bg-white dark:bg-[#0f1710]">
                <div className="max-w-3xl mx-auto">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{s.pageTitle}</h1>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">{s.pageSubtitle}</p>

                    <div className="prose prose-lg max-w-none leading-relaxed text-gray-700 dark:text-white">
                        <section className="mb-8">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">{s.sec1Title}</h2>
                            <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 dark:border-blue-600 p-4 mb-4">
                                <p className="text-gray-800 dark:text-white mb-2">
                                    <strong>{s.sec1BoxStrong}</strong>
                                </p>
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                    {s.sec1BoxPre}<strong>{s.sec1BoxPath}</strong>{s.sec1BoxPost}
                                </p>
                            </div>
                            <p className="mb-4">
                                {s.sec1EmailNote}
                            </p>
                            <div className="bg-gray-50 dark:bg-gray-800/50 border dark:border-gray-700 rounded-lg p-4">
                                <p className="text-sm dark:text-white">
                                    <strong>{s.sec1EmailLabel}</strong> {CONTACT_EMAIL}
                                </p>
                                <p className="text-sm dark:text-white mt-2">
                                    <strong>{s.sec1SubjectLabel}</strong> {s.sec1SubjectExample}
                                </p>
                                <p className="text-sm dark:text-white mt-2">
                                    <strong>{s.sec1RequiredLabel}</strong> {s.sec1RequiredInfo}
                                </p>
                            </div>
                        </section>

                        <section className="mb-8">
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{s.sec2Title}</h3>
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 mt-4">{s.sec2MyPageTitle}</h4>
                            <ol className="list-decimal pl-6 space-y-2 mb-4 dark:text-white">
                                <li>{s.sec2MyPageL1Pre}<strong>{s.sec2MyPageL1Path}</strong>{s.sec2MyPageL1Post}</li>
                                <li><strong>{s.sec2MyPageL2Strong}</strong>{s.sec2MyPageL2Post}</li>
                                <li>{s.sec2MyPageL3}</li>
                                <li>
                                    {s.sec2MyPageL4}
                                </li>
                            </ol>
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 mt-4">{s.sec2EmailTitle}</h4>
                            <ol className="list-decimal pl-6 space-y-2 dark:text-white">
                                <li>{s.sec2EmailL1}</li>
                                <li>
                                    {s.sec2EmailL2}
                                </li>
                                <li>{s.sec2EmailL3}</li>
                            </ol>
                            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                                <strong>{s.sec2CommonLabel}</strong> {s.sec2CommonNote}
                            </p>
                        </section>

                        <section className="mb-8">
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                                {s.sec3Title}
                            </h3>
                            <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 dark:border-amber-600 p-4 mb-4">
                                <p className="text-gray-800 dark:text-white mb-2">
                                    <strong>{s.sec3BoxStrong}</strong> {s.sec3BoxText1} {s.sec3BoxText2}
                                </p>
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                    {s.sec3BoxNote}
                                </p>
                            </div>
                            <div className="overflow-x-auto mb-4">
                                <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-700 text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-800">
                                        <tr>
                                            <th className="border border-gray-300 dark:border-gray-700 px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">
                                                {s.tableColItem}
                                            </th>
                                            <th className="border border-gray-300 dark:border-gray-700 px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">
                                                {s.tableColBasis}
                                            </th>
                                            <th className="border border-gray-300 dark:border-gray-700 px-4 py-3 text-left font-semibold text-gray-900 dark:text-white">
                                                {s.tableColPeriod}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-gray-700 dark:text-white">
                                        <tr>
                                            <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">
                                                {s.row1Item}
                                            </td>
                                            <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">
                                                {s.row1Basis}
                                            </td>
                                            <td className="border border-gray-300 px-4 py-3 font-semibold">{s.row1Period}</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">
                                                {s.row2Item}
                                            </td>
                                            <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">
                                                {s.row2Basis}
                                            </td>
                                            <td className="border border-gray-300 px-4 py-3 font-semibold">{s.row2Period}</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">
                                                {s.row3Item}
                                            </td>
                                            <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">
                                                {s.row3Basis}
                                            </td>
                                            <td className="border border-gray-300 px-4 py-3 font-semibold">{s.row3Period}</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">
                                                {s.row4Item}
                                            </td>
                                            <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">
                                                {s.row4Basis}
                                            </td>
                                            <td className="border border-gray-300 px-4 py-3 font-semibold">{s.row4Period}</td>
                                        </tr>
                                        <tr>
                                            <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">
                                                {s.row5Item}
                                            </td>
                                            <td className="border border-gray-300 dark:border-gray-700 px-4 py-3">
                                                {s.row5Basis}
                                            </td>
                                            <td className="border border-gray-300 px-4 py-3 font-semibold">{s.row5Period}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                {s.sec3FooterPre}{" "}
                                {s.sec3FooterLinkPre}{" "}
                                <a href="/privacy#retention" className="text-blue-600 dark:text-blue-400 hover:underline">
                                    {s.sec3FooterLinkText}
                                </a>
                                {s.sec3FooterLinkPost}
                            </p>
                        </section>

                        <section className="mb-8">
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{s.sec4Title}</h3>
                            <ul className="list-disc pl-6 space-y-2 dark:text-white">
                                <li>{s.sec4L1}</li>
                                <li>
                                    {s.sec4L2}
                                </li>
                                <li>
                                    <strong>{s.sec4L3Pre}</strong>{s.sec4L3Post}
                                </li>
                                <li>
                                    {s.sec4L4Pre}{" "}
                                    <a href="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">
                                        {s.sec4L4Link}
                                    </a>
                                    {s.sec4L4Post}
                                </li>
                            </ul>
                        </section>

                        <p className="text-sm text-gray-500 dark:text-gray-400">{s.lastUpdated}</p>
                    </div>
                </div>
            </main>
        </div>
    );
}
