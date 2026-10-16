"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import CourseCard, { type CourseCardProps } from "@/components/CourseCard";
import { INQUIRY_TYPES, type InquiryType } from "@/lib/partnerInquiry";

export type PartnerCourse = CourseCardProps["course"];

const INSTAGRAM_URL = "https://www.instagram.com/dona.date";
const GREEN = "#1a3a2e";
// Pretendard(아래 PRETENDARD_CSS로 로드), 실패 시 관리자 화면 폰트(.admin-system-font)
const FONT_STACK =
    '"Pretendard Variable", Pretendard, system-ui, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';

const inputCls =
    "w-full h-12 rounded-xl border border-gray-300 bg-white px-4 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#1a3a2e] focus:ring-1 focus:ring-[#1a3a2e]";

function Label({ htmlFor, children, required }: { htmlFor: string; children: React.ReactNode; required?: boolean }) {
    return (
        <label htmlFor={htmlFor} className="block mb-1.5 text-sm font-semibold text-gray-900">
            {children}
            {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
    );
}

function Spinner() {
    return (
        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
            <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
    );
}

function InquiryForm() {
    const [privacyOpen, setPrivacyOpen] = useState(false);
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
                    inquiryType: f.get("inquiryType"),
                    message: f.get("message"),
                    agree: f.get("agree") === "on",
                    website: f.get("website"),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || "접수 중 오류가 발생했어요.");
            setDone(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "접수 중 오류가 발생했어요.");
        } finally {
            setSubmitting(false);
        }
    };

    if (done) {
        return (
            <p className="py-10 text-center text-base text-gray-900">
                문의가 접수됐어요. 확인 후 남겨주신 연락처로 연락드릴게요.
            </p>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="relative space-y-5">
            {/* honeypot: 사람에겐 안 보임 */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />

            <div>
                <Label htmlFor="brandName" required>브랜드·가게 이름</Label>
                <input id="brandName" name="brandName" required maxLength={100} className={inputCls} />
            </div>
            <div>
                <Label htmlFor="contactName" required>담당자 이름</Label>
                <input id="contactName" name="contactName" required maxLength={50} className={inputCls} />
            </div>
            <div>
                <Label htmlFor="contact" required>연락처</Label>
                <input id="contact" name="contact" required maxLength={100} className={inputCls} placeholder="전화번호 또는 이메일" />
            </div>
            <div>
                <Label htmlFor="inquiryType" required>문의 종류</Label>
                <select id="inquiryType" name="inquiryType" required defaultValue="popup" className={inputCls}>
                    {(Object.keys(INQUIRY_TYPES) as InquiryType[]).map((k) => (
                        <option key={k} value={k}>
                            {INQUIRY_TYPES[k]}
                        </option>
                    ))}
                </select>
            </div>
            <div>
                <Label htmlFor="message" required>문의 내용</Label>
                <textarea
                    id="message"
                    name="message"
                    required
                    maxLength={2000}
                    rows={5}
                    className={`${inputCls} h-auto py-3 leading-relaxed resize-y`}
                    placeholder="소개하고 싶은 팝업·가게, 기간, 원하는 방식"
                />
            </div>

            <div>
                <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2.5 text-[15px] text-gray-900">
                        <input type="checkbox" name="agree" required className="h-5 w-5 accent-[#1a3a2e]" />
                        개인정보 수집·이용 동의(필수)
                    </label>
                    <button
                        type="button"
                        onClick={() => setPrivacyOpen((o) => !o)}
                        aria-expanded={privacyOpen}
                        className="shrink-0 text-sm text-gray-500 underline underline-offset-2"
                    >
                        {privacyOpen ? "닫기" : "보기"}
                    </button>
                </div>
                {privacyOpen && (
                    <dl className="mt-3 rounded-xl bg-[#F5F6F7] p-4 grid grid-cols-[4.5rem_1fr] gap-y-1.5 text-sm leading-relaxed text-gray-600">
                        <dt className="text-gray-900">수집 항목</dt>
                        <dd>브랜드·가게 이름, 담당자 이름, 연락처(전화 또는 이메일), 문의 내용</dd>
                        <dt className="text-gray-900">이용 목적</dt>
                        <dd>광고·제휴 문의 확인 및 회신</dd>
                        <dt className="text-gray-900">보관 기간</dt>
                        <dd>접수일로부터 1년 보관 후 파기</dd>
                        <dd className="col-span-2 mt-1">동의하지 않을 수 있으며, 동의하지 않으면 문의를 접수할 수 없어요.</dd>
                    </dl>
                )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
                type="submit"
                disabled={submitting}
                style={{ backgroundColor: GREEN }}
                className="w-full h-12 rounded-xl text-base font-semibold text-white disabled:opacity-70 flex items-center justify-center gap-2"
            >
                {submitting && <Spinner />}
                문의 보내기
            </button>
        </form>
    );
}

/** Pretendard 동적 서브셋 (이 페이지에서만 로드, CSP: jsdelivr 허용됨) */
const PRETENDARD_CSS =
    "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";

export type HeroPhoto = { src: string; region: string };

// 섹션 간격: 모바일 72px, PC 120px. 2단 기준은 md(768px) 하나
const SECTION = "mx-auto max-w-6xl px-5 py-[72px] md:py-[120px]";

export default function PartnerClient({
    course,
    instagramImage,
    heroPhotos,
    business,
}: {
    course: PartnerCourse | null;
    instagramImage: string | null;
    heroPhotos: HeroPhoto[];
    business: { title: string; lines: string[] };
}) {
    const formRef = useRef<HTMLElement>(null);
    const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

    return (
        <div
            className="admin-system-font min-h-screen bg-white text-gray-900"
            style={{ "--font-app": FONT_STACK } as React.CSSProperties}
        >
            <link rel="stylesheet" href={PRETENDARD_CSS} />
            {/* 1. 헤더 */}
            <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
                <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
                    {/* 로고만 브랜드 손글씨 */}
                    <Link href="/" className="text-xl text-gray-900" style={{ fontFamily: '"Cafe24Dongdong", sans-serif' }}>
                        DoNa
                    </Link>
                    <button
                        type="button"
                        onClick={scrollToForm}
                        style={{ backgroundColor: GREEN }}
                        className="h-9 rounded-xl px-4 text-sm font-semibold text-white"
                    >
                        문의하기
                    </button>
                </div>
            </header>

            {/* 2. 첫 화면: 왼쪽 제목·설명·버튼 / 오른쪽 코스 사진 2x2 */}
            <section className={`${SECTION} grid items-center gap-12 md:grid-cols-2 md:gap-14`}>
                <div>
                    <h1 className="text-[28px] font-bold leading-tight tracking-tight md:text-[40px]">두나 광고·제휴</h1>
                    <p className="mt-5 text-base leading-relaxed text-gray-600">
                        두나는 서울 데이트 코스를 추천하는 앱·웹 서비스이고, 인스타그램 @dona.date를 운영해요. 팝업·가게·브랜드를
                        두나의 데이트 코스와 인스타그램에 소개할 수 있어요.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={scrollToForm}
                            style={{ backgroundColor: GREEN }}
                            className="h-12 rounded-xl px-6 text-base font-semibold text-white"
                        >
                            문의하기
                        </button>
                        <a
                            href={INSTAGRAM_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-12 items-center rounded-xl border border-gray-300 px-6 text-base font-semibold text-gray-900"
                        >
                            인스타그램 보기
                        </a>
                    </div>
                </div>
                {heroPhotos.length > 0 && (
                    <div className="grid grid-cols-2 gap-4">
                        {heroPhotos.map((ph) => (
                            <figure key={ph.src}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={ph.src}
                                    alt={`${ph.region} 데이트 코스`}
                                    className="aspect-square w-full rounded-xl bg-[#F5F6F7] object-cover"
                                />
                                <figcaption className="mt-2 text-sm text-gray-500">{ph.region}</figcaption>
                            </figure>
                        ))}
                    </div>
                )}
            </section>

            {/* 3. 소개되면 이렇게 보여요: 코스 카드 + 인스타 캡처(파일 없으면 그 카드만 숨기고 코스 카드 가운데) */}
            {course && (
                <section className={`${SECTION} border-t border-gray-100`}>
                    <h2 className="text-2xl font-bold tracking-tight md:text-[28px]">두나에 소개되면 이렇게 보여요</h2>
                    <div className={`mt-10 grid gap-6 ${instagramImage ? "md:grid-cols-2" : "mx-auto max-w-[440px]"}`}>
                        <div className="overflow-hidden rounded-2xl border border-gray-200">
                            <div className="flex justify-center bg-[#F5F6F7] px-6 pt-8 pb-4 dark:bg-[#0f1710]">
                                <div className="w-full max-w-[340px]">
                                    <CourseCard course={course} showNewBadge={false} />
                                </div>
                            </div>
                            <p className="px-6 py-4 text-base text-gray-600">두나 앱·웹의 데이트 코스 속 장소로 소개돼요.</p>
                        </div>
                        {instagramImage && (
                            <div className="overflow-hidden rounded-2xl border border-gray-200">
                                <div className="flex justify-center bg-[#F5F6F7] px-6 pt-8 pb-6">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={instagramImage} alt="두나 인스타그램 게시물" className="w-full max-w-[340px] rounded-xl" />
                                </div>
                                <p className="px-6 py-4 text-base text-gray-600">인스타그램 @dona.date 게시물로 소개돼요.</p>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* 4. 문의 폼 */}
            <section ref={formRef} className={`${SECTION} scroll-mt-14 border-t border-gray-100`}>
                <div className="mx-auto max-w-[560px]">
                    <h2 className="text-center text-2xl font-bold tracking-tight md:text-[28px]">문의하기</h2>
                    <p className="mt-3 text-center text-base text-gray-600">보내주시면 확인 후 연락드릴게요.</p>
                    <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
                        <InquiryForm />
                    </div>
                </div>
            </section>

            {/* 5. 푸터: 사이트 사업자 정보 그대로 */}
            <footer className="bg-[#F5F6F7]">
                <div className="mx-auto max-w-6xl px-5 py-10 text-sm leading-relaxed text-gray-500">
                    <p className="mb-2 font-semibold text-gray-700">{business.title}</p>
                    {business.lines.map((line) => (
                        <p key={line}>{line}</p>
                    ))}
                </div>
            </footer>
        </div>
    );
}
