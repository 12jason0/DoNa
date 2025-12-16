"use client";

import React from "react";
import Image from "@/components/ImageFallback";
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
    return (
        <div className="space-y-6">
            {/* 기본 정보 카드 */}
            <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
                <div className="flex items-center justify-between mb-4 md:mb-6">
                    <h3 className="text-xl md:text-2xl font-bold text-gray-900">기본 정보</h3>
                    <button
                        onClick={onEditProfile}
                        className="px-3 md:px-4 py-2 text-blue-600 hover:text-blue-800 text-sm font-semibold cursor-pointer border border-blue-200 rounded-lg"
                    >
                        수정
                    </button>
                </div>
                {userInfo ? (
                    <div className="flex items-center space-x-4 md:space-x-6">
                        <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden bg-gray-100">
                            <Image
                                src={
                                    userInfo.profileImage ||
                                    "https://stylemap-seoul.s3.ap-northeast-2.amazonaws.com/profileLogo.png"
                                }
                                alt={userInfo.name || "프로필"}
                                fill
                                className="object-cover"
                                priority={false}
                            />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-lg md:text-xl font-bold text-gray-900 mb-1 md:mb-2">{userInfo.name}</h4>
                            <p className="text-gray-600 mb-1 text-sm md:text-base">{userInfo.email}</p>
                            <div className="flex items-center space-x-3 md:space-x-4 text-xs md:text-sm text-gray-500">
                                <span>가입일: {userInfo.joinDate}</span>
                            </div>
                            <div className="flex items-center space-x-3 md:space-x-4 text-xs md:text-sm text-gray-500">
                                {userInfo.age && <span>나이: {userInfo.age}세</span>}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <div className="text-5xl md:text-6xl mb-3 md:mb-4">👤</div>
                        <h4 className="text-base md:text-lg font-semibold text-gray-900 mb-2">
                            프로필 정보를 불러오는 중...
                        </h4>
                    </div>
                )}
            </div>

            {/* 선호도/MBTI 카드 */}
            <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
                <div className="flex items-center justify-between mb-4 md:mb-6">
                    <h3 className="text-xl md:text-2xl font-bold text-gray-900">선호도</h3>
                    <button
                        onClick={onEditPreferences}
                        className="px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
                    >
                        수정하기
                    </button>
                </div>
                {userInfo?.mbti && (
                    <div className="mb-4">
                        <span className="px-2.5 md:px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs md:text-sm font-semibold">
                            MBTI: {userInfo.mbti}
                        </span>
                    </div>
                )}
                {userPreferences ? (
                    <div className="grid grid-cols-2 gap-4 md:gap-6">
                        {userPreferences.companion && (
                            <div>
                                <h4 className="text-base md:text-lg font-semibold text-gray-900 mb-2 md:mb-3">
                                    여행 동반자
                                </h4>
                                <span className="px-2.5 md:px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs md:text-sm">
                                    {userPreferences.companion}
                                </span>
                            </div>
                        )}
                        {userPreferences.concept && userPreferences.concept.length > 0 && (
                            <div>
                                <h4 className="text-base md:text-lg font-semibold text-gray-900 mb-2 md:mb-3">
                                    선호 콘셉트
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {userPreferences.concept.map((c, idx) => (
                                        <span
                                            key={idx}
                                            className="px-2.5 md:px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs md:text-sm"
                                        >
                                            {c}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {userPreferences.mood && userPreferences.mood.length > 0 && (
                            <div>
                                <h4 className="text-base md:text-lg font-semibold text-gray-900 mb-2 md:mb-3">
                                    선호 분위기
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {userPreferences.mood.map((m, idx) => (
                                        <span
                                            key={idx}
                                            className="px-2.5 md:px-3 py-1 bg-pink-100 text-pink-700 rounded-full text-xs md:text-sm"
                                        >
                                            {m}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {userPreferences.regions && userPreferences.regions.length > 0 && (
                            <div>
                                <h4 className="text-base md:text-lg font-semibold text-gray-900 mb-2 md:mb-3">
                                    선호 지역
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {userPreferences.regions.map((r, idx) => (
                                        <span
                                            key={idx}
                                            className="px-2.5 md:px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs md:text-sm"
                                        >
                                            {r}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <div className="text-6xl mb-4">🎯</div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-2">선호도가 설정되지 않았어요</h4>
                        <p className="text-gray-600 mb-4">선호도를 설정하면 더 정확한 추천을 받을 수 있어요</p>
                        <button
                            onClick={onEditPreferences}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors cursor-pointer"
                        >
                            선호도 설정하기
                        </button>
                    </div>
                )}
            </div>

            {/* 계정 관리 카드 */}
            <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
                <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-4 md:mb-6">계정 관리</h3>
                <div className="space-y-4">
                    <button
                        onClick={onOpenPwModal}
                        className="w-full text-left px-3 md:px-4 py-2.5 md:py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer text-sm md:text-base"
                    >
                        <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900">비밀번호 변경</span>
                            <span className="text-gray-400">→</span>
                        </div>
                    </button>
                    <button className="w-full text-left px-3 md:px-4 py-2.5 md:py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer text-sm md:text-base">
                        <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900">알림 설정</span>
                            <span className="text-gray-400">→</span>
                        </div>
                    </button>
                    <button
                        onClick={onLogout}
                        className="w-full text-left px-3 md:px-4 py-2.5 md:py-3 rounded-lg border border-red-200 hover:bg-red-50 transition-colors cursor-pointer text-sm md:text-base"
                    >
                        <div className="flex items-center justify-between">
                            <span className="font-medium text-red-600">로그아웃</span>
                            <span className="text-red-400">→</span>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProfileTab;
