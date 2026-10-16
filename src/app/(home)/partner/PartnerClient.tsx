"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { INQUIRY_TYPES, type InquiryType } from "@/lib/partnerInquiry";

// TODO(제휴 내용): 확정된 문구를 받으면 채우기. 비어 있으면 섹션이 안 보임
const PARTNER_OFFERS: { title: string; desc: string }[] = [];

const inputCls =
    "w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a241b] px-4 py-3 text-[15px] text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7FCC9F] focus:border-transparent";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5">
                {label}
                {required && <span className="text-emerald-600 ml-0.5">*</span>}
            </span>
            {children}
        </label>
    );
}

export default function PartnerClient() {
    const formRef = useRef<HTMLElement>(null);
    const [inquiryType, setInquiryType] = useState<InquiryType>("popup");
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setSubmitting(true);
        setError("");
        try {
            const res = await fetch("/api/partner", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    brandName: f.get("brandName"),
                    contactName: f.get("contactName"),
                    contact: f.get("contact"),
                    inquiryType,
                    message: f.get("message"),
                    agree: f.get("agree") === "on",
                    website: f.get("website"),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || "접수 중 오류가 발생했어요.");
            setDone(true);
            formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch (err: any) {
            setError(err?.message || "접수 중 오류가 발생했어요.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-white dark:bg-[#0f1710] pb-28">
            {/* 1. 첫 화면 */}
            <section className="px-5 pt-12 pb-10 bg-linear-to-b from-[#eaf7ef] to-white dark:from-[#14231a] dark:to-[#0f1710]">
                <span className="inline-block rounded-full bg-white/80 dark:bg-white/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900">
                    제휴·광고 문의
                </span>
                <h1 className="mt-4 text-[26px] leading-snug font-bold text-gray-900 dark:text-white">
                    밀키트처럼 꺼내 먹는
                    <br />
                    데이트 코스, DoNa
                </h1>
                <p className="mt-3 text-[15px] leading-relaxed text-gray-600 dark:text-gray-300">
                    팝업·가게·브랜드를 두나에서 소개하고 싶다면 편하게 문의해 주세요.
                </p>
                <button
                    type="button"
                    onClick={() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    className="mt-7 w-full rounded-2xl bg-[#1a3a2e] py-4 text-base font-bold text-white shadow-lg shadow-emerald-900/10 active:scale-[0.98] transition"
                >
                    문의하기
                </button>
            </section>

            {/* 2. 소개되면 보이는 곳 */}
            <section className="px-5 py-10">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">두나에 소개되면 보이는 곳</h2>
                <div className="mt-4 space-y-3">
                    <a
                        href="https://www.instagram.com/dona.date"
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-4 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition"
                    >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                <rect x="3" y="3" width="18" height="18" rx="5" />
                                <circle cx="12" cy="12" r="4" />
                                <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" />
                            </svg>
                        </span>
                        <span>
                            <span className="block font-semibold text-gray-900 dark:text-white">인스타그램 @dona.date</span>
                            <span className="block text-sm text-gray-500 dark:text-gray-400">두나 공식 인스타그램 계정</span>
                        </span>
                    </a>
                    <Link
                        href="/courses"
                        className="flex items-center gap-4 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition"
                    >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#7FCC9F] text-white">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                                <line x1="8" y1="2" x2="8" y2="18" />
                                <line x1="16" y1="6" x2="16" y2="22" />
                            </svg>
                        </span>
                        <span>
                            <span className="block font-semibold text-gray-900 dark:text-white">두나 앱·웹 데이트 코스</span>
                            <span className="block text-sm text-gray-500 dark:text-gray-400">코스 속 장소로 소개돼요</span>
                        </span>
                    </Link>
                </div>
            </section>

            {/* 3. 제휴 내용 (문구 확정 전엔 숨김) */}
            {PARTNER_OFFERS.length > 0 && (
                <section className="px-5 pb-10">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">제휴 내용</h2>
                    <ul className="mt-4 space-y-3">
                        {PARTNER_OFFERS.map((o) => (
                            <li key={o.title} className="rounded-2xl bg-gray-50 dark:bg-white/5 p-4">
                                <p className="font-semibold text-gray-900 dark:text-white">{o.title}</p>
                                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{o.desc}</p>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* 4. 문의 폼 */}
            <section ref={formRef} className="px-5 scroll-mt-4">
                {done ? (
                    <div className="rounded-3xl bg-[#eaf7ef] dark:bg-[#14231a] px-6 py-12 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#7FCC9F] text-white">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </div>
                        <p className="mt-5 text-xl font-bold text-gray-900 dark:text-white">접수됐어요</p>
                        <p className="mt-2 text-[15px] text-gray-600 dark:text-gray-300">확인 후 연락드릴게요.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="rounded-3xl border border-gray-100 dark:border-gray-800 p-5 space-y-5">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">문의하기</h2>

                        {/* honeypot: 사람에겐 안 보임 */}
                        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />

                        <Field label="브랜드·가게 이름" required>
                            <input name="brandName" required maxLength={100} className={inputCls} placeholder="예: 두나 팝업스토어" />
                        </Field>
                        <Field label="담당자 이름" required>
                            <input name="contactName" required maxLength={50} className={inputCls} placeholder="홍길동" />
                        </Field>
                        <Field label="연락처 (전화 또는 이메일)" required>
                            <input name="contact" required maxLength={100} className={inputCls} placeholder="010-0000-0000 또는 name@example.com" />
                        </Field>

                        <div>
                            <span className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5">문의 종류</span>
                            <div className="grid grid-cols-2 gap-2">
                                {(Object.keys(INQUIRY_TYPES) as InquiryType[]).map((k) => (
                                    <button
                                        key={k}
                                        type="button"
                                        onClick={() => setInquiryType(k)}
                                        aria-pressed={inquiryType === k}
                                        className={`rounded-xl border py-3 text-sm font-semibold transition ${
                                            inquiryType === k
                                                ? "border-[#1a3a2e] bg-[#1a3a2e] text-white dark:border-[#7FCC9F] dark:bg-[#7FCC9F] dark:text-[#0f1710]"
                                                : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
                                        }`}
                                    >
                                        {INQUIRY_TYPES[k]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <Field label="문의 내용" required>
                            <textarea
                                name="message"
                                required
                                maxLength={2000}
                                rows={5}
                                className={`${inputCls} resize-y`}
                                placeholder="소개하고 싶은 팝업·가게, 기간, 원하는 방식 등을 자유롭게 적어 주세요."
                            />
                        </Field>

                        {/* 개인정보 수집·이용 동의 */}
                        <div className="rounded-2xl bg-gray-50 dark:bg-white/5 p-4 text-[13px] leading-relaxed text-gray-600 dark:text-gray-400">
                            <p className="font-semibold text-gray-800 dark:text-gray-200 mb-2">개인정보 수집·이용 안내</p>
                            <dl className="grid grid-cols-[4.5rem_1fr] gap-y-1">
                                <dt className="text-gray-500">수집 항목</dt>
                                <dd>브랜드·가게 이름, 담당자 이름, 연락처(전화 또는 이메일), 문의 내용</dd>
                                <dt className="text-gray-500">이용 목적</dt>
                                <dd>제휴·광고 문의 확인 및 회신</dd>
                                <dt className="text-gray-500">보관 기간</dt>
                                <dd>접수일로부터 1년 보관 후 파기</dd>
                            </dl>
                            <p className="mt-2">동의하지 않을 수 있으며, 동의하지 않으면 문의를 접수할 수 없어요.</p>
                            <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                                <input type="checkbox" name="agree" required className="h-5 w-5 accent-[#1a3a2e]" />
                                개인정보 수집·이용에 동의해요 (필수)
                            </label>
                        </div>

                        {error && <p className="text-sm text-red-500">{error}</p>}

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full rounded-2xl bg-[#1a3a2e] py-4 text-base font-bold text-white disabled:opacity-60 active:scale-[0.98] transition"
                        >
                            {submitting ? "보내는 중..." : "보내기"}
                        </button>
                    </form>
                )}
            </section>
        </div>
    );
}
