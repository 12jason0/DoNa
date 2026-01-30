"use client";

import React, { useEffect, useState } from "react";
import { getS3StaticUrl } from "@/lib/s3Static";

export default function DonaSplashFinal({ onDone }: { onDone?: () => void }) {
    const [fadeOut, setFadeOut] = useState(false);
    const [step, setStep] = useState(0);

    useEffect(() => {
        // 모바일에서 주소창/당김 새로고침 등으로 인한 레이아웃 이동 방지: 스크롤 락
        const html = document.documentElement;
        const body = document.body;
        const prevHtmlOverflow = html.style.overflow;
        const prevHtmlHeight = html.style.height;
        const prevHtmlOverscroll = html.style.getPropertyValue("overscroll-behavior");
        const prevBodyOverflow = body.style.overflow;
        const prevBodyHeight = body.style.height;
        const prevBodyOverscroll = body.style.getPropertyValue("overscroll-behavior");
        const prevBodyTouchAction = body.style.getPropertyValue("touch-action");

        html.style.overflow = "hidden";
        html.style.height = "100%";
        html.style.setProperty("overscroll-behavior", "none");
        body.style.overflow = "hidden";
        body.style.height = "100%";
        body.style.setProperty("overscroll-behavior", "none");
        body.style.setProperty("touch-action", "none");

        // 🟢 타이밍 조정 (총 4초 노출, 6초→4초 비율 유지)
        const timeline = [
            { delay: 70, action: () => setStep(1) },
            { delay: 270, action: () => setStep(2) },
            { delay: 530, action: () => setStep(3) },
            { delay: 870, action: () => setStep(4) },
            { delay: 1330, action: () => setStep(5) },
            { delay: 2000, action: () => setStep(6) }, // 로고 등장
            { delay: 3330, action: () => setFadeOut(true) }, // 페이드아웃 시작
            { delay: 4000, action: () => onDone?.() }, // 완전 종료 (4초)
        ];
        const timers = timeline.map(({ delay, action }) => setTimeout(action, delay));
        return () => {
            timers.forEach(clearTimeout);
            // 🟢 스크롤 락 해제 (스플래시 종료 시)
            html.style.overflow = prevHtmlOverflow;
            if (prevHtmlHeight) html.style.height = prevHtmlHeight;
            else html.style.removeProperty("height");
            if (prevHtmlOverscroll) html.style.setProperty("overscroll-behavior", prevHtmlOverscroll);
            else html.style.removeProperty("overscroll-behavior");
            body.style.overflow = prevBodyOverflow;
            if (prevBodyHeight) body.style.height = prevBodyHeight;
            else body.style.removeProperty("height");
            if (prevBodyOverscroll) body.style.setProperty("overscroll-behavior", prevBodyOverscroll);
            else body.style.removeProperty("overscroll-behavior");
            if (prevBodyTouchAction) body.style.setProperty("touch-action", prevBodyTouchAction);
            else body.style.removeProperty("touch-action");
        };
    }, [onDone]);

    // 🟢 fadeOut 시작 시 스크롤 락을 미리 해제하여 콘텐츠가 바로 보이도록
    useEffect(() => {
        if (fadeOut) {
            const html = document.documentElement;
            const body = document.body;
            html.style.overflow = "";
            html.style.removeProperty("height");
            html.style.removeProperty("overscroll-behavior");
            body.style.overflow = "";
            body.style.removeProperty("height");
            body.style.removeProperty("overscroll-behavior");
            body.style.removeProperty("touch-action");
        }
    }, [onDone]);

    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: "100vw",
                height: "100vh",
                minHeight: "100dvh", // 🟢 동적 뷰포트 높이 지원
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#7FCC9F", // 🟢 스플래시는 항상 라이트 모드 색상 유지
                transition: "opacity 1s ease",
                opacity: fadeOut ? 0 : 1,
                zIndex: 9999,
                overscrollBehavior: "none",
                touchAction: "none",
                // 🟢 상태표시줄까지 덮기 위한 추가 설정
                margin: 0,
                padding: 0,
            }}
        >
            {/* 🟢 상단 safe area 영역 (스플래시 배경색과 동일) */}
            <div 
                className="absolute top-0 left-0 right-0 z-10"
                style={{ 
                    height: "env(safe-area-inset-top, 0)",
                    backgroundColor: "#7FCC9F",
                }}
            />
            
            {/* 🟢 하단 safe area 영역 (안드로이드 네비게이션 바, 스플래시 배경색과 동일) */}
            <div 
                className="absolute bottom-0 left-0 right-0 z-10"
                style={{ 
                    height: "env(safe-area-inset-bottom, 0)",
                    backgroundColor: "#7FCC9F",
                }}
            />
            
            {/* 지도 배경 그리드 */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    opacity: step >= 2 ? 0.15 : 0,
                    transform: step >= 2 ? "scale(1)" : "scale(0.9)",
                    transition: "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
                    background:
                        "repeating-linear-gradient(0deg, rgba(255,255,255,0.3) 0px, rgba(255,255,255,0.3) 1px, transparent 1px, transparent 50px), repeating-linear-gradient(90deg, rgba(255,255,255,0.3) 0px, rgba(255,255,255,0.3) 1px, transparent 1px, transparent 50px)",
                }}
            />

            {/* 지도 위 핀들과 경로 */}
            <div style={{ position: "relative", width: "340px", height: "420px" }}>
                {/* 핀 1 - 하트 (출발) */}
                {step >= 3 && (
                    <div
                        style={{
                            position: "absolute",
                            left: "50px",
                            top: "80px",
                            animation: "pinDrop 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards",
                        }}
                    >
                        <div
                            style={{
                                width: "50px",
                                height: "50px",
                                background: "#FF8DA1",
                                borderRadius: "50% 50% 50% 0",
                                transform: "rotate(-45deg)",
                                border: "3px solid white",
                                boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <span style={{ transform: "rotate(45deg)", fontSize: "24px" }}>💕</span>
                        </div>
                        <div
                            style={{
                                marginTop: "6px",
                                transform: "translateX(8px)",
                                fontSize: "13px",
                                fontWeight: 600,
                                color: "white",
                                textShadow: "0 2px 4px rgba(0,0,0,0.2)",
                            }}
                        >
                            출발
                        </div>
                    </div>
                )}

                {/* 핀 2 - 나무 (중간) */}
                {step >= 4 && (
                    <div
                        style={{
                            position: "absolute",
                            left: "160px",
                            top: "200px",
                            animation: "pinDrop 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards",
                        }}
                    >
                        <div
                            style={{
                                width: "50px",
                                height: "50px",
                                background: "#F5DEB3",
                                borderRadius: "50% 50% 50% 0",
                                transform: "rotate(-45deg)",
                                border: "3px solid white",
                                boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <span style={{ transform: "rotate(45deg)", fontSize: "24px" }}>🌳</span>
                        </div>
                        <div
                            style={{
                                marginTop: "6px",
                                transform: "translateX(-2px)",
                                fontSize: "13px",
                                fontWeight: 600,
                                color: "white",
                                textShadow: "0 2px 4px rgba(0,0,0,0.2)",
                            }}
                        >
                            데이트
                        </div>
                    </div>
                )}

                {/* 핀 3 - 하트 (도착) */}
                {step >= 5 && (
                    <div
                        style={{
                            position: "absolute",
                            left: "250px",
                            top: "120px",
                            animation: "pinDrop 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards",
                        }}
                    >
                        <div
                            style={{
                                width: "50px",
                                height: "50px",
                                background: "#FF6B7A",
                                borderRadius: "50% 50% 50% 0",
                                transform: "rotate(-45deg)",
                                border: "3px solid white",
                                boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <span style={{ transform: "rotate(45deg)", fontSize: "24px" }}>💖</span>
                        </div>
                        <div
                            style={{
                                marginTop: "6px",
                                transform: "translateX(8px)",
                                fontSize: "13px",
                                fontWeight: 600,
                                color: "white",
                                textShadow: "0 2px 4px rgba(0,0,0,0.2)",
                            }}
                        >
                            도착
                        </div>
                    </div>
                )}

                {/* DoNa 로고 */}
                {step >= 6 && (
                    <div
                        style={{
                            position: "absolute",
                            left: "50%",
                            top: "50%",
                            transform: "translate(-50%, -50%)",
                            animation: "logoAppear 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
                            textAlign: "center",
                        }}
                    >
                        <div
                            style={{
                                background: "rgba(255, 255, 255, 0.98)",
                                backdropFilter: "blur(12px)",
                                padding: "24px 28px",
                                borderRadius: "28px",
                                boxShadow: "0 25px 70px rgba(0,0,0,0.2)",
                            }}
                        >
                            <img
                                src={getS3StaticUrl("logo/donalogo_512.png")}
                                alt="DoNa"
                                style={{ width: "300px", height: "auto", margin: "0 auto 12px", display: "block" }}
                            />
                            <p style={{ fontSize: 16, color: "#7FCC9F", margin: 0, fontWeight: 600 }}>
                                나만의 특별한 순간을 기록하세요
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes pinDrop {
                    0% { transform: translateY(-120px) scale(0) rotate(0deg); opacity: 0; }
                    60% { transform: translateY(8px) scale(1.15) rotate(5deg); opacity: 1; }
                    80% { transform: translateY(-3px) scale(0.95) rotate(-2deg); }
                    100% { transform: translateY(0) scale(1) rotate(0deg); opacity: 1; }
                }
                @keyframes logoAppear {
                    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.7) rotate(-5deg); }
                    70% { transform: translate(-50%, -50%) scale(1.05) rotate(2deg); }
                    100% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0deg); }
                }
            `}</style>
        </div>
    );
}
