"use client";

import { useRef, useEffect, memo } from "react";

/**
 * Google AdSense 광고 슬롯.
 * - fluid: 피드형(인피드) 광고. 컨테이너 높이는 가변으로 두세요.
 * - auto: 일반 디스플레이 광고.
 */
type AdSlotProps = {
    /** AdSense 광고 단위 ID. 비우면 자리만 표시 */
    slotId?: string;
    /** "fluid" = 피드형(인피드), "auto" = 일반 디스플레이 */
    format?: "fluid" | "auto";
    /** fluid 형식일 때 필수 (AdSense 대시보드에서 발급) */
    layoutKey?: string;
    className?: string;
};

const AdSlot = memo(({ slotId = "", format = "auto", layoutKey = "", className = "" }: AdSlotProps) => {
    const insRef = useRef<HTMLModElement>(null);
    const isFluid = format === "fluid" && layoutKey;

    useEffect(() => {
        try {
            if (
                typeof window !== "undefined" &&
                (window as any).adsbygoogle &&
                insRef.current &&
                slotId
            ) {
                ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
            }
        } catch {
            // ignore
        }
    }, [slotId]);

    if (!slotId) {
        return (
            <div
                className={`relative w-full min-h-[80px] rounded-xl border border-gray-100 dark:border-gray-800 flex items-center justify-center bg-gray-50 dark:bg-gray-800/50 ${className}`}
            >
                <span className="text-xs text-gray-400 dark:text-gray-500">
                    광고 영역 (AdSense slot ID 설정 시 표시)
                </span>
            </div>
        );
    }

    return (
        <div
            className={`relative w-full rounded-xl overflow-hidden ${isFluid ? "min-h-[80px]" : "min-h-[120px]"} flex items-center justify-center bg-gray-50 dark:bg-gray-800/50 ${className}`}
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
