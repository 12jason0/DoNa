"use client";

import React, { useState } from "react";
import { UserBadgeItem, UserRewardRow, UserCheckinRow } from "@/types/user";

interface ActivityTabProps {
    badges: UserBadgeItem[];
    rewards: UserRewardRow[];
    checkins: UserCheckinRow[];
    onSelectBadge: (badge: UserBadgeItem) => void;
}

const ActivityTab = ({ badges, rewards, checkins, onSelectBadge }: ActivityTabProps) => {
    const [subTab, setSubTab] = useState<"badges" | "rewards" | "checkins">("badges");
    const [currentMonth, setCurrentMonth] = useState<Date>(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1);
    });

    const subTabs = [
        { id: "badges" as const, label: "뱃지", count: badges.length },
        { id: "rewards" as const, label: "보상 내역", count: rewards.length },
        { id: "checkins" as const, label: "출석 기록", count: checkins.length },
    ];

    // 달력 관련 로직
    const getDateKeyKST = (date: Date): string => {
        const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
        const ms = date.getTime() + KST_OFFSET_MS;
        const k = new Date(ms);
        const y = k.getUTCFullYear();
        const m = String(k.getUTCMonth() + 1).padStart(2, "0");
        const d = String(k.getUTCDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    };

    const monthLabel = (d: Date) => `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, "0")}`;

    const goPrevMonth = () => {
        setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };
    const goNextMonth = () => {
        setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    return (
        <div className="space-y-6">
            {/* 서브 탭 네비게이션 */}
            <div className="bg-white rounded-xl border border-gray-100 p-4 overflow-x-auto no-scrollbar">
                <div className="flex space-x-2 min-w-max">
                    {subTabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setSubTab(tab.id)}
                            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                                subTab === tab.id
                                    ? "bg-slate-900 text-white"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                        >
                            {tab.label} ({tab.count})
                        </button>
                    ))}
                </div>
            </div>

            {/* 뱃지 탭 */}
            {subTab === "badges" && (
                <div className="bg-white rounded-xl border border-gray-100 p-6 md:p-8">
                    <div className="flex items-center justify-between mb-4 md:mb-6">
                        <h3 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">내 뱃지</h3>
                    </div>
                    {badges.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-6">
                            {badges.map((b) => (
                                <div
                                    key={b.id}
                                    className="border border-gray-200 rounded-lg p-4 flex flex-col items-center text-center bg-white hover:border-gray-300 transition-colors cursor-pointer"
                                    onClick={() => onSelectBadge(b)}
                                >
                                    {b.image_url ? (
                                        <div className="w-20 h-20 mb-3 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
                                            <img
                                                src={b.image_url}
                                                alt={b.name}
                                                className="w-full h-full object-contain"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = "none";
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-20 h-20 mb-3 rounded-full bg-yellow-100 flex items-center justify-center text-3xl">
                                            🏅
                                        </div>
                                    )}
                                    <div className="text-sm font-semibold text-gray-900 mb-1">{b.name}</div>
                                    {b.description && (
                                        <div className="text-xs text-gray-600 line-clamp-2 mb-1">{b.description}</div>
                                    )}
                                    <div className="text-[11px] text-gray-400">
                                        {new Date(b.awarded_at).toLocaleDateString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10">
                            <div className="text-6xl mb-3">🏅</div>
                            <div className="text-lg font-semibold text-gray-900 mb-1">아직 획득한 뱃지가 없어요</div>
                            <div className="text-gray-600">스토리를 완료하고 배지를 모아보세요!</div>
                        </div>
                    )}
                </div>
            )}

            {/* 보상 내역 탭 */}
            {subTab === "rewards" && (
                <div className="bg-white rounded-xl border border-gray-100 p-6 md:p-8">
                    <div className="flex items-center justify-between mb-4 md:mb-6">
                        <h3 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">보상 지급 내역</h3>
                    </div>
                    {rewards.length > 0 ? (
                        <div className="divide-y">
                            {rewards.map((r) => (
                                <div key={r.id} className="py-3 flex items-center justify-between">
                                    <div className="text-gray-800">
                                        <div className="font-semibold">
                                            {(() => {
                                                const type = String(r.type || "").toLowerCase();
                                                if (type === "checkin") return "7일 연속 출석 완료";
                                                if (type === "escape_place_clear") return "미션 장소 클리어 보상";
                                                if (type === "signup") return "회원가입 보상";
                                                if (type === "ad_watch") return "광고 시청 보상";
                                                if (type === "purchase") return "구매 보상";
                                                if (type === "event") return "이벤트 보상";
                                                return r.type;
                                            })()}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {new Date(r.createdAt).toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        {(() => {
                                            const unit = String(r.unit || "").toLowerCase();
                                            const unitKo =
                                                unit === "coupon"
                                                    ? "쿠폰"
                                                    : unit === "coin"
                                                    ? "코인"
                                                    : unit === "water"
                                                    ? "물"
                                                    : r.unit;
                                            return (
                                                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-sm md:text-base border border-emerald-200">
                                                    <span className="leading-none">+{r.amount}</span>
                                                    <span className="leading-none">
                                                        {unit === "coupon" ? "coupon" : unitKo}
                                                    </span>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-gray-600 py-10">보상 내역이 없습니다.</div>
                    )}
                </div>
            )}

            {/* 출석 기록 탭 */}
            {subTab === "checkins" && (
                <div className="bg-white rounded-xl border border-gray-100 p-6 md:p-8">
                    <div className="flex items-center justify-between mb-4 md:mb-6">
                        <h3 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">출석 기록</h3>
                    </div>
                    <div className="mb-4 flex items-center justify-between">
                        <button
                            onClick={goPrevMonth}
                            className="px-3 py-1.5 rounded-lg border text-gray-400 cursor-pointer"
                        >
                            ← 이전
                        </button>
                        <div className="font-semibold text-gray-900">{monthLabel(currentMonth)}</div>
                        <button
                            onClick={goNextMonth}
                            className="px-3 py-1.5 rounded-lg border text-gray-400 cursor-pointer"
                        >
                            다음 →
                        </button>
                    </div>

                    <div className="grid grid-cols-7 gap-2 text-center text-xs md:text-sm text-gray-600 mb-2">
                        {["일", "월", "화", "수", "목", "금", "토"].map((w) => (
                            <div key={w} className="py-1 font-medium">
                                {w}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                        {(() => {
                            const year = currentMonth.getFullYear();
                            const month = currentMonth.getMonth();
                            const firstDay = new Date(year, month, 1);
                            const firstDow = firstDay.getDay();
                            const daysInMonth = new Date(year, month + 1, 0).getDate();

                            const checkinDaySet = new Set<string>(
                                checkins.map((c) => {
                                    const d = new Date(c.date);
                                    return getDateKeyKST(d);
                                })
                            );
                            const targetMonthKeyPrefix = `${year}-${String(month + 1).padStart(2, "0")}-`;

                            const days = [];
                            for (let i = 0; i < firstDow; i++) {
                                days.push({ day: null, key: null, stamped: false });
                            }
                            for (let d = 1; d <= daysInMonth; d++) {
                                const key = `${targetMonthKeyPrefix}${String(d).padStart(2, "0")}`;
                                const stamped = checkinDaySet.has(key);
                                days.push({ day: d, key, stamped });
                            }

                            return days.map((cell, idx) => {
                                if (cell.day === null) return <div key={`pad-${idx}`} className="h-10 md:h-12" />;
                                const isToday =
                                    getDateKeyKST(new Date()) ===
                                    `${targetMonthKeyPrefix}${String(cell.day).padStart(2, "0")}`;
                                return (
                                    <div
                                        key={cell.key || idx}
                                        className={`h-10 md:h-12 rounded-lg flex items-center justify-center ${
                                            cell.stamped
                                                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                                : "bg-white border-gray-200 text-gray-700"
                                        } ${isToday ? "ring-2 ring-blue-400" : ""}`}
                                        title={cell.key || ""}
                                    >
                                        {cell.stamped ? (
                                            <span className="text-base md:text-lg">🌱</span>
                                        ) : (
                                            <span className="opacity-70">{cell.day}</span>
                                        )}
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ActivityTab;
