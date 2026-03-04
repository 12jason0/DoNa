"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLocale } from "@/context/LocaleContext";
import { getSafeRedirectPath } from "@/lib/redirect";
import dynamic from "next/dynamic";

// 모바일 앱 환경에서만 Apple 로그인 컴포넌트 로드
const AppleLoginButton = dynamic(() => import("@/components/AppleLoginButton"), { ssr: false });

const Signup = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { t, isLocaleReady } = useLocale();

    // next 파라미터가 없으면 메인 페이지로 이동
    const nextParam = searchParams.get("next");
    const next = nextParam ? getSafeRedirectPath(nextParam, "/") : "/";

    const [formData, setFormData] = useState({
        email: "",
        password: "",
        confirmPassword: "",
        nickname: "",
        phone: "",
        birthday: "",
        ageRange: "",
        gender: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
        if (error) setError("");
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        // 유효성 검사
        if (!formData.nickname.trim() || formData.nickname.length < 2) {
            setError(t("authPage.signup.errorNicknameMin"));
            setLoading(false);
            return;
        }
        if (formData.password.length < 6) {
            setError(t("authPage.signup.errorPasswordMin"));
            setLoading(false);
            return;
        }
        if (formData.password !== formData.confirmPassword) {
            setError(t("authPage.signup.errorPasswordMismatch"));
            setLoading(false);
            return;
        }

        // 💡 [수정] 애플 가이드라인 준수: 연령대 및 성별 필수 체크 로직 제거

        try {
            const response = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    email: formData.email,
                    password: formData.password,
                    nickname: formData.nickname.trim(),
                    phone: formData.phone.trim() || undefined,
                    birthday: formData.birthday.trim() || undefined,
                    // 💡 [수정] 값이 비어있을 경우 undefined로 전달하여 DB에 null로 저장되도록 유도
                    ageRange: formData.ageRange || undefined,
                    gender: formData.gender || undefined,
                    next,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                window.dispatchEvent(new CustomEvent("authLoginSuccess"));
                const redirectPath = data.next || next || "/";
                window.location.href = redirectPath;
            } else {
                setError(data.error || t("authPage.signup.errorSignupFailed"));
            }
        } catch (err) {
            console.error("Signup Error:", err);
            setError(t("authPage.signup.errorConnection"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F9FAFB] dark:bg-[#0f1710] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-md w-full space-y-8 bg-white dark:bg-[#1a241b] p-8 md:p-10 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
                {!isLocaleReady ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent" />
                    </div>
                ) : (
                <>
                <div className="text-center">
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight font-brand">
                        DoNa<span className="text-emerald-600 dark:text-emerald-400">.</span>
                    </h1>
                    <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 font-medium">
                        {t("authPage.signup.tagline")}
                    </p>
                </div>

                {error && (
                    <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 border border-red-100 dark:border-red-800/50 flex items-center animate-pulse">
                        <svg
                            className="h-5 w-5 text-red-500 dark:text-red-400 mr-3"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                        >
                            <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                clipRule="evenodd"
                            />
                        </svg>
                        <p className="text-sm font-bold text-red-600 dark:text-red-400">{error}</p>
                    </div>
                )}

                <div className="mt-6 space-y-3">
                    <button
                        type="button"
                        onClick={() => {
                            window.location.href = `/api/auth/kakao?next=${encodeURIComponent(next)}`;
                        }}
                        disabled={loading}
                        className="w-full flex items-center justify-center px-4 py-4 border border-transparent rounded-2xl shadow-sm text-[15px] font-bold text-[#3C1E1E] bg-[#FEE500] hover:bg-[#FDD835] transition-all disabled:opacity-50"
                    >
                        <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 3C5.9 3 1 6.5 1 10.8c0 2.6 1.7 4.9 4.3 6.3-.2.8-.8 2.8-.8 3 0 .1 0 .2.2.2.1 0 .2-.1.3-.2 3.3-2.3 4.8-3.4 4.8-3.4.4.1.8.1 1.2.1 6.1 0 11-3.5 11-7.8C23 6.5 18.1 3 12 3z" />
                        </svg>
                        {t("authPage.signup.kakaoCta")}
                    </button>

                    <AppleLoginButton
                        next={next}
                        onSuccess={async (credential: any) => {
                            setLoading(true);
                            setError("");
                            try {
                                const response = await fetch("/api/auth/apple", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    credentials: "include",
                                    body: JSON.stringify({
                                        identityToken: credential.identityToken,
                                        authorizationCode: credential.authorizationCode,
                                        fullName: credential.fullName,
                                        email: credential.email,
                                    }),
                                });
                                if (!response.ok) throw new Error(t("authPage.signup.errorAppleAuth"));
                                window.location.href = next || "/";
                            } catch (err: any) {
                                setError(err.message);
                            } finally {
                                setLoading(false);
                            }
                        }}
                    />
                </div>

                <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-100 dark:border-gray-700" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-4 bg-white dark:bg-[#1a241b] text-gray-400 dark:text-gray-500 font-medium">
                            {t("authPage.signup.orEmail")}
                        </span>
                    </div>
                </div>

                <form className="space-y-5" onSubmit={handleSubmit}>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5 ml-1">
                            {t("authPage.signup.nickname")} <span className="text-emerald-500 dark:text-emerald-400">*</span>
                        </label>
                        <input
                            name="nickname"
                            type="text"
                            required
                            value={formData.nickname}
                            onChange={handleChange}
                            placeholder={t("authPage.signup.nicknamePlaceholder")}
                            className="appearance-none block w-full px-4 py-3.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-[#0f1710] dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 transition-all font-medium sm:text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5 ml-1">
                            {t("authPage.signup.email")} <span className="text-emerald-500 dark:text-emerald-400">*</span>
                        </label>
                        <input
                            name="email"
                            type="email"
                            required
                            value={formData.email}
                            autoComplete="username"
                            onChange={handleChange}
                            placeholder={t("authPage.signup.emailPlaceholder")}
                            className="appearance-none block w-full px-4 py-3.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-[#0f1710] dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 transition-all font-medium sm:text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5 ml-1">
                            {t("authPage.signup.password")} <span className="text-emerald-500 dark:text-emerald-400">*</span>
                        </label>
                        <input
                            name="password"
                            type="password"
                            required
                            value={formData.password}
                            onChange={handleChange}
                            placeholder={t("authPage.signup.passwordPlaceholder")}
                            autoComplete="current-password"
                            className="appearance-none block w-full px-4 py-3.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-[#0f1710] dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 transition-all font-medium sm:text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5 ml-1">
                            {t("authPage.signup.confirmPassword")} <span className="text-emerald-500 dark:text-emerald-400">*</span>
                        </label>
                        <input
                            name="confirmPassword"
                            type="password"
                            required
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            placeholder={t("authPage.signup.confirmPasswordPlaceholder")}
                            autoComplete="current-password"
                            className="appearance-none block w-full px-4 py-3.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-[#0f1710] dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 transition-all font-medium sm:text-sm"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            {/* 💡 [수정] 필수 표시(*) 제거 및 (선택) 추가 */}
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5 ml-1">
                                {t("authPage.signup.ageRange")} <span className="text-gray-400 font-normal"></span>
                            </label>
                            <select
                                name="ageRange"
                                // 💡 [수정] required 속성 제거
                                value={formData.ageRange}
                                onChange={handleChange}
                                className="block w-full px-4 py-3.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-[#0f1710] dark:text-white focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 outline-none text-sm"
                            >
                                <option value="">{t("authPage.signup.ageRangeOption")}</option>
                                <option value="10대">{t("authPage.signup.age10s")}</option>
                                <option value="20대">{t("authPage.signup.age20s")}</option>
                                <option value="30대">{t("authPage.signup.age30s")}</option>
                                <option value="40대">{t("authPage.signup.age40s")}</option>
                                <option value="50대">{t("authPage.signup.age50s")}</option>
                            </select>
                        </div>
                        <div>
                            {/* 💡 [수정] 필수 표시(*) 제거 및 (선택) 추가 */}
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5 ml-1">
                                {t("authPage.signup.gender")} <span className="text-gray-400 font-normal"></span>
                            </label>
                            <select
                                name="gender"
                                // 💡 [수정] required 속성 제거
                                value={formData.gender}
                                onChange={handleChange}
                                className="block w-full px-4 py-3.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-[#0f1710] dark:text-white focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 outline-none text-sm"
                            >
                                <option value="">{t("authPage.signup.ageRangeOption")}</option>
                                <option value="M">{t("authPage.signup.genderM")}</option>
                                <option value="F">{t("authPage.signup.genderF")}</option>
                            </select>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center py-4 px-4 border border-transparent text-[16px] font-bold rounded-lg text-white bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-70 transition-all transform active:scale-[0.98]"
                    >
                        {loading ? t("authPage.signup.submitting") : t("authPage.signup.submit")}
                    </button>
                </form>

                <div className="text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                        {t("authPage.signup.hasAccount")}{" "}
                        <Link
                            href={`/login?next=${encodeURIComponent(next)}`}
                            className="font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-500 transition-colors ml-1"
                        >
                            {t("authPage.signup.loginLink")}
                        </Link>
                    </p>
                </div>
                </>
                )}
            </div>
        </div>
    );
};

export default Signup;
