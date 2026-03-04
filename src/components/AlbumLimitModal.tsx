"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "@/context/LocaleContext";

type AlbumLimitModalProps = {
    /** API에서 내려준 메시지가 있으면 표시, 없으면 번역 키(albumLimitModal.fallbackMessage) 사용 */
    message?: string;
    onClose: () => void;
};

/**
 * 추억 앨범 한도 도달 시 모달
 * "추억을 무제한으로 저장하고 싶다면?" + BASIC / PREMIUM 업그레이드 유도
 */
export default function AlbumLimitModal({ message, onClose }: AlbumLimitModalProps) {
    const router = useRouter();
    const { t, isLocaleReady } = useLocale();
    const displayMessage = (message && message.trim()) ? message : t("albumLimitModal.fallbackMessage");

    const handleBasic = () => {
        onClose();
        router.push("/personalized-home");
    };

    const handlePremium = () => {
        onClose();
        router.push("/personalized-home");
    };

    return (
        <div className="fixed inset-0 z-2000 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-white dark:bg-[#1a241b] rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
                {!isLocaleReady ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent" />
                    </div>
                ) : (
                <>
                <p className="text-gray-800 dark:text-gray-100 text-center text-[15px] leading-relaxed">
                    {displayMessage}
                </p>
                <p className="text-gray-700 dark:text-gray-200 text-center font-semibold text-base">
                    {t("albumLimitModal.upgradeTitle")}
                </p>
                <div className="flex flex-col gap-3">
                    <button
                        type="button"
                        onClick={handleBasic}
                        className="w-full py-3 px-4 rounded-xl font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 transition-colors"
                    >
                        {t("albumLimitModal.basic")}
                    </button>
                    <button
                        type="button"
                        onClick={handlePremium}
                        className="w-full py-3 px-4 rounded-xl font-semibold text-white bg-gray-900 dark:bg-gray-800 hover:bg-gray-800 dark:hover:bg-gray-700 active:bg-gray-700 transition-colors"
                    >
                        {t("albumLimitModal.premium")}
                    </button>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-2.5 text-gray-500 dark:text-gray-400 text-sm font-medium hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                    {t("albumLimitModal.close")}
                </button>
                </>
                )}
            </div>
        </div>
    );
}
