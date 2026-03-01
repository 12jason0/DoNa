"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAppLayout } from "@/context/AppLayoutContext";

const DRAG_CLOSE_THRESHOLD = 60;

interface ShopModalProps {
    onClose: () => void;
}

export default function ShopModal({ onClose }: ShopModalProps) {
    const { containInPhone, modalContainerRef } = useAppLayout();
    const [mounted, setMounted] = useState(false);
    const [slideUp, setSlideUp] = useState(false);
    const [dragY, setDragY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const startYRef = useRef(0);
    const pointerIdRef = useRef<number | null>(null);
    const dragYRef = useRef(0);

    const getClientY = (e: React.TouchEvent | React.PointerEvent) =>
        "touches" in e ? e.touches[0]?.clientY : e.clientY;

    const onDragStart = (clientY: number, pointerId?: number) => {
        startYRef.current = clientY;
        pointerIdRef.current = pointerId ?? null;
    };
    const onDragMove = (clientY: number) => {
        const dy = Math.max(0, clientY - startYRef.current);
        dragYRef.current = dy;
        if (dy > 0) setIsDragging(true);
        setDragY(dy);
    };
    const onDragEnd = () => {
        if (dragYRef.current > DRAG_CLOSE_THRESHOLD) onClose();
        else setDragY(0);
        setIsDragging(false);
        pointerIdRef.current = null;
    };

    useEffect(() => {
        setMounted(true);
        document.body.style.overflow = "hidden";
        const t = requestAnimationFrame(() => {
            requestAnimationFrame(() => setSlideUp(true));
        });
        return () => {
            cancelAnimationFrame(t);
            setMounted(false);
            document.body.style.overflow = "unset";
        };
    }, []);

    if (!mounted) return null;

    const posClass = containInPhone ? "absolute" : "fixed";
    const portalTarget = containInPhone && modalContainerRef?.current ? modalContainerRef.current : document.body;

    return createPortal(
        <div
            className={`${posClass} inset-0 bg-black/40 dark:bg-black/70 flex flex-col justify-end z-9999 animate-in fade-in duration-200`}
            onClick={onClose}
        >
            <div
                className={`bg-white dark:bg-[#1a241b] rounded-t-2xl border-t border-x border-gray-100 dark:border-gray-800 w-full max-w-lg mx-auto p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-center ${
                    !isDragging ? "transition-transform duration-300 ease-out" : ""
                }`}
                style={{
                    transform: slideUp
                        ? dragY > 0
                            ? `translateY(${dragY}px)`
                            : "translateY(0)"
                        : "translateY(100%)",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* 하단 시트 그랩버: 아래로 스와이프 시 모달 닫힘 */}
                <div
                    role="button"
                    tabIndex={0}
                    aria-label="아래로 당겨 닫기"
                    className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-5 touch-none cursor-grab active:cursor-grabbing"
                    onTouchStart={(e) => onDragStart(getClientY(e))}
                    onTouchMove={(e) => onDragMove(getClientY(e))}
                    onTouchEnd={() => onDragEnd()}
                    onPointerDown={(e) => {
                        e.preventDefault();
                        onDragStart(e.clientY, e.pointerId);
                        (e.target as HTMLElement).setPointerCapture(e.pointerId);
                    }}
                    onPointerMove={(e) => {
                        if (pointerIdRef.current === e.pointerId) onDragMove(e.clientY);
                    }}
                    onPointerUp={(e) => {
                        if (pointerIdRef.current === e.pointerId) {
                            onDragEnd();
                            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
                        }
                    }}
                />

                <div className="w-16 h-16 mx-auto mb-5 bg-[#7aa06f]/10 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                    <svg
                        className="w-7 h-7 text-[#7aa06f] dark:text-emerald-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.8}
                            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                        />
                    </svg>
                </div>

                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">두나샵</h3>
                <p className="text-[15px] text-gray-500 dark:text-gray-400 leading-relaxed mb-6 break-keep">
                    더 완벽한 키트를 위해 준비 중이에요.
                    <br />
                    조금만 기다려주세요 🎁
                </p>

                <button
                    onClick={onClose}
                    className="w-full py-3.5 rounded-lg text-white text-[15px] font-bold hover:brightness-95 active:scale-[0.96] transition-all flex items-center justify-center gap-2 tracking-tight"
                    style={{ backgroundColor: "#7aa06f" }}
                >
                    확인
                </button>
            </div>
        </div>,
        portalTarget
    );
}
