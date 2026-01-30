"use client";

import { useRef, useEffect, memo } from "react";

/**
 * Google AdSense 광고 슬롯.
 * AdSense 대시보드에서 발급한 광고 단위 ID를 slotId로 전달하세요.
 * slotId가 비어 있으면 자리만 잡아두고, 나중에 채워 넣으면 됩니다.
 */
type AdSlotProps = {
    /** AdSense 광고 단위 ID (예: "1234567890"). 비우면 자리만 표시 */
    slotId?: string;
    /** 슬롯 구분용 (동일 페이지에 여러 슬롯일 때) */
    className?: string;
};

const AdSlot = memo(({ slotId = "", className = "" }: AdSlotProps) => {
    const insRef = useRef<HTMLModElement>(null);

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

    return (
        <div
            className={`relative w-full min-h-[120px] rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800 flex items-center justify-center bg-gray-50 dark:bg-gray-800/50 ${className}`}
        >
            {slotId ? (
                <ins
                    ref={insRef}
                    className="adsbygoogle"
                    style={{ display: "block" }}
                    data-ad-client="ca-pub-1305222191440436"
                    data-ad-slot={slotId}
                    data-ad-format="auto"
                    data-full-width-responsive="true"
                />
            ) : (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                    광고 영역 (AdSense slot ID 설정 시 표시)
                </span>
            )}
        </div>
    );
});
AdSlot.displayName = "AdSlot";

export default AdSlot;
