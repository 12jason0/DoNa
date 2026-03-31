"use client";

import React, { useState, useEffect, memo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useLocale } from "@/context/LocaleContext";
import HorizontalScrollContainer from "@/components/HorizontalScrollContainer";
import { UserBadgeItem, UserRewardRow } from "@/types/user";

interface PaymentHistory {
    id: string;
    orderName: string;
    amount: number;
    status: string;
    approvedAt: string;
    method?: string | null;
}

interface ActivityTabProps {
    badges: UserBadgeItem[];
    rewards: UserRewardRow[];
    payments?: PaymentHistory[];
    onSelectBadge: (badge: UserBadgeItem) => void;
    initialSubTab?: "badges" | "rewards" | "payments";
}

const ActivityTab = ({ badges, rewards, payments = [], onSelectBadge, initialSubTab = "badges" }: ActivityTabProps) => {
    const { t } = useLocale();
    const [subTab, setSubTab] = useState<"badges" | "rewards" | "payments">(initialSubTab);

    // 🟢 initialSubTab prop이 변경되면 subTab 상태도 업데이트
    useEffect(() => {
        setSubTab(initialSubTab);
    }, [initialSubTab]);

    const subTabs = [
        { id: "badges" as const, label: t("mypage.activityTab.badges"), count: badges.length },
        { id: "rewards" as const, label: t("mypage.activityTab.rewards"), count: rewards.length },
        { id: "payments" as const, label: t("mypage.activityTab.payments"), count: payments.length },
    ];

    return (
        <div className="space-y-6">
            {/* 서브 탭 네비게이션 */}
            <HorizontalScrollContainer scrollMode="drag" className="bg-white dark:bg-[#1a241b] rounded-xl border border-gray-100 dark:border-gray-800 p-4 overflow-x-auto no-scrollbar">
                <div className="flex space-x-2 min-w-max">
                    {subTabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setSubTab(tab.id)}
                            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                                subTab === tab.id
                                    ? "bg-slate-900 dark:bg-blue-700 text-white"
                                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                            }`}
                        >
                            {tab.label}
                            {tab.count !== null ? ` (${tab.count})` : ""}
                        </button>
                    ))}
                </div>
            </HorizontalScrollContainer>

            {/* 뱃지 탭 */}
            {subTab === "badges" && (
                <div className="bg-white dark:bg-[#1a241b] rounded-xl border border-gray-100 dark:border-gray-800 p-6 md:p-8">
                    <div className="flex items-center justify-between mb-4 md:mb-6">
                        <h3 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{t("mypage.activityTab.myBadges")}</h3>
                    </div>
                    {badges.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-6">
                            {badges.map((b) => (
                                <div
                                    key={b.id}
                                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col items-center text-center bg-white dark:bg-gray-800/50 hover:border-gray-300 dark:hover:border-gray-600 transition-colors cursor-pointer"
                                    onClick={() => onSelectBadge(b)}
                                >
                                    {b.image_url ? (
                                        <div className="w-20 h-20 mb-3 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex items-center justify-center">
                                            <Image
                                                src={b.image_url}
                                                alt={b.name}
                                                width={80}
                                                height={80}
                                                className="w-full h-full object-contain"
                                                loading="lazy" // 🟢 성능 최적화: lazy loading 적용
                                                quality={70} // 🟢 성능 최적화: quality 설정
                                                onError={(e) => {
                                                    e.currentTarget.style.display = "none";
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-20 h-20 mb-3 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center text-3xl">
                                            🏅
                                        </div>
                                    )}
                                    <div className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{b.name}</div>
                                    {b.description && (
                                        <div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-1">{b.description}</div>
                                    )}
                                    <div className="text-[11px] text-gray-400 dark:text-gray-500">
                                        {new Date(b.awarded_at).toLocaleDateString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10">
                            <div className="mb-3 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500 dark:text-yellow-400">
                                    <path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"/>
                                    <path d="M11 12 5.12 2.2"/>
                                    <path d="m13 12 5.88-9.8"/>
                                    <path d="M8 7h8"/>
                                    <circle cx="12" cy="17" r="5"/>
                                    <path d="M12 18v-2h-.5"/>
                                </svg>
                            </div>
                            <div className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{t("mypage.activityTab.noBadgesYet")}</div>
                            <div className="text-gray-600 dark:text-gray-400">{t("mypage.activityTab.collectBadgesHint")}</div>
                        </div>
                    )}
                </div>
            )}

            {/* 보상 내역 탭 */}
            {subTab === "rewards" && (
                <div className="bg-white dark:bg-[#1a241b] rounded-xl border border-gray-100 dark:border-gray-800 p-6 md:p-8">
                    <div className="flex items-center justify-between mb-4 md:mb-6">
                        <h3 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{t("mypage.activityTab.rewardsTitle")}</h3>
                    </div>
                    {rewards.length > 0 ? (
                        <div className="divide-y divide-gray-200 dark:divide-gray-700">
                            {rewards.map((r) => (
                                <div key={r.id} className="py-3 flex items-center justify-between">
                                    <div className="text-gray-800 dark:text-gray-200">
                                        <div className="font-semibold">
                                            {(() => {
                                                const type = String(r.type || "").toLowerCase();
                                                if (type === "checkin") return t("mypage.activityTab.reward7dayCheckin");
                                                if (type === "escape_place_clear") return t("mypage.activityTab.rewardMissionClear");
                                                if (type === "signup") return t("mypage.activityTab.rewardSignup");
                                                if (type === "ad_watch") return t("mypage.activityTab.rewardAdWatch");
                                                if (type === "purchase") return t("mypage.activityTab.rewardPurchase");
                                                if (type === "event") return t("mypage.activityTab.rewardEvent");
                                                if (type === "personal_memory_milestone") return t("mypage.activityTab.rewardMemory10");
                                                if (type === "course_completion_milestone") return t("mypage.activityTab.rewardReview");
                                                return r.type;
                                            })()}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            {new Date(r.createdAt).toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold text-sm md:text-base border border-emerald-200 dark:border-emerald-800/50">
                                            <span className="leading-none">+{r.amount}</span>
                                            <span className="leading-none">{t("mypage.activityTab.ticket")}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-gray-600 dark:text-gray-400 py-10">{t("mypage.activityTab.noRewards")}</div>
                    )}
                </div>
            )}

            {/* 구매 내역 탭 */}
            {subTab === "payments" && (
                <div className="bg-white dark:bg-[#1a241b] rounded-xl border border-gray-100 dark:border-gray-800 p-6 md:p-8">
                    <div className="flex items-center justify-between mb-4 md:mb-6">
                        <h3 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{t("mypage.activityTab.paymentsTitle")}</h3>
                        {/* 🟢 환불 페이지 링크 추가 */}
                        <Link
                            href="/refund"
                            className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-500 flex items-center gap-1"
                        >
                            {t("mypage.activityTab.refundManage")}
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                            </svg>
                        </Link>
                    </div>
                    {payments.length > 0 ? (
                        <div className="space-y-4">
                            {payments.map((payment) => {
                                const isTicket = payment.orderName.includes("열람권");
                                const isSubscription =
                                    payment.orderName.includes("구독") || payment.orderName.includes("멤버십");
                                const isRefunded = payment.status === "CANCELLED";

                                return (
                                    <div
                                        key={payment.id}
                                        className={`border rounded-xl p-5 transition-all ${
                                            isRefunded
                                                ? "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-60"
                                                : "bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:border-emerald-200 dark:hover:border-emerald-800/50 hover:shadow-sm"
                                        }`}
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    {isTicket ? (
                                                        <span className="px-2.5 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-bold">
                                                            {t("mypage.activityTab.ticket")}
                                                        </span>
                                                    ) : isSubscription ? (
                                                        <span className="px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-bold">
                                                            {t("mypage.activityTab.subscription")}
                                                        </span>
                                                    ) : null}
                                                    {isRefunded && (
                                                        <span className="px-2.5 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs font-medium">
                                                            {t("mypage.activityTab.refundDone")}
                                                        </span>
                                                    )}
                                                    {payment.status === "PAID" && (
                                                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                                                            {t("mypage.activityTab.paymentDone")}
                                                        </span>
                                                    )}
                                                </div>
                                                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                                                    {payment.orderName}
                                                </h4>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                    {new Date(payment.approvedAt).toLocaleDateString("ko-KR", {
                                                        year: "numeric",
                                                        month: "long",
                                                        day: "numeric",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </p>
                                                {payment.method && (
                                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                                        {t("mypage.activityTab.paymentMethod")}: {payment.method === "CARD" ? t("mypage.activityTab.card") : payment.method}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="text-right ml-4">
                                                <p
                                                    className={`text-xl font-bold ${
                                                        isRefunded ? "text-gray-400 dark:text-gray-600 line-through" : "text-gray-900 dark:text-white"
                                                    }`}
                                                >
                                                    {payment.amount.toLocaleString()}원
                                                </p>
                                            </div>
                                        </div>
                                        {/* 🟢 환불 버튼 추가 (PAID 상태이고 환불 가능한 경우만) */}
                                        {payment.status === "PAID" && !isRefunded && (
                                            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                                                <Link
                                                    href="/refund"
                                                    className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                                >
                                                    <svg
                                                        className="w-4 h-4"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth="2"
                                                            d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                                                        />
                                                    </svg>
                                                    {t("mypage.activityTab.requestRefund")}
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-10">
                            <div className="mb-3 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700 dark:text-gray-300">
                                    <rect width="20" height="14" x="2" y="5" rx="2"/>
                                    <line x1="2" x2="22" y1="10" y2="10"/>
                                </svg>
                            </div>
                            <div className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{t("mypage.activityTab.noPayments")}</div>
                            <div className="text-gray-600 dark:text-gray-400 mb-4">{t("mypage.activityTab.noPaymentsHint")}</div>
                            <Link
                                href="/refund"
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg transition-all"
                            >
                                <span>{t("mypage.activityTab.goToRefundPage")}</span>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M9 5l7 7-7 7"
                                    />
                                </svg>
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// 🟢 성능 최적화: React.memo로 불필요한 리렌더링 방지
export default memo(ActivityTab);
