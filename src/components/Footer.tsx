// src/components/Footer.tsx

"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

export default function Footer() {
    const pathname = usePathname();

    // [수정된 부분] 맵 페이지(/map)이거나 하위 경로(/map/...)일 경우 아무것도 렌더링하지 않음
    if (pathname === "/map" || pathname?.startsWith("/map/")) {
        return null;
    }

    const isActive = (href: string) => pathname === href || pathname?.startsWith(href + "/");

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
                    {/* 코스 */}
                    <Link
                        href="/courses"
                        aria-label="코스"
                        title="코스"
                        className={`p-2 rounded-md hover:bg-green-50 ${isActive("/courses") ? "bg-green-50" : ""}`}
                        style={{ color: isActive("/courses") ? "#7aa06f" : "#99c08e" }}
                    >
                        <svg
                            width="28"
                            height="28"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M9 4l-6 2v13l6-2 6 2 6-2V4l-6 2-6-2z" />
                            <path d="M9 4v13" />
                            <path d="M15 6v13" />
                        </svg>
                    </Link>
                    {/* 맵 */}
                    <Link
                        href="/map"
                        aria-label="맵"
                        title="맵"
                        className={`p-2 rounded-md hover:bg-green-50 ${isActive("/map") ? "bg-green-50" : ""}`}
                        style={{ color: isActive("/map") ? "#7aa06f" : "#99c08e" }}
                    >
                        <svg
                            width="28"
                            height="28"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <circle cx="12" cy="12" r="9" />
                            <path d="M15 9l-3 6-3-3 6-3z" />
                            <circle cx="12" cy="12" r="1" />
                        </svg>
                    </Link>
                    {/* 홈 */}
                    <Link
                        href="/"
                        aria-label="메인"
                        title="메인"
                        className={`p-2 rounded-md hover:bg-green-50 ${isActive("/") ? "bg-green-50" : ""}`}
                        style={{ color: isActive("/") ? "#7aa06f" : "#99c08e" }}
                    >
                        <svg
                            width="28"
                            height="28"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M3 10.5L12 4l9 6.5" />
                            <path d="M5 10.5V20h14V10.5" />
                            <path d="M10 20v-5h4v5" />
                        </svg>
                    </Link>
                    {/* 마이페이지 */}
                    <Link
                        href="/mypage"
                        aria-label="마이페이지"
                        title="마이페이지"
                        className={`p-2 rounded-md hover:bg-green-50 ${isActive("/mypage") ? "bg-green-50" : ""}`}
                        style={{ color: isActive("/mypage") ? "#7aa06f" : "#99c08e" }}
                    >
                        <svg
                            width="28"
                            height="28"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <circle cx="12" cy="8" r="3.5" />
                            <path d="M4 20c1.8-4.4 6-5.5 8-5.5s6.2 1.1 8 5.5" />
                        </svg>
                    </Link>

                    {/* Escape */}
                    <Link
                        href="/escape"
                        aria-label="Escape"
                        title="Escape"
                        className={`p-2 rounded-md hover:bg-green-50 ${isActive("/escape") ? "bg-green-50" : ""}`}
                        style={{ color: isActive("/escape") ? "#7aa06f" : "#99c08e" }}
                    >
                        <svg
                            width="28"
                            height="28"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <circle cx="11" cy="11" r="5" />
                            <path d="M16 16l5 5" />
                        </svg>
                    </Link>
                </nav>
            </div>
        </footer>
    );
}
