"use client";

import { useEffect, RefObject } from "react";

/**
 * 마우스 휠(세로 스크롤)을 가로 스크롤로 변환하여 적용합니다.
 * overflow-x-auto인 컨테이너에서 마우스 휠로 좌우 스크롤이 가능해집니다.
 * @param active - 조건부 렌더 시, 요소가 DOM에 마운트될 때 true로 설정하면 리스너가 붙습니다.
 */
export function useHorizontalWheelScroll<T extends HTMLElement>(
    ref: RefObject<T | null>,
    active: boolean = true
) {
    useEffect(() => {
        if (!active) return;
        const el = ref.current;
        if (!el) return;

        const handleWheel = (e: WheelEvent) => {
            const { scrollWidth, clientWidth, scrollLeft } = el;
            const canScrollHorizontal = scrollWidth > clientWidth;
            if (!canScrollHorizontal) return;

            const delta = e.deltaY;
            const isScrollingDown = delta > 0;
            const atStart = scrollLeft <= 0;
            const atEnd = scrollLeft + clientWidth >= scrollWidth - 1;

            if ((isScrollingDown && atEnd) || (!isScrollingDown && atStart)) {
                return; // 이미 끝에 도달했으면 기본 동작 유지 (세로 스크롤)
            }

            e.preventDefault();
            el.scrollLeft += delta;
        };

        el.addEventListener("wheel", handleWheel, { passive: false });
        return () => el.removeEventListener("wheel", handleWheel);
    }, [ref, active]);
}
