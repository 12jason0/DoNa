"use client";

import React, { useState, useCallback } from "react";

type TapFeedbackProps = {
    children: React.ReactNode;
    className?: string;
    /** 눌렀을 때 스케일 (기본 0.97) */
    scale?: number;
    /** 눌렀을 때 배경 어두움 (0~1, 기본 0.04) */
    overlayOpacity?: number;
};

/**
 * 앱 터치 피드백: pointerdown 시 즉시 축소 + 배경 어두워짐으로 "눌렀다" 인지
 * 버튼, Link, 클릭 가능한 div 등을 감싸서 사용
 */
export default function TapFeedback({
    children,
    className = "",
    scale = 0.97,
    overlayOpacity = 0.04,
}: TapFeedbackProps) {
    const [pressed, setPressed] = useState(false);

    const onPointerDown = useCallback(() => setPressed(true), []);
    const onPointerUp = useCallback(() => setPressed(false), []);
    const onPointerLeave = useCallback(() => setPressed(false), []);
    const onPointerCancel = useCallback(() => setPressed(false), []);

    return (
        <span
            className={`tap-feedback-wrapper inline-block relative select-none ${className}`}
            style={{
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
            }}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerLeave}
            onPointerCancel={onPointerCancel}
        >
            <span
                className="relative block transition-transform duration-75 ease-out origin-center"
                style={{
                    transform: pressed ? `scale(${scale})` : "scale(1)",
                }}
            >
                {children}
                {pressed && (
                    <span
                        className="absolute inset-0 pointer-events-none bg-black dark:bg-white"
                        style={{ opacity: overlayOpacity }}
                        aria-hidden
                    />
                )}
            </span>
        </span>
    );
}
