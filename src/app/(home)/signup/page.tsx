"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const Signup = () => {
    const router = useRouter();
    const [formData, setFormData] = useState({
        email: "",
        password: "",
        confirmPassword: "",
        nickname: "",
        phone: "",
        birthday: "",
        ageRange: "",
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
            setError("닉네임은 2자 이상 입력해주세요.");
            setLoading(false);
            return;
        }
        if (formData.password.length < 6) {
            setError("비밀번호는 최소 6자 이상이어야 합니다.");
            setLoading(false);
            return;
        }
        if (formData.password !== formData.confirmPassword) {
            setError("비밀번호가 일치하지 않습니다.");
            setLoading(false);
            return;
        }

        try {
            const response = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: formData.email,
                    password: formData.password,
                    nickname: formData.nickname.trim(),
                    phone: formData.phone.trim() || undefined,
                    birthday: formData.birthday.trim() || undefined,
                    ageRange: formData.ageRange || undefined,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                try {
                    localStorage.setItem("userCoupons", "2");
                    localStorage.setItem("userCoins", "2");
                } catch {}
                router.push("/login?message=회원가입이 완료되었습니다. 로그인해주세요.");
            } else {
                setError(data.error || "회원가입에 실패했습니다.");
            }
        } catch (err) {
            console.error("Signup Error:", err);
            setError("회원가입 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleSocialSignup = async (provider: "kakao") => {
        console.log("Social signup:", provider);
    };

    return (
        // 배경: 아주 연한 회색으로 깔끔하게 (초록색이 돋보이게 함)
        <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-md w-full space-y-8 bg-white p-8 md:p-10 rounded-[32px] shadow-xl border border-gray-100">
                {/* 헤더 섹션 */}
                <div className="text-center">
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight font-brand">
                        {/* 두나 로고에 시그니처 그린 적용 */}
                        DoNa<span className="text-emerald-600">.</span>
                    </h1>
                    <p className="mt-3 text-sm text-gray-500 font-medium">두나와 함께 특별한 여정을 기록해보세요.</p>
                </div>

                {/* 에러 메시지 */}
                {error && (
                    <div className="rounded-2xl bg-red-50 p-4 border border-red-100 flex items-center animate-pulse">
                        <svg className="h-5 w-5 text-red-500 mr-3" viewBox="0 0 20 20" fill="currentColor">
                            <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                clipRule="evenodd"
                            />
                        </svg>
                        <p className="text-sm font-bold text-red-600">{error}</p>
                    </div>
                )}

                {/* 소셜 로그인 */}
                <div className="mt-6">
                    <button
                        type="button"
                        onClick={() => handleSocialSignup("kakao")}
                        disabled={loading}
                        className="w-full flex items-center justify-center px-4 py-4 border border-transparent rounded-2xl shadow-sm text-[15px] font-bold text-[#3C1E1E] bg-[#FEE500] hover:bg-[#FDD835] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FEE500] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 3C5.9 3 1 6.5 1 10.8c0 2.6 1.7 4.9 4.3 6.3-.2.8-.8 2.8-.8 3 0 .1 0 .2.2.2.1 0 .2-.1.3-.2 3.3-2.3 4.8-3.4 4.8-3.4.4.1.8.1 1.2.1 6.1 0 11-3.5 11-7.8C23 6.5 18.1 3 12 3z" />
                        </svg>
                        카카오로 3초 만에 시작하기
                    </button>
                </div>

                {/* 구분선 */}
                <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-100" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-4 bg-white text-gray-400 font-medium">또는 이메일로 가입</span>
                    </div>
                </div>

                {/* 회원가입 폼 */}
                <form className="space-y-5" onSubmit={handleSubmit}>
                    {/* 닉네임 */}
                    <div>
                        <label htmlFor="nickname" className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">
                            닉네임 <span className="text-emerald-500">*</span>
                        </label>
                        <input
                            id="nickname"
                            name="nickname"
                            type="text"
                            required
                            value={formData.nickname}
                            onChange={handleChange}
                            placeholder="두나에서 사용할 이름"
                            // ✅ 포커스 시 에메랄드(녹색) 링 효과
                            className="appearance-none block w-full px-4 py-3.5 border border-gray-200 rounded-xl bg-gray-50 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent focus:bg-white transition-all font-medium sm:text-sm"
                        />
                    </div>

                    {/* 이메일 */}
                    <div>
                        <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">
                            이메일 <span className="text-emerald-500">*</span>
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            required
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="name@example.com"
                            className="appearance-none block w-full px-4 py-3.5 border border-gray-200 rounded-xl bg-gray-50 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent focus:bg-white transition-all font-medium sm:text-sm"
                        />
                    </div>

                    {/* 비밀번호 */}
                    <div>
                        <label htmlFor="password" className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">
                            비밀번호 <span className="text-emerald-500">*</span>
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            required
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="6자 이상 입력해주세요"
                            className="appearance-none block w-full px-4 py-3.5 border border-gray-200 rounded-xl bg-gray-50 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent focus:bg-white transition-all font-medium sm:text-sm"
                        />
                    </div>

                    {/* 비밀번호 확인 */}
                    <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">
                            비밀번호 확인 <span className="text-emerald-500">*</span>
                        </label>
                        <input
                            id="confirmPassword"
                            name="confirmPassword"
                            type="password"
                            required
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            placeholder="비밀번호를 한번 더 입력해주세요"
                            className="appearance-none block w-full px-4 py-3.5 border border-gray-200 rounded-xl bg-gray-50 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent focus:bg-white transition-all font-medium sm:text-sm"
                        />
                    </div>

                    <div className="pt-4">
                        {/* ✅ 버튼: 두나의 메인 컬러(Emerald-600) 적용 */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative w-full flex justify-center py-4 px-4 border border-transparent text-[16px] font-bold rounded-2xl text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-600 disabled:opacity-70 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform active:scale-[0.98]"
                        >
                            {loading ? (
                                <span className="flex items-center">
                                    <svg
                                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        ></circle>
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        ></path>
                                    </svg>
                                    가입 중...
                                </span>
                            ) : (
                                "회원가입 완료"
                            )}
                        </button>
                    </div>
                </form>

                {/* 로그인 링크 */}
                <div className="text-center">
                    <p className="text-sm text-gray-500 font-medium">
                        이미 계정이 있으신가요? {/* 로그인 링크도 두나 그린 컬러 */}
                        <Link
                            href="/login"
                            className="font-bold text-emerald-600 hover:text-emerald-700 transition-colors ml-1"
                        >
                            로그인하기
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Signup;
