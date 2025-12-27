"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSafeRedirectPath } from "@/lib/redirect";
import dynamic from "next/dynamic";

// 모바일 앱 환경에서만 Apple 로그인 컴포넌트 로드
const AppleLoginButton = dynamic(() => import("@/components/AppleLoginButton"), { ssr: false });

const Signup = () => {
    const router = useRouter();
    const searchParams = useSearchParams();

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
        if (!formData.ageRange) {
            setError("연령대를 선택해주세요.");
            setLoading(false);
            return;
        }
        if (!formData.gender) {
            setError("성별을 선택해주세요.");
            setLoading(false);
            return;
        }

        try {
            // 💡 [해결] 상대 경로 사용으로 CSP 위반 방지 및 credentials 추가
            const response = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                // 🟢 필수: 서버 사이드 보안 쿠키(httpOnly)를 브라우저에 안착시키기 위해 필요
                credentials: "include",
                body: JSON.stringify({
                    email: formData.email,
                    password: formData.password,
                    nickname: formData.nickname.trim(),
                    phone: formData.phone.trim() || undefined,
                    birthday: formData.birthday.trim() || undefined,
                    ageRange: formData.ageRange,
                    gender: formData.gender,
                    next,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                // 🎁 신규 가입 혜택 로직 (UI 반영용)
                try {
                    localStorage.setItem("userCoupons", "3"); // 2026-01-10 이벤트 반영
                    localStorage.setItem("userCoins", "3");
                } catch {}

                // 🟢 로그인 성공 이벤트 발생 (인증 상태 동기화) [cite: 2025-12-24]
                window.dispatchEvent(new CustomEvent("authLoginSuccess"));

                // 회원가입 후 원래 가려던 페이지로 이동
                const redirectPath = data.next || next || "/";

                // 쿠키가 브라우저에 완전히 저장될 시간을 주기 위해 window.location 사용 권장
                window.location.href = redirectPath;
            } else {
                setError(data.error || "회원가입에 실패했습니다.");
            }
        } catch (err) {
            console.error("Signup Error:", err);
            setError("서버와의 연결이 원활하지 않습니다. 주소를 확인해주세요.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-md w-full space-y-8 bg-white p-8 md:p-10 rounded-xl border border-gray-100 shadow-sm">
                <div className="text-center">
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight font-brand">
                        DoNa<span className="text-emerald-600">.</span>
                    </h1>
                    <p className="mt-3 text-sm text-gray-500 font-medium">두나와 함께 특별한 여정을 기록해보세요.</p>
                </div>

                {error && (
                    <div className="rounded-xl bg-red-50 p-4 border border-red-100 flex items-center animate-pulse">
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
                        카카오로 3초 만에 시작하기
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
                                    credentials: "include", // 🟢 보안 쿠키 적용
                                    body: JSON.stringify({
                                        identityToken: credential.identityToken,
                                        authorizationCode: credential.authorizationCode,
                                        fullName: credential.fullName,
                                        email: credential.email,
                                    }),
                                });
                                if (!response.ok) throw new Error("Apple 인증 실패");
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
                        <div className="w-full border-t border-gray-100" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-4 bg-white text-gray-400 font-medium">또는 이메일로 가입</span>
                    </div>
                </div>

                <form className="space-y-5" onSubmit={handleSubmit}>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">
                            닉네임 <span className="text-emerald-500">*</span>
                        </label>
                        <input
                            name="nickname"
                            type="text"
                            required
                            value={formData.nickname}
                            onChange={handleChange}
                            placeholder="두나에서 사용할 이름"
                            className="appearance-none block w-full px-4 py-3.5 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium sm:text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">
                            이메일 <span className="text-emerald-500">*</span>
                        </label>
                        <input
                            name="email"
                            type="email"
                            required
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="name@example.com"
                            className="appearance-none block w-full px-4 py-3.5 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium sm:text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">
                            비밀번호 <span className="text-emerald-500">*</span>
                        </label>
                        <input
                            name="password"
                            type="password"
                            required
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="6자 이상 입력해주세요"
                            className="appearance-none block w-full px-4 py-3.5 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium sm:text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">
                            비밀번호 확인 <span className="text-emerald-500">*</span>
                        </label>
                        <input
                            name="confirmPassword"
                            type="password"
                            required
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            placeholder="비밀번호 재입력"
                            className="appearance-none block w-full px-4 py-3.5 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium sm:text-sm"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">
                                연령대 <span className="text-emerald-500">*</span>
                            </label>
                            <select
                                name="ageRange"
                                required
                                value={formData.ageRange}
                                onChange={handleChange}
                                className="block w-full px-4 py-3.5 border border-gray-200 rounded-lg bg-gray-50 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                            >
                                <option value="">선택</option>
                                <option value="20대">20대</option>
                                <option value="30대">30대</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5 ml-1">
                                성별 <span className="text-emerald-500">*</span>
                            </label>
                            <select
                                name="gender"
                                required
                                value={formData.gender}
                                onChange={handleChange}
                                className="block w-full px-4 py-3.5 border border-gray-200 rounded-lg bg-gray-50 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                            >
                                <option value="">선택</option>
                                <option value="M">남성</option>
                                <option value="F">여성</option>
                            </select>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center py-4 px-4 border border-transparent text-[16px] font-bold rounded-lg text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-70 transition-all transform active:scale-[0.98]"
                    >
                        {loading ? "가입 중..." : "회원가입 완료"}
                    </button>
                </form>

                <div className="text-center">
                    <p className="text-sm text-gray-500 font-medium">
                        이미 계정이 있으신가요?
                        <Link
                            href={`/login?next=${encodeURIComponent(next)}`}
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
