"use client";

import React, { useState } from "react";
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
    const [notificationStatus, setNotificationStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [notificationMessage, setNotificationMessage] = useState<string>("");

    // 알림 허용 버튼 클릭 핸들러 (최적화 버전)
    const handleNotificationPermission = async () => {
        try {
            setNotificationStatus("loading");
            setNotificationMessage("");

            // 1. 앱에서 저장한 pushToken 가져오기 (localStorage)
            const expoPushToken = localStorage.getItem("expoPushToken");
            if (!expoPushToken) {
                setNotificationStatus("error");
                setNotificationMessage("앱에서 알림 권한을 허용해주세요. 앱을 재시작해주세요.");
                return;
            }

            // 2. 로그인 토큰 확인
            const token = localStorage.getItem("authToken");
            if (!token) {
                setNotificationStatus("error");
                setNotificationMessage("로그인이 필요합니다.");
                return;
            }

            // 3. userId 가져오기 (최적화: props 활용)
            // userInfo 타입 정의에 id가 없더라도 실제 데이터엔 있을 수 있으므로 any로 우회하여 접근
            let userId = (userInfo as any)?.id || (userInfo as any)?.user?.id;

            // 만약 props에 정보가 없다면, 비상용으로 API 호출 (기존 로직 수행)
            if (!userId) {
                const userResponse = await fetch("/api/users/profile", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!userResponse.ok) {
                    throw new Error("사용자 정보를 가져올 수 없습니다.");
                }
                const userData = await userResponse.json();
                userId = userData?.user?.id || userData?.id;
            }

            if (!userId) {
                throw new Error("사용자 ID를 찾을 수 없습니다.");
            }

            // 4. PushToken 서버에 등록 (subscribed: true)
            const pushResponse = await fetch("/api/push", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    userId: userId,
                    pushToken: expoPushToken,
                    platform: "expo",
                    subscribed: true, // 알림 허용
                }),
            });

            const pushData = await pushResponse.json();

            if (pushResponse.ok) {
                setNotificationStatus("success");
                setNotificationMessage("✅ 알림이 활성화되었습니다!");
            } else {
                throw new Error(pushData.error || "알림 등록에 실패했습니다.");
            }
        } catch (error: any) {
            console.error("알림 등록 오류:", error);
            setNotificationStatus("error");
            setNotificationMessage(error.message || "알림 등록 중 오류가 발생했습니다.");
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-10">
            {/* ======================================================================
          1. 기본 정보 카드 (Profile Card)
      ====================================================================== */}
            <div className="bg-white rounded-[32px] shadow-lg shadow-gray-100/50 border border-gray-100 p-6 md:p-8 relative overflow-hidden group">
                {/* 배경 장식 (은은한 그라데이션) */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-50 pointer-events-none"></div>

                <div className="flex items-center justify-between mb-6 relative z-10">
                    <h3 className="text-xl md:text-2xl font-extrabold text-gray-900 flex items-center gap-2 tracking-tight">
                        내 정보
                    </h3>
                    <button
                        onClick={onEditProfile}
                        className="px-4 py-2 text-sm font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-all flex items-center gap-1.5"
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
                            <h4 className="text-2xl md:text-3xl font-black text-gray-900 mb-1 truncate tracking-tight">
                                {userInfo.name}
                            </h4>
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
                                <span className="bg-gray-50 text-gray-400 px-3 py-1.5 rounded-lg">
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
            <div className="bg-white rounded-[32px] shadow-lg shadow-gray-100/50 border border-gray-100 p-6 md:p-8">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl md:text-2xl font-extrabold text-gray-900 flex items-center gap-2 tracking-tight">
                        나의 여행 취향
                    </h3>
                    <button
                        onClick={onEditPreferences}
                        className="px-5 py-2.5 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded-xl transition-all shadow-md hover:shadow-lg transform active:scale-95"
                    >
                        취향 수정하기
                    </button>
                </div>

                {userPreferences ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        {/* 동반자 */}
                        {userPreferences.companion && (
                            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 hover:border-emerald-100 transition-colors group">
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
                            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 hover:border-emerald-100 transition-colors group">
                                <h4 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider group-hover:text-emerald-600 transition-colors">
                                    선호 콘셉트
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {userPreferences.concept.map((item, idx) => (
                                        <span
                                            key={idx}
                                            className="px-3.5 py-1.5 bg-emerald-100 text-emerald-700 font-bold rounded-lg text-sm"
                                        >
                                            #{item}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 선호 분위기 */}
                        {userPreferences.mood && userPreferences.mood.length > 0 && (
                            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 hover:border-emerald-100 transition-colors group">
                                <h4 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider group-hover:text-emerald-600 transition-colors">
                                    선호 분위기
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {userPreferences.mood.map((item, idx) => (
                                        <span
                                            key={idx}
                                            className="px-3.5 py-1.5 bg-orange-100 text-orange-700 font-bold rounded-lg text-sm"
                                        >
                                            #{item}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 선호 지역 */}
                        {userPreferences.regions && userPreferences.regions.length > 0 && (
                            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 hover:border-emerald-100 transition-colors group">
                                <h4 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider group-hover:text-emerald-600 transition-colors">
                                    관심 지역
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {userPreferences.regions.map((item, idx) => (
                                        <span
                                            key={idx}
                                            className="px-3.5 py-1.5 bg-blue-100 text-blue-700 font-bold rounded-lg text-sm"
                                        >
                                            {item}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
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
            <div className="bg-white rounded-[32px] shadow-lg shadow-gray-100/50 border border-gray-100 p-6 md:p-8">
                <h3 className="text-xl md:text-2xl font-extrabold text-gray-900 mb-6 flex items-center gap-2 tracking-tight">
                    계정 관리
                </h3>

                <div className="flex flex-col space-y-3">
                    {/* 비밀번호 변경 버튼 */}
                    <button
                        onClick={onOpenPwModal}
                        className="w-full flex items-center justify-between px-6 py-4.5 rounded-2xl bg-white border border-gray-100 shadow-sm hover:border-emerald-200 hover:shadow-md hover:bg-emerald-50/30 transition-all group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 bg-gray-100 rounded-xl text-gray-600 group-hover:bg-white group-hover:text-emerald-600 transition-colors">
                                🔒
                            </div>
                            <span className="font-bold text-gray-700 group-hover:text-gray-900">비밀번호 변경</span>
                        </div>
                        <span className="text-gray-300 group-hover:text-emerald-400 group-hover:translate-x-1 transition-transform">
                            →
                        </span>
                    </button>

                    {/* 알림 설정 버튼 */}
                    <div>
                        <button
                            onClick={handleNotificationPermission}
                            disabled={notificationStatus === "loading"}
                            className="w-full flex items-center justify-between px-6 py-4.5 rounded-2xl bg-white border border-gray-100 shadow-sm hover:border-emerald-200 hover:shadow-md hover:bg-emerald-50/30 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 bg-gray-100 rounded-xl text-gray-600 group-hover:bg-white group-hover:text-emerald-600 transition-colors">
                                    🔔
                                </div>
                                <span className="font-bold text-gray-700 group-hover:text-gray-900">
                                    {notificationStatus === "loading" ? "등록 중..." : "알림 허용"}
                                </span>
                            </div>
                            <span className="text-gray-300 group-hover:text-emerald-400 group-hover:translate-x-1 transition-transform">
                                →
                            </span>
                        </button>
                        {notificationMessage && (
                            <p
                                className={`text-sm mt-2 px-2 ${
                                    notificationStatus === "success"
                                        ? "text-emerald-600"
                                        : notificationStatus === "error"
                                        ? "text-red-600"
                                        : "text-gray-500"
                                }`}
                            >
                                {notificationMessage}
                            </p>
                        )}
                    </div>

                    <div className="h-px bg-gray-100 my-2"></div>

                    {/* 로그아웃 버튼 */}
                    <button
                        onClick={onLogout}
                        className="w-full flex items-center justify-between px-6 py-4.5 rounded-2xl bg-red-50/50 border border-transparent hover:border-red-100 hover:bg-red-50 hover:shadow-sm transition-all group"
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
            </div>
        </div>
    );
};

export default ProfileTab;
