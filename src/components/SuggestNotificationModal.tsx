"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "@/context/LocaleContext";
import { X } from "lucide-react";

type Props = {
    onClose: () => void;
};

export default function SuggestNotificationModal({ onClose }: Props) {
    const router = useRouter();
    const { t } = useLocale();

    const handleSuggest = () => {
        onClose();
        router.push("/suggest");
    };

    return (
        <div
            className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
            role="presentation"
        >
            <div
                className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl px-6 pt-8 pb-10 space-y-5 animate-in slide-in-from-bottom duration-300"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="suggest-modal-title"
            >
                <div className="absolute left-1/2 top-3 h-1 w-10 -translate-x-1/2 rounded-full bg-slate-200 dark:bg-slate-700" />
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-4 top-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    aria-label={t("common.close")}
                >
                    <X size={18} />
                </button>

                <div className="text-center space-y-2 pt-2">
                    <div className="text-4xl" aria-hidden>
                        📍
                    </div>
                    <h2 id="suggest-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
                        {t("suggest.pageTitle")}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                        {t("suggest.pageSubtitle")}
                    </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl px-5 py-4 space-y-2.5">
                    {(["PENDING", "PUBLISHED", "REJECTED"] as const).map((status) => {
                        const dot: Record<string, string> = {
                            PENDING: "bg-amber-400",
                            PUBLISHED: "bg-emerald-400",
                            REJECTED: "bg-slate-400",
                        };
                        return (
                            <div key={status} className="flex items-start gap-2.5">
                                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${dot[status]}`} />
                                <span className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                    <span className="font-semibold">{t(`home.myReportedCourses.status.${status}`)}</span>
                                    {" — "}
                                    {t(`suggest.modalStatusHint.${status}`)}
                                </span>
                            </div>
                        );
                    })}
                </div>

                <button
                    type="button"
                    onClick={handleSuggest}
                    className="w-full py-4 bg-[#7FCC9F] text-white font-bold rounded-2xl active:scale-[0.98] transition-transform text-[15px]"
                >
                    {t("home.myReportedCourses.suggestBtn")}
                </button>
            </div>
        </div>
    );
}
