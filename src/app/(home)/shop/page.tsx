"use client";

import { ShoppingBag } from "lucide-react";
import { useLocale } from "@/context/LocaleContext";

export default function ShopPage() {
    const { t } = useLocale();
    return (
        <div className="min-h-screen bg-white dark:bg-[#0f1710] flex items-center justify-center">
            <div className="text-center px-4">
                <ShoppingBag className="w-16 h-16 mx-auto text-emerald-500 mb-4" />
                <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-2">{t("shop.title")}</h1>
                <p className="text-gray-500 dark:text-gray-400">{t("shop.comingSoon")}</p>
            </div>
        </div>
    );
}
