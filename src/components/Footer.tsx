// src/components/Footer.tsx

"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import ComingSoonModal from "@/components/ComingSoonModal";

export default function Footer() {
    const pathname = usePathname();
    const [showEscapeComingSoon, setShowEscapeComingSoon] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const token = localStorage.getItem("authToken");
            setIsLoggedIn(!!token);
        }
    }, []);

    if (pathname === "/map" || pathname?.startsWith("/map/")) {
        return null;
    }

    const isActive = (href: string) => pathname === href || pathname?.startsWith(href + "/");

    // 공통 SVG 속성
    const svgProps = {
        width: "28",
        height: "28",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "2",
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
    };

    return (
        <footer
            className="w-full"
            style={{
                backgroundColor: "#ffffff",
                borderTop: "2px solid rgba(153,192,142,0.5)",
                paddingBottom: "calc(8px + env(safe-area-inset-bottom))",
                backdropFilter: "saturate(180%) blur(8px)",
            }}
        >
            <div className="max-w-7xl mx-auto px-4 py-2">
                <nav className="flex items-center justify-around">
                    {/* 1. 홈 */}
                    <Link
                        href="/"
                        aria-label="메인"
                        className={`p-2 rounded-md hover:bg-green-50 ${isActive("/") ? "bg-green-50" : ""}`}
                        style={{ color: isActive("/") ? "#7aa06f" : "#99c08e" }}
                    >
                        <svg {...svgProps}>
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                    </Link>

                    {/* 2. 코스 */}
                    <Link
                        href="/courses"
                        aria-label="코스"
                        className={`p-2 rounded-md hover:bg-green-50 ${isActive("/courses") ? "bg-green-50" : ""}`}
                        style={{ color: isActive("/courses") ? "#7aa06f" : "#99c08e" }}
                    >
                        <svg {...svgProps}>
                            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                            <line x1="8" y1="2" x2="8" y2="18" />
                            <line x1="16" y1="6" x2="16" y2="22" />
                        </svg>
                    </Link>

                    {/* 3. 맵 */}
                    <Link
                        href="/map"
                        aria-label="맵"
                        className={`p-2 rounded-md hover:bg-green-50 ${isActive("/map") ? "bg-green-50" : ""}`}
                        style={{ color: isActive("/map") ? "#7aa06f" : "#99c08e" }}
                    >
                        <svg {...svgProps}>
                            <circle cx="12" cy="12" r="10" />
                            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                        </svg>
                    </Link>

                    {/* 4. Escape (수정됨: 깃발 아이콘 -> 준비중 모달) */}
                    <button
                        onClick={() => setShowEscapeComingSoon(true)}
                        aria-label="Escape"
                        className={`p-2 rounded-md hover:bg-green-50 ${isActive("/escape") ? "bg-green-50" : ""}`}
                        style={{ color: isActive("/escape") ? "#7aa06f" : "#99c08e" }}
                    >
                        <svg {...svgProps}>
                            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                            <line x1="4" x2="4" y1="22" y2="15" />
                        </svg>
                    </button>

                    {/* 5. 마이페이지 */}
                    <Link
                        href="/mypage"
                        aria-label="마이페이지"
                        className={`p-2 rounded-md hover:bg-green-50 relative ${
                            isActive("/mypage") ? "bg-green-50" : ""
                        }`}
                        style={{ color: isActive("/mypage") ? "#7aa06f" : "#99c08e" }}
                    >
                        <svg {...svgProps}>
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                        {/* 로그인 상태일 때 빨간 점 깜빡임 (알림 유도) */}
                        {isLoggedIn && (
                            <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                            </span>
                        )}
                    </Link>
                </nav>
            </div>

            {/* ✅ 사건 파일 준비 중 모달 */}
            {showEscapeComingSoon && <ComingSoonModal onClose={() => setShowEscapeComingSoon(false)} />}
        </footer>
    );
}
