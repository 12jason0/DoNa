"use client";

import React, { useRef, forwardRef, useImperativeHandle } from "react";
import { useHorizontalWheelScroll } from "@/hooks/useHorizontalWheelScroll";
import { useDragScroll } from "@/hooks/useDragScroll";

interface HorizontalScrollContainerProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    /** "wheel" = 마우스 휠로 가로 스크롤, "drag" = 드래그로만 스크롤 (마이페이지 등) */
    scrollMode?: "wheel" | "drag";
}

/**
 * 가로 스크롤 컨테이너.
 * - wheel: 마우스 휠(세로)을 가로 스크롤로 변환
 * - drag: 마우스/터치 드래그로만 스크롤
 */
const HorizontalScrollContainer = forwardRef<HTMLDivElement, HorizontalScrollContainerProps>(
    ({ children, className = "", scrollMode = "wheel", ...props }, ref) => {
        const innerRef = useRef<HTMLDivElement>(null);
        useImperativeHandle(ref, () => innerRef.current!);
        useHorizontalWheelScroll(innerRef, scrollMode === "wheel");
        const dragHandlers = useDragScroll(innerRef, scrollMode === "drag");

        return (
            <div
                ref={innerRef}
                className={`${scrollMode === "drag" ? "cursor-grab active:cursor-grabbing" : ""} ${className}`}
                {...(scrollMode === "drag" ? dragHandlers : {})}
                {...props}
            >
                {children}
            </div>
        );
    }
);
HorizontalScrollContainer.displayName = "HorizontalScrollContainer";

export default HorizontalScrollContainer;
