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
    /** 광고 로드 실패/노필 시 상위에 알림 (앱처럼 광고 영역 제거용) */
    onHide?: () => void;
};

const NO_FILL_CHECK_MS = 2000;

const AdSlot = memo(({ slotId = "", format = "auto", layoutKey = "", rounded = true, className = "", onHide }: AdSlotProps) => {
    const insRef = useRef<HTMLModElement>(null);
    const [hidden, setHidden] = useState(false);
    const onHideRef = useRef(onHide);
    onHideRef.current = onHide;
    const isFluid = format === "fluid" && layoutKey;
    const roundClass = rounded ? "rounded-xl" : "rounded-none";

    useEffect(() => {
        if (!slotId || typeof window === "undefined") return;
        try {
            if ((window as any).adsbygoogle && insRef.current) {
                ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
            }
        } catch {
            // ignore
        }
        // adsbygoogle 유무와 관계없이 2초 후 노필 체크 실행 (스크립트 지연 로드 대응)
        const t = setTimeout(() => {
            const el = insRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const hasIframe = el.querySelector("iframe");
            if (rect.height < 5 || !hasIframe) {
                setHidden(true);
                onHideRef.current?.();
            }
        }, NO_FILL_CHECK_MS);
        return () => clearTimeout(t);
    }, [slotId]);

    if (hidden) return null;

    if (!slotId) return null;

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
