"use client";

import { useRef, useEffect, memo, useState } from "react";

/**
 * Google AdSense 광고 슬롯.
 * - 로드 실패/노필 시 영역 0으로 접음 (빈 박스 방지).
 * - push는 adsbygoogle 유무와 관계없이 시도 (스크립트 지연 로드 대응).
 * - slotId 변경 시 hidden 리셋, 노필 체크는 5초 후 + done 상태에서만.
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

const NO_FILL_CHECK_MS = 5000;
const MIN_FLUID_WIDTH = 250;

const AdSlot = memo(({ slotId = "", format = "auto", layoutKey = "", rounded = true, className = "", onHide }: AdSlotProps) => {
    const insRef = useRef<HTMLModElement>(null);
    const hasPushedRef = useRef(false);
    const [hidden, setHidden] = useState(false);

    const isFluid = format === "fluid" && !!layoutKey;
    const roundClass = rounded ? "rounded-xl" : "rounded-none";

    useEffect(() => {
        setHidden(false);
        hasPushedRef.current = false;
    }, [slotId]);

    useEffect(() => {
        if (!slotId || typeof window === "undefined") return;

        const el = insRef.current;
        if (!el) return;

        const status = el.getAttribute("data-adsbygoogle-status");
        if (status === "done" || hasPushedRef.current) return;

        const tryPush = () => {
            const el2 = insRef.current;
            if (!el2) return false;

            const status2 = el2.getAttribute("data-adsbygoogle-status");
            if (status2 === "done" || hasPushedRef.current) return false;

            if (isFluid) {
                const rect = el2.getBoundingClientRect();
                if (rect.width < MIN_FLUID_WIDTH) return false;
            }

            hasPushedRef.current = true;
            try {
                (window as any).adsbygoogle = (window as any).adsbygoogle || [];
                (window as any).adsbygoogle.push({});
            } catch {
                hasPushedRef.current = false;
            }
            return true;
        };

        if (!tryPush() && isFluid) {
            const raf = requestAnimationFrame(() => tryPush());
            const tDelayed = setTimeout(tryPush, 150);
            const t = setTimeout(() => {
                const el2 = insRef.current;
                if (!el2) return;
                const rect = el2.getBoundingClientRect();
                const hasIframe = !!el2.querySelector("iframe");
                const status2 = el2.getAttribute("data-adsbygoogle-status");
                const adStatus = el2.getAttribute("data-ad-status");
                const isNoFill =
                    status2 === "done" &&
                    (adStatus === "unfilled" || !hasIframe || rect.height < 5);
                if (isNoFill) {
                    setHidden(true);
                    onHide?.();
                }
            }, NO_FILL_CHECK_MS);
            return () => {
                cancelAnimationFrame(raf);
                clearTimeout(tDelayed);
                clearTimeout(t);
            };
        }

        const t = setTimeout(() => {
            const el2 = insRef.current;
            if (!el2) return;
            const rect = el2.getBoundingClientRect();
            const hasIframe = !!el2.querySelector("iframe");
            const status2 = el2.getAttribute("data-adsbygoogle-status");
            const adStatus = el2.getAttribute("data-ad-status");
            const isNoFill =
                status2 === "done" &&
                (adStatus === "unfilled" || !hasIframe || rect.height < 5);
            if (isNoFill) {
                setHidden(true);
                onHide?.();
            }
        }, NO_FILL_CHECK_MS);

        return () => clearTimeout(t);
    }, [slotId, isFluid, layoutKey, onHide]);

    if (hidden) return null;
    if (!slotId) return null;

    return (
        <div
            className={`relative w-full min-w-[250px] ${roundClass} overflow-hidden ${isFluid ? "min-h-[80px]" : "min-h-[120px]"} flex items-center justify-center bg-gray-50 dark:bg-gray-800/50 ${className}`}
        >
            <ins
                ref={insRef}
                className="adsbygoogle"
                style={{ display: "block", minWidth: 250 }}
                data-ad-client="ca-pub-1305222191440436"
                data-ad-slot={slotId}
                data-ad-format={isFluid ? "fluid" : "auto"}
                {...(isFluid ? { "data-ad-layout-key": layoutKey } : { "data-full-width-responsive": "true" })}
            />
        </div>
    );
});
AdSlot.displayName = "AdSlot";

export default AdSlot;
