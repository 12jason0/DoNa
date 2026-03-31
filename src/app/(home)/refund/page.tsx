"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale } from "@/context/LocaleContext";

// PaymentHistory 인터페이스 정의 (기존과 동일)
interface PaymentHistory {
    id: string;
    orderId: string;
    orderName: string;
    amount: number;
    status: string;
    approvedAt: string;
    paymentKey: string | null;
    method?: string | null; // 🟢 결제 방법 (토스페이먼츠: null/undefined, 인앱결제: "IN_APP")
}

export default function RefundPage() {
    const router = useRouter();
    const { locale } = useLocale();
    const tr = (ko: string, en: string, ja: string, zh: string) =>
        locale === "ko" ? ko : locale === "ja" ? ja : locale === "zh" ? zh : en;
    const [loading, setLoading] = useState(true);
    const [refunding, setRefunding] = useState(false);
    const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
    const [success, setSuccess] = useState("");

    // 팝업(모달) 상태 관리
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState<PaymentHistory | null>(null);
    
    // 🟢 환불 실패 모달 상태
    const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        fetchPaymentHistory();
    }, []);

    const fetchPaymentHistory = async () => {
        try {
            // 🟢 쿠키 기반 인증: authenticatedFetch 사용
            const { authenticatedFetch } = await import("@/lib/authClient");
            const data = await authenticatedFetch<{ payments?: PaymentHistory[] }>("/api/payments/history");
            if (data) {
                setPaymentHistory((data as any).payments || []);
            } else {
                router.push("/login");
            }
        } catch (err) {
            // 내역 불러오기 실패는 조용히 처리 (로딩만 종료)
            console.error("내역 불러오기 실패:", err);
        } finally {
            setLoading(false);
        }
    };

    // 🟢 상품 타입 확인
    const isSubscription = (orderName: string) => {
        return orderName.includes("구독") || orderName.includes("멤버십") || orderName.includes("프리미엄");
    };

    // 환불 실행 함수
    const executeRefund = async () => {
        if (!selectedPayment) return;
        setRefunding(true);
        setIsModalOpen(false); // 모달 닫기

        try {
            const { authenticatedFetch } = await import("@/lib/authClient");
            
            // 🟢 구독권만 환불 가능 (단건 열람권은 환불 불가)
            const isSubscriptionRefund = isSubscription(selectedPayment.orderName);
            const apiEndpoint = "/api/refund/request"; // 구독권만 환불 가능
            
            const data = await authenticatedFetch(apiEndpoint, {
                method: "POST",
                body: JSON.stringify({
                    orderId: selectedPayment.orderId,
                    cancelReason: tr(
                        "사용자 변심(이탈 방지 모달 거침)",
                        "Changed mind (after retention modal)",
                        "ユーザー都合（離脱防止モーダル経由）",
                        "用户改变主意（经过挽留弹窗）"
                    ),
                }),
            });

            if (data) {
                // 🟢 구독권 환불 요청인 경우
                if (isSubscriptionRefund) {
                    setSuccess(
                        tr(
                            "환불 신청이 접수되었습니다.\n\n운영자가 확인 후 환불을 진행하겠습니다.",
                            "Your refund request has been received.\n\nOur team will review and process it.",
                            "返金申請を受け付けました。\n\n運営側で確認後、返金を進めます。",
                            "退款申请已受理。\n\n运营团队确认后将为您处理。"
                        )
                    );
                    
                    // 구독권 환불 요청 시 사용자 정보 강제 갱신 이벤트 (멤버십이 FREE로 변경됨)
                    if (typeof window !== "undefined") {
                        window.dispatchEvent(new CustomEvent("subscriptionChanged"));
                        // localStorage 캐시도 무효화
                        try {
                            const userStr = localStorage.getItem("user");
                            if (userStr) {
                                const user = JSON.parse(userStr);
                                user.subscriptionTier = "FREE";
                                user.subscriptionExpiresAt = null;
                                localStorage.setItem("user", JSON.stringify(user));
                            }
                        } catch (e) {
                            console.error("Failed to update localStorage:", e);
                        }
                    }
                } else {
                    // 🟢 (구독권만 노출되므로 도달하지 않음)
                    // 인앱결제 환불 안내
                    if ((data as any).isInApp) {
                        const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
                        const platform = isIOS ? "App Store" : "Google Play";
                        const platformUrl = isIOS 
                            ? "https://reportaproblem.apple.com/" 
                            : "https://play.google.com/store/account/orderhistory";
                        
                        setSuccess(
                            `${selectedPayment.orderName} ${tr("환불 처리가 완료되었습니다.\n\n", "refund process completed.\n\n", "の返金処理が完了しました。\n\n", "退款处理已完成。\n\n")}` +
                            `${tr("실제 환불은", "Please request the final refund via", "実際の返金は", "实际退款请在")} ${platform} ${tr("에서 직접 신청해주세요.", ".", "で直接申請してください。", "中自行申请。")}`
                        );
                        
                        // 플랫폼 환불 페이지로 이동하는 링크 제공
                        if (window.confirm(`${platform} ${tr("환불 페이지로 이동하시겠습니까?", "refund page now?", "返金ページへ移動しますか？", "退款页面吗？")}`)) {
                            window.open(platformUrl, "_blank");
                        }
                    } else {
                        setSuccess(`${selectedPayment.orderName} ${tr("환불이 완료되었습니다.", "refund completed.", "の返金が完了しました。", "退款已完成。")}`);
                    }
                    
                    // 환불 완료 이벤트 발생
                    if (typeof window !== "undefined") {
                        window.dispatchEvent(new CustomEvent("refundSuccess", {
                            detail: {
                                orderName: selectedPayment.orderName,
                                isSubscription: false,
                            }
                        }));
                    }
                }
                
                await fetchPaymentHistory();
            } else {
                // 🟢 환불 실패 시 모달로 에러 메시지 표시
                const errorMsg = (data as any)?.error || tr("환불 처리 중 오류가 발생했습니다.", "An error occurred while processing the refund.", "返金処理中にエラーが発生しました。", "退款处理时发生错误。");
                setErrorMessage(errorMsg);
                setIsErrorModalOpen(true);
            }
        } catch (err: any) {
            // 🟢 에러 발생 시 모달로 표시
            const errorMsg = err?.message || (err as any)?.error || tr("서버와의 통신에 실패했습니다.", "Failed to communicate with the server.", "サーバーとの通信に失敗しました。", "与服务器通信失败。");
            setErrorMessage(errorMsg);
            setIsErrorModalOpen(true);
        } finally {
            setRefunding(false);
        }
    };

    // 환불 가능 내역: 구독권만 (단건 열람권은 환불 불가)
    const refundablePayments = paymentHistory.filter(
        (p) =>
            p.status === "PAID" &&
            ((p.paymentKey && (!p.method || p.method !== "IN_APP")) || p.method === "IN_APP") &&
            (p.orderName.includes("구독") || p.orderName.includes("멤버십"))
    );

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0f1710] text-gray-900 dark:text-white">⏳ {tr("로딩 중...", "Loading...", "読み込み中...", "加载中...")}</div>;

    return (
        <div className="min-h-screen bg-[#F9FAFB] dark:bg-[#0f1710] typography-smooth pb-20">
            {/* ✅ 수정된 이탈 방지 모달 (팝업) */}
            {isModalOpen && selectedPayment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1a241b] rounded-4xl p-8 max-w-[360px] w-full shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="text-center">
                            <div className="text-6xl mb-5">🥺</div>
                            {/* 더 강력한 훅(Hook) 메시지 */}
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 leading-tight">
                                {tr("잠시만요!", "Wait a second!", "ちょっと待ってください！", "请稍等！")}
                                <br />
                                {tr("혜택이 사라져요", "You will lose benefits", "特典がなくなります", "将失去权益")}
                            </h3>
                            <p className="text-gray-600 dark:text-gray-300 text-[15px] leading-relaxed mb-8">
                                {tr(
                                    "지금 환불하시면 ",
                                    "If you refund now, ",
                                    "今返金すると、",
                                    "现在退款的话，"
                                )}
                                <span className="text-green-600 font-bold">DoNa</span>
                                {tr(
                                    " 프리미엄 멤버십의 특별한 혜택을 더 이상 받으실 수 없어요. 정말 괜찮으신가요?",
                                    " premium membership benefits will no longer be available. Are you sure?",
                                    " のプレミアム特典が利用できなくなります。本当によろしいですか？",
                                    " 的高级会员权益将无法继续使用。确定要继续吗？"
                                )}
                            </p>

                            <div className="flex flex-col gap-3">
                                {/* 시그니처 그린 컬러 적용 및 문구 변경 */}
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="w-full py-4 bg-green-500 dark:bg-emerald-600 text-white rounded-2xl font-bold text-lg hover:bg-green-600 dark:hover:bg-emerald-700 shadow-lg shadow-green-200/50 dark:shadow-emerald-900/50 transition-all active:scale-[0.98]"
                                >
                                    {tr("네, 혜택 유지할게요! 💚", "Keep my benefits 💚", "特典を維持します 💚", "保留权益 💚")}
                                </button>
                                {/* 부정적 선택지 강조 */}
                                <button
                                    onClick={executeRefund}
                                    className="w-full py-3 text-gray-400 dark:text-gray-500 text-sm font-medium hover:text-gray-600 dark:hover:text-gray-400 transition-colors underline-offset-4 hover:underline"
                                >
                                    {tr("혜택 포기하고 환불하기", "Refund anyway", "特典を放棄して返金", "放弃权益并退款")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 🟢 환불 실패 모달 */}
            {isErrorModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1a241b] rounded-4xl p-8 max-w-[360px] w-full shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="text-center">
                            <div className="text-6xl mb-5">⚠️</div>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 leading-tight">
                                {tr("환불이 불가능합니다", "Refund unavailable", "返金できません", "无法退款")}
                            </h3>
                            <p className="text-gray-600 dark:text-gray-300 text-[15px] leading-relaxed mb-8 whitespace-pre-line">
                                {errorMessage}
                            </p>

                            <button
                                onClick={() => {
                                    setIsErrorModalOpen(false);
                                    setErrorMessage("");
                                }}
                                className="w-full py-4 bg-gray-900 dark:bg-gray-800 text-white rounded-2xl font-bold text-lg hover:bg-black dark:hover:bg-gray-700 transition-all active:scale-[0.98]"
                            >
                                {tr("확인", "Confirm", "確認", "确认")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <main className="max-w-xl mx-auto px-6 py-12">
                <Link
                    href="/mypage"
                    className="text-gray-400 dark:text-gray-500 flex items-center gap-1 mb-6 hover:text-gray-900 dark:hover:text-gray-200 transition-all font-medium"
                >
                    {tr("← 마이페이지", "← My Page", "← マイページ", "← 我的页面")}
                </Link>

                <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2 italic">{tr("환불 현황", "Refund Status", "返金状況", "退款状态")}</h1>
                <p className="text-gray-500 dark:text-gray-400 mb-10 text-sm">{tr("결제하신 내역을 확인하고 환불을 진행하세요.", "Check your payment history and request a refund.", "購入履歴を確認して返金を進めてください。", "请查看支付记录并进行退款。")}</p>

                {/* 메시지 영역 */}
                {success && (
                    <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 p-4 rounded-2xl mb-6 text-sm font-medium border border-emerald-100 dark:border-emerald-800 animate-in fade-in slide-in-from-top-2">
                        {success}
                    </div>
                )}

                {/* 환불 정책 안내 */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl p-5 mb-6 text-sm">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <span>📋</span> {tr("환불 정책", "Refund Policy", "返金ポリシー", "退款政策")}
                    </h3>
                    <ul className="space-y-2 text-gray-700 dark:text-gray-300 leading-relaxed">
                        <li className="flex items-start gap-2">
                            <span className="text-blue-500 dark:text-blue-400 mt-1">•</span>
                            <span><strong className="text-gray-900 dark:text-white">{tr("구독권:", "Subscription:", "サブスク:", "订阅:")}</strong> {tr("구매 후 7일 이내에만 환불 가능합니다.", "Refunds are available only within 7 days of purchase.", "購入後7日以内のみ返金可能です。", "仅支持购买后 7 天内退款。")}</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-500 dark:text-blue-400 mt-1">•</span>
                            <span><strong className="text-gray-900 dark:text-white">{tr("구독 혜택 사용 시:", "If benefits are used:", "特典利用時:", "已使用权益时:")}</strong> {tr("BASIC/PREMIUM 구독 후 하나의 코스라도 사용하시면 환불이 불가능합니다.", "If any course is used after BASIC/PREMIUM subscription, refund is unavailable.", "BASIC/PREMIUM加入後に1つでもコースを利用すると返金できません。", "BASIC/PREMIUM 订阅后使用任一课程即不可退款。")}</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-500 dark:text-blue-400 mt-1">•</span>
                            <span><strong className="text-gray-900 dark:text-white">{tr("단건 열람권:", "Single-view pass:", "単件閲覧券:", "单次阅览券:")}</strong> {tr("구매 즉시 콘텐츠가 제공되어 환불이 제한됩니다.", "Content is provided immediately, so refunds are limited.", "購入直後にコンテンツが提供されるため返金が制限されます。", "购买后立即提供内容，因此退款受限。")}</span>
                        </li>
                    </ul>
                </div>

                {/* 환불 가능 카드 */}
                <h2 className="text-sm font-bold text-gray-400 dark:text-gray-500 mb-4 uppercase tracking-widest">{tr("환불 가능 내역", "Available to Refund", "返金可能な履歴", "可退款记录")}</h2>
                {refundablePayments.length > 0 ? (
                    refundablePayments.map((p) => (
                        <div
                            key={p.id}
                            className="bg-white dark:bg-[#1a241b] rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 mb-4 hover:shadow-md transition-all"
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    {/* 뱃지 컬러도 그린 계열로 변경 */}
                                    <span className="inline-block px-3 py-1 bg-green-50 dark:bg-emerald-900/30 text-green-600 dark:text-emerald-400 rounded-full text-[10px] font-bold mb-2 uppercase">
                                        {tr("구독권", "Subscription", "サブスク", "订阅")}
                                    </span>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{p.orderName}</h3>
                                    <p className="text-gray-400 dark:text-gray-500 text-xs mt-1 font-medium">
                                        {new Date(p.approvedAt).toLocaleDateString()} {tr("결제", "paid", "決済", "支付")}
                                    </p>
                                </div>
                                <p className="text-xl font-black text-gray-900 dark:text-white">{p.amount.toLocaleString()}{tr("원", " KRW", "ウォン", "韩元")}</p>
                            </div>
                            <button
                                onClick={() => {
                                    setSelectedPayment(p);
                                    setIsModalOpen(true);
                                }}
                                disabled={refunding}
                                className="w-full py-4 bg-gray-900 dark:bg-gray-800 text-white rounded-2xl font-bold hover:bg-black dark:hover:bg-gray-700 transition-all disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 dark:disabled:text-gray-500 active:scale-[0.98]"
                            >
                                {refunding ? tr("처리 중...", "Processing...", "処理中...", "处理中...") : tr("환불하기", "Request Refund", "返金する", "申请退款")}
                            </button>
                        </div>
                    ))
                ) : (
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-3xl p-10 text-center text-gray-400 dark:text-gray-500 text-sm italic border border-gray-100 dark:border-gray-800">
                        {tr("환불 가능한 최근 내역이 없습니다.", "No refundable recent payments.", "返金可能な最近の履歴はありません。", "暂无可退款的最近记录。")}
                    </div>
                )}

                {/* 전체 내역 (간소화) */}
                <div className="mt-12 opacity-50 hover:opacity-100 transition-opacity">
                    <h2 className="text-sm font-bold text-gray-400 dark:text-gray-500 mb-4 uppercase tracking-widest">{tr("지난 결제 내역", "Past History", "過去の履歴", "历史记录")}</h2>
                    <div className="space-y-2">
                        {paymentHistory.slice(0, 3).map((h) => (
                            <div
                                key={h.id}
                                className="flex justify-between text-xs py-3 border-b border-gray-100 dark:border-gray-800 font-medium"
                            >
                                <span className="text-gray-600 dark:text-gray-400">{h.orderName}</span>
                                <span className={h.status === "PAID" ? "text-green-500 dark:text-emerald-400" : "text-gray-400 dark:text-gray-500"}>
                                    {h.status === "PAID" ? tr("결제완료", "Paid", "支払い完了", "支付完成") : tr("환불완료", "Refunded", "返金完了", "退款完成")}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 사업자 정보 */}
                <div className="mt-16 pt-10 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-400 dark:text-gray-500 leading-loose font-medium">
                    <p>{tr("상호: (주)두나 (DoNa) | 대표: 오승용 | 사업자번호: 166-10-03081", "Company: DoNa Inc. | Representative: Oh Seung-yong | Business No.: 166-10-03081", "商号: DoNa | 代表: オ・スンヨン | 事業者番号: 166-10-03081", "公司: DoNa | 代表: 吴承勇 | 营业号: 166-10-03081")}</p>
                    <p>{tr("통신판매: 제 2025-충남홍성-0193 호 | 주소: 충청남도 홍성군 홍북읍 신대로 33", "Online Sales: 2025-Chungnam Hongseong-0193 | Address: 33 Sindaero, Hongbukeup, Hongseong-gun", "通信販売: 第2025-忠南洪城-0193号 | 住所: 忠清南道洪城郡洪北邑新大路33", "通信销售: 第2025-忠南洪城-0193号 | 地址: 忠清南道洪城郡洪北邑新大路33")}</p>
                    <p>{tr("문의: 12jason@donacouse.com", "Contact: 12jason@donacouse.com", "お問い合わせ: 12jason@donacouse.com", "联系: 12jason@donacouse.com")}</p>
                </div>
            </main>
        </div>
    );
}
