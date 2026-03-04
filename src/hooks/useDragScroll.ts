"use client";

import React, { useCallback, RefObject } from "react";

/**
 * 마우스/터치 드래그로 가로 스크롤.
 * 휠 대신 드래그로만 스크롤할 때 사용합니다.
 */
export function useDragScroll<T extends HTMLElement>(
    ref: RefObject<T | null>,
    active: boolean = true
) {
    const getClientX = useCallback((e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent): number => {
        if ("touches" in e && e.touches?.[0]) return e.touches[0].clientX;
        if ("clientX" in e) return e.clientX;
        return 0;
    }, []);

    const handlePointerDown = useCallback(
        (e: MouseEvent | TouchEvent) => {
            if (!active || !ref.current) return;
            const el = ref.current;
            const canScroll = el.scrollWidth > el.clientWidth;
            if (!canScroll) return;

            const startX = getClientX(e);
            const startScrollLeft = el.scrollLeft;

            const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
                moveEvent.preventDefault();
                const currentX = getClientX(moveEvent);
                el.scrollLeft = startScrollLeft + (startX - currentX);
            };

            const handleUp = () => {
                document.removeEventListener("mousemove", handleMove as (e: MouseEvent) => void);
                document.removeEventListener("mouseup", handleUp);
                document.removeEventListener("touchmove", handleMove as (e: TouchEvent) => void, { capture: true });
                document.removeEventListener("touchend", handleUp);
                document.body.style.cursor = "";
                document.body.style.userSelect = "";
            };

            document.body.style.cursor = "grabbing";
            document.body.style.userSelect = "none";
            document.addEventListener("mousemove", handleMove as (e: MouseEvent) => void);
            document.addEventListener("mouseup", handleUp);
            document.addEventListener("touchmove", handleMove as (e: TouchEvent) => void, { passive: false, capture: true });
            document.addEventListener("touchend", handleUp);
        },
        [ref, active, getClientX]
    );

    return { onMouseDown: handlePointerDown as (e: React.MouseEvent) => void, onTouchStart: handlePointerDown as (e: React.TouchEvent) => void };
}
