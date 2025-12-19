"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { UserInfo, UserPreferences } from "@/types/user";

interface ProfileTabProps {
    userInfo: UserInfo | null;
    userPreferences: UserPreferences | null;
    onEditProfile: () => void;
    onEditPreferences: () => void;
    onOpenPwModal: () => void;
    onLogout: () => void;
}

const ProfileTab = ({
    userInfo,
    userPreferences,
    onEditProfile,
    onEditPreferences,
    onOpenPwModal,
    onLogout,
}: ProfileTabProps) => {
    // 기본 프로필 이미지
    const DEFAULT_PROFILE_IMG = "https://stylemap-seoul.s3.ap-northeast-2.amazonaws.com/profileLogo.png";

    // 1. 초기값을 null로 변경 (데이터를 불러오기 전 상태)
    const [notificationEnabled, setNotificationEnabled] = useState<boolean | null>(null);
    const [notificationStatus, setNotificationStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [notificationMessage, setNotificationMessage] = useState<string>("");

    // 알림 상태 초기 로드 (DB에서 가져오기)
    useEffect(() => {
        const fetchNotificationStatus = async () => {
            try {
                const token = localStorage.getItem("authToken");
                if (!token) return;

                // userId 가져오기
                let userId: number | null = null;
                try {
                    const userStr = localStorage.getItem("user");
                    if (userStr) {
                        const userData = JSON.parse(userStr);
                        userId = userData?.id || null;
                    }
                } catch (e) {
                    console.error("localStorage user 파싱 오류:", e);
                }

                // props에서 userId 가져오기 시도
                if (!userId) {
                    userId = (userInfo as any)?.id || (userInfo as any)?.user?.id || null;
                }

                // API로 userId 가져오기
                if (!userId) {
                    const userResponse = await fetch("/api/users/profile", {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    if (userResponse.ok) {
                        const userData = await userResponse.json();
                        userId = userData?.user?.id || userData?.id || null;
                    }
                }

                // DB에서 알림 상태 조회 (push_tokens 테이블)
                if (userId) {
                    const statusResponse = await fetch(`/api/push?userId=${userId}`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    if (statusResponse.ok) {
                        const statusData = await statusResponse.json();
                        // 2. 데이터가 로드되면 true/false 설정
                        setNotificationEnabled(statusData.subscribed ?? false);
                    }
                }
            } catch (error) {
                console.error("알림 상태 조회 오류:", error);
                // 에러 발생 시 기본값 false로 설정하여 로딩 상태 해제
                setNotificationEnabled(false);
            }
        };

        fetchNotificationStatus();
    }, [userInfo]);

    // 알림 토글 핸들러 (DB와 연결)
    const handleNotificationToggle = async () => {
        if (notificationEnabled === null) return; // 로딩 중 클릭 방지

        // Optimistic update: 즉시 UI 업데이트
        const newSubscribedState = !notificationEnabled;
        setNotificationEnabled(newSubscribedState);
        setNotificationStatus("loading");
        setNotificationMessage("");

        // Footer 등 다른 컴포넌트에 알림 상태 변경 전파
        if (typeof window !== "undefined") {
            window.dispatchEvent(
                new CustomEvent("notificationUpdated", { detail: { subscribed: newSubscribedState } })
            );
        }

        try {
            // 1. 앱에서 저장한 pushToken 가져오기 (localStorage)
            let expoPushToken = localStorage.getItem("expoPushToken");

            // 1-1. localStorage에 없으면 앱에 요청
            if (!expoPushToken && (window as any).ReactNativeWebView) {
                (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: "requestPushToken" }));
                await new Promise((resolve) => setTimeout(resolve, 2000));
                expoPushToken = localStorage.getItem("expoPushToken");
            }

            // 2. 로그인 토큰 확인
            const token = localStorage.getItem("authToken");
            if (!token) {
                setNotificationStatus("error");
                setNotificationMessage("로그인이 필요합니다.");
                return;
            }

            // 3. userId 가져오기
            let userId: number | null = null;
            try {
                const userStr = localStorage.getItem("user");
                if (userStr) {
                    const userData = JSON.parse(userStr);
                    userId = userData?.id || null;
                }
            } catch (e) {
                console.error("localStorage user 파싱 오류:", e);
            }

            // props에서 userId 가져오기 시도
            if (!userId) {
                userId = (userInfo as any)?.id || (userInfo as any)?.user?.id || null;
            }

            // API로 userId 가져오기
            if (!userId) {
                const userResponse = await fetch("/api/users/profile", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!userResponse.ok) {
                    throw new Error("사용자 정보를 가져올 수 없습니다.");
                }
                const userData = await userResponse.json();
                userId = userData?.user?.id || userData?.id || null;
            }

            if (!userId) {
                throw new Error("사용자 ID를 찾을 수 없습니다.");
            }

            // 4. PushToken 서버에 업데이트 (subscribed 상태 토글)
            const pushResponse = await fetch("/api/push", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    userId: userId,
                    pushToken: expoPushToken || "", // 없으면 빈 문자열 (DB에 이미 있을 수 있음)
                    platform: "expo",
                    subscribed: newSubscribedState, // 토글된 상태
                }),
            });

            // const pushData = await pushResponse.json(); // 사용하지 않는 변수라면 주석 처리 혹은 제거

            if (pushResponse.ok) {
                setNotificationStatus("success");
                setNotificationMessage(
                    newSubscribedState ? "✅ 알림이 활성화되었습니다!" : "🔕 알림이 비활성화되었습니다."
                );
                // 2초 후 메시지 제거
                setTimeout(() => {
                    setNotificationMessage("");
                    setNotificationStatus("idle");
                }, 2000);
            } else {
                // 실패 시 원래 상태로 되돌리기
                setNotificationEnabled(!newSubscribedState);
                if (typeof window !== "undefined") {
                    window.dispatchEvent(
                        new CustomEvent("notificationUpdated", { detail: { subscribed: !newSubscribedState } })
                    );
                }
            }
        } catch (error: any) {
            console.error("알림 토글 오류:", error);
            // 실패 시 원래 상태로 되돌리기
            setNotificationEnabled(!newSubscribedState);
            if (typeof window !== "undefined") {
                window.dispatchEvent(
                    new CustomEvent("notificationUpdated", { detail: { subscribed: !newSubscribedState } })
                );
            }
            setNotificationStatus("error");
            setNotificationMessage(error.message || "알림 설정 변경 중 오류가 발생했습니다.");
            // 3초 후 에러 메시지 제거
            setTimeout(() => {
                setNotificationMessage("");
                setNotificationStatus("idle");
            }, 3000);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-10">
            {/* ======================================================================
          1. 기본 정보 카드 (Profile Card)
      ====================================================================== */}
            <div className="bg-white rounded-xl border border-gray-100 p-6 md:p-8 relative overflow-hidden group">
                {/* 배경 장식 (은은한 그라데이션) */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-50 pointer-events-none"></div>

                <div className="flex items-center justify-between mb-6 relative z-10">
                    <h3 className="text-xl md:text-2xl font-extrabold text-gray-900 flex items-center gap-2 tracking-tight">
                        내 정보
                    </h3>
                    <button
                        onClick={onEditProfile}
                        className="px-4 py-2 text-sm font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-all flex items-center gap-1.5 tracking-tight"
                    >
                        <span>수정</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            ></path>
                        </svg>
                    </button>
                </div>

                {userInfo ? (
                    <div className="flex items-center gap-5 md:gap-7 relative z-10">
                        {/* 프로필 이미지 (테두리에 브랜드 컬러 포인트) */}
                        <div className="relative w-[88px] h-[88px] md:w-[100px] md:h-[100px] rounded-full p-1 bg-gradient-to-br from-emerald-100 to-white shadow-sm flex-shrink-0">
                            <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-white bg-gray-50">
                                <Image
                                    src={userInfo.profileImage || DEFAULT_PROFILE_IMG}
                                    alt={userInfo.name || "프로필"}
                                    fill
                                    className="object-cover"
                                    priority
                                />
                            </div>
                        </div>

                        {/* 텍스트 정보 */}
                        <div className="flex-1 min-w-0">
                            <h5 className="text-2xl font-black text-gray-900 mb-1 truncate tracking-tight">
                                {userInfo.name}
                            </h5>
                            <p className="text-gray-500 text-sm md:text-base mb-4 truncate font-medium">
                                {userInfo.email}
                            </p>

                            <div className="flex flex-wrap gap-2 text-xs md:text-sm font-semibold">
                                {userInfo.age && (
                                    <span className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg">
                                        {userInfo.age}세
                                    </span>
                                )}
                                {userInfo.mbti && (
                                    <span className="bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg border border-amber-100/50">
                                        {userInfo.mbti}
                                    </span>
                                )}
                                <span className="bg-gray-5 text-gray-400 px-3 py-1.5 rounded-lg">
                                    가입일 {userInfo.joinDate}
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* 로딩 스켈레톤 */
                    <div className="flex items-center gap-6 animate-pulse">
                        <div className="w-24 h-24 bg-gray-100 rounded-full"></div>
                        <div className="flex-1 space-y-3">
                            <div className="h-8 bg-gray-100 rounded-lg w-1/3"></div>
                            <div className="h-5 bg-gray-100 rounded-lg w-1/2"></div>
                        </div>
                    </div>
                )}
            </div>

            {/* ======================================================================
          2. 취향 정보 카드 (Preferences)
      ====================================================================== */}
            <div className="bg-white rounded-xl border border-gray-100 p-6 md:p-8">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl md:text-2xl font-extrabold text-gray-900 flex items-center gap-2 tracking-tight">
                        나의 여행 취향
                    </h3>
                    <button
                        onClick={onEditPreferences}
                        className="px-5 py-2.5 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-all tracking-tight"
                    >
                        취향 수정하기
                    </button>
                </div>

                {userPreferences ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        {/* 동반자 */}
                        {userPreferences.companion && (
                            <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 hover:border-emerald-100 transition-colors group">
                                <h4 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider group-hover:text-emerald-600 transition-colors">
                                    누구와 함께?
                                </h4>
                                <span className="inline-block px-3.5 py-1.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg text-sm shadow-sm">
                                    {userPreferences.companion}
                                </span>
                            </div>
                        )}

                        {/* 선호 콘셉트 */}
                        {userPreferences.concept && userPreferences.concept.length > 0 && (
                            <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 hover:border-emerald-100 transition-colors group">
                                <h4 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider group-hover:text-emerald-600 transition-colors">
                                    선호 콘셉트
                                </h4>
                                <div
                                    className="flex flex-nowrap gap-2 overflow-x-auto scrollbar-hide"
                                    style={{ maxWidth: "calc(6 * (80px + 8px))" }}
                                >
                                    {userPreferences.concept.map((item, idx) => (
                                        <span
                                            key={idx}
                                            className="px-3.5 py-1.5 bg-emerald-100 text-emerald-700 font-bold rounded-lg text-sm whitespace-nowrap flex-shrink-0"
                                        >
                                            #{item}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 선호 분위기 */}
                        {userPreferences.mood && userPreferences.mood.length > 0 && (
                            <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 hover:border-emerald-100 transition-colors group">
                                <h4 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider group-hover:text-emerald-600 transition-colors">
                                    선호 분위기
                                </h4>
                                <div
                                    className="flex flex-nowrap gap-2 overflow-x-auto scrollbar-hide"
                                    style={{ maxWidth: "calc(6 * (80px + 8px))" }}
                                >
                                    {userPreferences.mood.map((item, idx) => (
                                        <span
                                            key={idx}
                                            className="px-3.5 py-1.5 bg-orange-100 text-orange-700 font-bold rounded-lg text-sm whitespace-nowrap flex-shrink-0"
                                        >
                                            #{item}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 선호 지역 */}
                        {userPreferences.regions && userPreferences.regions.length > 0 && (
                            <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 hover:border-emerald-100 transition-colors group">
                                <h4 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider group-hover:text-emerald-600 transition-colors">
                                    관심 지역
                                </h4>
                                <div
                                    className="flex flex-nowrap gap-2 overflow-x-auto scrollbar-hide"
                                    style={{ maxWidth: "calc(6 * (80px + 8px))" }}
                                >
                                    {userPreferences.regions.map((item, idx) => (
                                        <span
                                            key={idx}
                                            className="px-3.5 py-1.5 bg-blue-100 text-blue-700 font-bold rounded-lg text-sm whitespace-nowrap flex-shrink-0"
                                        >
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                        <p className="text-gray-500 font-medium mb-4">아직 등록된 취향 정보가 없어요 😢</p>
                        <button
                            onClick={onEditPreferences}
                            className="text-emerald-600 font-bold hover:underline hover:text-emerald-700 transition-colors"
                        >
                            지금 바로 설정하러 가기 &rarr;
                        </button>
                    </div>
                )}
            </div>

            {/* ======================================================================
          3. 계정 관리 카드 (Account Settings)
      ====================================================================== */}
            <div className="bg-white rounded-xl border border-gray-100 p-6 md:p-8">
                <h3 className="text-xl md:text-2xl font-extrabold text-gray-900 mb-6 flex items-center gap-2 tracking-tight">
                    계정 관리
                </h3>

                <div className="flex flex-col space-y-3">
                    {/* 비밀번호 변경 버튼 */}
                    <button
                        onClick={onOpenPwModal}
                        className="w-full flex items-center justify-between px-6 py-4.5 rounded-xl bg-white border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 bg-gray-100 rounded-lg text-gray-600 group-hover:bg-white group-hover:text-emerald-600 transition-colors">
                                🔒
                            </div>
                            <span className="font-bold text-gray-700 group-hover:text-gray-900">비밀번호 변경</span>
                        </div>
                        <span className="text-gray-300 group-hover:text-emerald-400 group-hover:translate-x-1 transition-transform">
                            →
                        </span>
                    </button>

                    {/* 알림 설정 토글 버튼 영역 */}
                    <div>
                        <div className="w-full flex items-center justify-between px-6 py-4.5 rounded-xl bg-white border border-gray-100">
                            <div className="flex items-center gap-4">
                                {/* 1. 아이콘 상자 */}
                                <div className="relative">
                                    <div
                                        className={`p-2.5 rounded-lg transition-all duration-300 ${
                                            notificationEnabled === true
                                                ? "bg-emerald-100 text-emerald-600"
                                                : "bg-gray-100 text-gray-400"
                                        }`}
                                    >
                                        {notificationEnabled === true ? "🔔" : "🔕"}
                                    </div>

                                    {/* 🔴 빨간 점 (알림이 꺼져 있을 때 왼쪽 위에 표시) - 로딩 중 아닐 때만 */}
                                    {notificationEnabled === false && (
                                        <span className="absolute -top-1 -left-1 flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span>
                                        </span>
                                    )}
                                </div>

                                <div className="flex flex-col items-start">
                                    <span
                                        className={`font-bold transition-colors duration-300 ${
                                            notificationEnabled === true ? "text-gray-800" : "text-gray-400"
                                        }`}
                                    >
                                        알림 설정
                                    </span>
                                    <span
                                        className={`text-xs font-medium transition-colors duration-300 ${
                                            notificationEnabled === true ? "text-emerald-600" : "text-gray-400"
                                        }`}
                                    >
                                        {notificationEnabled === null
                                            ? "설정 불러오는 중..."
                                            : notificationStatus === "loading"
                                            ? "처리 중..."
                                            : notificationEnabled === true
                                            ? "푸시 알림을 받는 중"
                                            : "알림이 꺼져 있어요"}
                                    </span>
                                </div>
                            </div>

                            {/* 2. 토글 스위치 */}
                            {notificationEnabled === null ? (
                                /* 로딩 시 스켈레톤 토글 */
                                <div className="h-7 w-12 rounded-full bg-gray-200 animate-pulse"></div>
                            ) : (
                                <button
                                    onClick={handleNotificationToggle}
                                    disabled={notificationStatus === "loading"}
                                    className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                                        notificationEnabled ? "bg-emerald-500" : "bg-gray-200"
                                    }`}
                                    role="switch"
                                    aria-checked={notificationEnabled}
                                    aria-label="알림 설정"
                                >
                                    <span
                                        className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-md ring-0 transition-all duration-300 ease-in-out flex items-center justify-center ${
                                            notificationEnabled ? "translate-x-5" : "translate-x-0"
                                        }`}
                                    >
                                        {notificationStatus === "loading" && (
                                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-emerald-500" />
                                        )}
                                    </span>
                                </button>
                            )}
                        </div>

                        {/* 메시지 알림 */}
                        {notificationMessage && (
                            <div
                                className={`mt-3 px-4 py-2.5 rounded-lg text-sm font-medium animate-in fade-in slide-in-from-top-2 ${
                                    notificationStatus === "success"
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                        : notificationStatus === "error"
                                        ? "bg-red-50 text-red-700 border border-red-200"
                                        : "bg-gray-50 text-gray-600"
                                }`}
                            >
                                {notificationMessage}
                            </div>
                        )}
                    </div>
                    <div className="h-px bg-gray-100 my-2"></div>

                    {/* ✅ [최종 수정] 설명 없이 깔끔한 '한 줄' 스타일 */}
                    <button
                        onClick={() => window.open("https://pf.kakao.com/_xxxx/chat", "_blank")}
                        className="w-full flex items-center justify-between px-6 py-5 bg-white rounded-xl border border-gray-100 hover:border-[#FEE500] hover:bg-yellow-50/10 transition-all duration-200 group"
                    >
                        <div className="flex items-center gap-4">
                            {/* 1. 아이콘: 옐로우 포인트로 시선 집중 */}
                            <div className="w-10 h-10 rounded-lg bg-[#FEE500] flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                {/* 확성기 아이콘 */}
                                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[#3b1e1e]">
                                    <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z" />
                                </svg>
                            </div>

                            {/* 2. 텍스트: 딱 한 줄로 끝내기 */}
                            <span className="flex flex-col font-bold text-gray-800 text-[16px] group-hover:text-gray-900">
                                히든 맛집 제보하고 <span className="text-yellow-600">커피 받기 ☕️</span>
                            </span>
                        </div>

                        {/* 3. 화살표 */}
                        <span className="text-gray-300 group-hover:text-[#FEE500] group-hover:translate-x-1 transition-transform">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={2.5}
                                stroke="currentColor"
                                className="w-5 h-5"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                        </span>
                    </button>
                    <div className="h-px bg-gray-100 my-2"></div>

                    {/* 로그아웃 버튼 */}
                    <button
                        onClick={onLogout}
                        className="w-full flex items-center justify-between px-6 py-4.5 rounded-xl bg-red-50/50 border border-transparent hover:border-red-100 hover:bg-red-50 transition-all group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 bg-white rounded-xl text-red-400 group-hover:text-red-500 shadow-sm">
                                🚪
                            </div>
                            <span className="font-bold text-red-500 group-hover:text-red-600">로그아웃</span>
                        </div>
                        <span className="text-red-200 group-hover:text-red-400 group-hover:translate-x-1 transition-transform">
                            →
                        </span>
                    </button>
                </div>

                {/* 사업자 정보 */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">사업자 정보</h4>
                    <div className="text-xs text-gray-500 space-y-1 leading-relaxed">
                        <p className="font-semibold text-gray-600">(주)두나 (DoNa)</p>
                        <p>대표: 오승용 | 사업자등록번호: 166-10-03081</p>
                        <p>통신판매업 신고번호: 제 2025-충남홍성-0193 호</p>
                        <p>주소: 충청남도 홍성군 홍북읍 신대로 33</p>
                        <p>고객센터: 12jason@donacouse.com</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileTab;
