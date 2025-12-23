"use client";

import { useState, useEffect } from "react";
import { checkAdminPassword } from "@/app/actions/adminAuth";

export default function AdminAuthGuard({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [inputPassword, setInputPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // 세션 스토리지 체크 (브라우저 닫으면 로그아웃)
        const auth = sessionStorage.getItem("admin_auth");
        if (auth === "true") {
            setIsAuthenticated(true);
        }
        setIsLoading(false);
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            // 🟢 서버 API를 통해 쿠키 설정 (서버 사이드 인증)
            const res = await fetch("/api/admin/auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include", // 쿠키 전송을 위해 필요
                body: JSON.stringify({ password: inputPassword }),
            });

            if (res.ok) {
                // 클라이언트 사이드에도 저장 (UI 상태 관리용)
                sessionStorage.setItem("admin_auth", "true");
                setIsAuthenticated(true);
            } else {
                const data = await res.json();
                setError(data.error || "비밀번호가 올바르지 않습니다.");
            }
        } catch (err) {
            console.error("관리자 로그인 오류:", err);
            setError("로그인 중 오류가 발생했습니다.");
        } finally {
            setIsLoading(false);
        }
    };

    // 초기 로딩 중에는 아무것도 보여주지 않음 (깜빡임 방지)
    if (isLoading) return null;

    // 인증되지 않았으면 로그인 폼 표시
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
                <div className="bg-white p-8 rounded-xl border border-gray-100 w-full max-w-sm">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                            🔒
                        </div>
                        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">관리자 인증</h1>
                        <p className="text-gray-500 text-sm mt-2">접근 권한 확인이 필요합니다.</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <input
                                type="password"
                                value={inputPassword}
                                onChange={(e) => {
                                    setInputPassword(e.target.value);
                                    setError("");
                                }}
                                className="w-full border border-gray-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all"
                                placeholder="관리자 비밀번호 입력"
                                autoFocus
                            />
                        </div>
                        {error && (
                            <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg flex items-center animate-pulse">
                                ⚠️ {error}
                            </div>
                        )}
                        <button
                            type="submit"
                            className="w-full bg-slate-900 text-white py-3.5 rounded-lg font-bold hover:bg-slate-800 active:scale-95 transition-all tracking-tight"
                        >
                            접속하기
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // 인증되면 원래 내용 표시
    return <>{children}</>;
}
