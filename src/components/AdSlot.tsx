"use client";

import { useRef, useEffect, memo, useState } from "react";

/**
 * Google AdSense 광고 슬롯.
 * - 로드 실패/노필 시 영역 0으로 접음 (빈 박스 방지).
 */
type AdSlotProps = {
    slotId?: string;
    format?: "fluid" | "auto";
    layoutKey?: string;
    rounded?: boolean;
    className?: string;
};

const NO_FILL_CHECK_MS = 4500;

const AdSlot = memo(({ slotId = "", format = "auto", layoutKey = "", rounded = true, className = "" }: AdSlotProps) => {
    const insRef = useRef<HTMLModElement>(null);
    const [hidden, setHidden] = useState(false);
    const isFluid = format === "fluid" && layoutKey;
    const roundClass = rounded ? "rounded-xl" : "rounded-none";

    useEffect(() => {
        if (!slotId || typeof window === "undefined" || !(window as any).adsbygoogle) return;
        try {
            if (insRef.current) {
                ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
            }
        } catch {
            // ignore
        }

        const t = setTimeout(() => {
            const el = insRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const hasIframe = el.querySelector("iframe");
            if (rect.height < 5 || !hasIframe) setHidden(true);
        }, NO_FILL_CHECK_MS);
        return () => clearTimeout(t);
    }, [slotId]);

    if (hidden) return <div className="h-0 min-h-0 overflow-hidden" aria-hidden />;

    if (!slotId) {
        return (
            <div
                className={`relative w-full min-h-[80px] ${roundClass} border border-gray-100 dark:border-gray-800 flex items-center justify-center bg-gray-50 dark:bg-gray-800/50 ${className}`}
            >
                <span className="text-xs text-gray-400 dark:text-gray-500">
                    광고 영역 (AdSense slot ID 설정 시 표시)
                </span>
            </div>
        );
    }

    return (
        <div
            className={`relative w-full ${roundClass} overflow-hidden ${isFluid ? "min-h-[80px]" : "min-h-[120px]"} flex items-center justify-center bg-gray-50 dark:bg-gray-800/50 ${className}`}
        >
            <ins
                ref={insRef}
                className="adsbygoogle"
                style={{ display: "block" }}
                data-ad-client="ca-pub-1305222191440436"
                data-ad-slot={slotId}
                data-ad-format={isFluid ? "fluid" : "auto"}
                {...(isFluid ? { "data-ad-layout-key": layoutKey as string } : { "data-full-width-responsive": "true" })}
            />
        </div>
    );
});
AdSlot.displayName = "AdSlot";

export default AdSlot;
