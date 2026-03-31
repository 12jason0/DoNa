"use client";

import { useLocale } from "@/context/LocaleContext";
import { getBusinessStrings } from "@/i18n/legal/businessPack";

export default function BusinessPage() {
    const { locale } = useLocale();
    const s = getBusinessStrings(locale);
    return (
        <div className="flex flex-col min-h-screen bg-white">
            <main className="grow container mx-auto px-4 py-8 bg-white">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold text-gray-900 mb-8">{s.pageTitle}</h1>

                    <div className="prose prose-lg max-w-none">
                        <div className="bg-gray-50 rounded-lg p-8">
                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{s.labelService}</h3>
                                    <p className="text-gray-700">DoNa</p>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{s.labelRepresentative}</h3>
                                    <p className="text-gray-700">{s.representativeName}</p>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{s.labelRegNo}</h3>
                                    <p className="text-gray-700">166-10-03081</p>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{s.labelOnlineSalesNo}</h3>
                                    <p className="text-gray-700">{s.onlineSalesNo}</p>
                                </div>

                                <div className="md:col-span-2">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{s.labelLocation}</h3>
                                    <p className="text-gray-700">{s.locationValue}</p>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{s.labelContact}</h3>
                                    <p className="text-gray-700">12jason@donacouse.com</p>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{s.labelServiceHours}</h3>
                                    <p className="text-gray-700">{s.serviceHours}</p>
                                </div>

                                <div className="md:col-span-2">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{s.labelPrivacyOfficer}</h3>
                                    <p className="text-gray-700">{s.privacyOfficerValue}</p>
                                </div>
                            </div>
                        </div>

                        {/* 서비스 소개 */}
                        <div className="mt-8 bg-blue-50 rounded-lg p-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">{s.aboutTitle}</h2>
                            <p className="text-gray-700 mb-4">
                                {s.aboutDesc}
                            </p>
                            <ul className="list-disc pl-6 text-gray-700 space-y-2">
                                <li>
                                    <strong>{s.feature1Bold}</strong> {s.feature1}
                                </li>
                                <li>
                                    <strong>{s.feature2Bold}</strong> {s.feature2}
                                </li>
                                <li>
                                    <strong>{s.feature3Bold}</strong> {s.feature3}
                                </li>
                                <li>
                                    <strong>{s.feature4Bold}</strong> {s.feature4}
                                </li>
                            </ul>
                        </div>

                        {/* 연락처 및 문의 */}
                        <div className="mt-8 bg-gray-50 rounded-lg p-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">📞 {s.contactTitle}</h2>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <h3 className="font-semibold text-gray-900 mb-2">{s.contactGeneralTitle}</h3>
                                    <p className="text-gray-700">12jason@donacouse.com</p>
                                    <p className="text-sm text-gray-500">{s.contactGeneralNote}</p>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 mb-2">{s.contactPrivacyTitle}</h3>
                                    <p className="text-gray-700">12jason@donacouse.com</p>
                                    <p className="text-sm text-gray-500">{s.contactPrivacyNote}</p>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 mb-2">{s.contactTechTitle}</h3>
                                    <p className="text-gray-700">12jason@donacouse.com</p>
                                    <p className="text-sm text-gray-500">{s.contactTechNote}</p>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 mb-2">{s.contactPartnerTitle}</h3>
                                    <p className="text-gray-700">12jason@donacouse.com</p>
                                    <p className="text-sm text-gray-500">{s.contactPartnerNote}</p>
                                </div>
                            </div>
                        </div>

                        {/* 법적 고지 */}
                        <div className="mt-8 text-sm text-gray-600 border-t pt-6">
                            <p className="mb-2">
                                <strong>{s.copyrightBold}</strong> {s.copyright}
                            </p>
                            <p className="mb-2">
                                <strong>{s.disclaimerBold}</strong> {s.disclaimer}
                            </p>
                            <p>
                                <strong>{s.disputeBold}</strong> {s.dispute}
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
