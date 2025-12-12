"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const GROWTH_PHASES = [
    { min: 0, max: 2, phase: "Germination", level: 1, height: 50, branches: 0, description: "씨앗에서 발아 준비 중" },
    { min: 3, max: 5, phase: "Seedling", level: 2, height: 95, branches: 1, description: "첫 새싹이 돋아났습니다" },
    { min: 6, max: 9, phase: "Sapling", level: 3, height: 150, branches: 2, description: "묘목으로 성장 중" },
    { min: 10, max: 12, phase: "Young Tree", level: 4, height: 210, branches: 3, description: "어린 나무로 발달" },
    { min: 13, max: 14, phase: "Mature", level: 5, height: 270, branches: 4, description: "성숙한 나무" },
    { min: 15, max: 15, phase: "Complete", level: 6, height: 320, branches: 5, description: "완전히 성장한 나무" },
];

export default function GrowthTracker() {
    const router = useRouter();
    const [currentProgress, setCurrentProgress] = useState(0);
    const [waterReserve, setWaterReserve] = useState(0);
    const [notification, setNotification] = useState<string | null>(null);
    const [showResourceAlert, setShowResourceAlert] = useState(false);
    const [gardenUnlocked, setGardenUnlocked] = useState(false);
    const [wateringActive, setWateringActive] = useState(false);
    const [showCompletionScreen, setShowCompletionScreen] = useState(false);
    const [totalCompleted, setTotalCompleted] = useState(0);
    const [showGardenTransition, setShowGardenTransition] = useState(false);
    const TARGET_PROGRESS = 15;

    const getCurrentPhase = () => {
        return GROWTH_PHASES.find((p) => currentProgress >= p.min && currentProgress <= p.max) || GROWTH_PHASES[0];
    };

    useEffect(() => {
        const token = localStorage.getItem("authToken");
        if (!token) {
            router.push("/login?redirect=/forest");
            return;
        }
        fetchData();
    }, [router]);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem("authToken");
            const headers: any = token ? { Authorization: `Bearer ${token}` } : {};

            const [treeRes, gardenRes] = await Promise.all([
                fetch("/api/forest/tree/current", { headers, cache: "no-store" }),
                fetch("/api/garden", { headers, cache: "no-store" }),
            ]);

            const treeData = await treeRes.json().catch(() => ({}));
            const gardenData = await gardenRes.json().catch(() => ({}));

            setCurrentProgress(Number(treeData?.waterCount || 0));
            setWaterReserve(Number(treeData?.userWaterStock ?? 0));
            setGardenUnlocked(Boolean(gardenData?.garden?.isUnlocked));
            setTotalCompleted(Number(gardenData?.garden?.completedTrees || 0));
        } catch {}
    };

    const executeWatering = async () => {
        if (waterReserve <= 0) {
            setShowResourceAlert(true);
            return;
        }

        setWateringActive(true);

        try {
            const token = localStorage.getItem("authToken");
            const headers: any = {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            };

            const response = await fetch("/api/forest/water", {
                method: "POST",
                headers,
                body: JSON.stringify({ source: "admin", amount: 1 }),
            });

            if (!response.ok) {
                setShowResourceAlert(true);
                setWateringActive(false);
                return;
            }

            const result = await response.json().catch(() => ({}));
            const newProgress = Number(result?.waterCount || 0);

            setCurrentProgress(newProgress);
            setWaterReserve((prev) => Math.max(0, prev - 1));

            if (result?.completed) {
                setGardenUnlocked(true);
                setTotalCompleted((prev) => prev + 1);
                setShowCompletionScreen(true);
                setNotification("너의 나무가 완전히 자랐어요 🌳✨");
                setTimeout(() => setNotification(null), 4000);
                // 슬라이드 다운 + 정원 전환
                setShowGardenTransition(true);
                setTimeout(() => {
                    setShowCompletionScreen(false);
                    setShowGardenTransition(false);
                    router.push("/garden");
                }, 3000);
            }

            setTimeout(() => setWateringActive(false), 700);
        } catch {
            setWateringActive(false);
        }
    };

    const phase = getCurrentPhase();
    const completionRate = (currentProgress / TARGET_PROGRESS) * 100;

    return (
        <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #f7faf7 0%, #f9fbf7 40%, #fdf9f6 100%)" }}>
            {/* Navigation */}
            <nav className="border-b border-emerald-100/60 bg-white/75 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full" style={{ background: "radial-gradient(circle at 30% 30%, #ffb4b4, #99c08e)" }} />
                            <h1 className="text-lg font-semibold tracking-tight" style={{ color: "#2f3a2f" }}>나의 숲</h1>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-100 bg-emerald-50/60">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span className="text-sm font-medium text-emerald-800">{waterReserve}</span>
                                <span className="text-xs text-emerald-700/70">물 주기</span>
                            </div>
                            {gardenUnlocked && (
                                <button
                                    onClick={() => router.push("/garden")}
                                    className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                                >
                                    정원 가기
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <div className="max-w-3xl mx-auto px-6 py-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-emerald-100">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold text-emerald-900 tracking-tight">성장도</h3>
                                <span className="text-xs text-emerald-700/70">
                                    {currentProgress}/{TARGET_PROGRESS}
                                </span>
                            </div>

                            <div className="relative h-2 bg-emerald-50 rounded-full overflow-hidden mb-4">
                                <motion.div
                                    className="absolute inset-y-0 left-0"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${completionRate}%`, background: ["#99c08e", "#6db48c", "#99c08e"] }}
                                    transition={{ duration: 0.8, ease: "easeOut" }}
                                />
                            </div>
                            <div className="text-3xl font-bold" style={{ color: "#2f3a2f" }}>{completionRate.toFixed(0)}%</div>
                            <p className="text-sm text-emerald-800/70">완성도</p>
                        </div>

                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-emerald-100">
                            <h3 className="text-sm font-semibold text-emerald-900 tracking-tight mb-4">현재 단계</h3>

                            <div className="space-y-4">
                                <div>
                                    <div className="text-2xl font-bold" style={{ color: "#2f3a2f" }}>{phase.phase}</div>
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-full">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        <span className="text-xs font-medium text-emerald-700">
                                            Level {phase.level}
                                        </span>
                                    </div>
                                </div>

                                <p className="text-sm text-emerald-800/70 leading-relaxed">{phase.description}</p>

                                <div className="pt-4 border-t border-neutral-100">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-neutral-500">Height</span>
                                        <span className="font-medium text-neutral-900">{phase.height}cm</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm mt-2">
                                        <span className="text-neutral-500">Branches</span>
                                        <span className="font-medium text-neutral-900">{phase.branches}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm mt-2">
                                        <span className="text-neutral-500">Completed</span>
                                        <span className="font-medium text-neutral-900">{totalCompleted}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={executeWatering}
                            disabled={waterReserve <= 0}
                            className={`w-full py-4 rounded-xl font-semibold transition-all ${
                                waterReserve <= 0
                                    ? "bg-emerald-100 text-emerald-400 cursor-not-allowed"
                                    : "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98] shadow-lg"
                            }`}
                        >
                            {waterReserve <= 0 ? "물이 부족해요" : "물 주기"}
                        </button>
                    </div>

                    <div className="md:col-span-1">
                        <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden h-[520px] relative">
                            {/* Background Grid */}
                            <div
                                className="absolute inset-0 opacity-[0.03]"
                                style={{
                                    backgroundImage:
                                        "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)",
                                    backgroundSize: "40px 40px",
                                }}
                            />

                            {/* Gradient Background */}
                            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #eef6ef 0%, #f7faf7 50%, #fff 100%)" }} />

                            {/* Ground */}
                            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-stone-200/40 to-transparent" />

                            {/* Tree Visualization */}
                            <div className="absolute inset-0 flex items-end justify-center pb-24">
                                <motion.div
                                    key={currentProgress}
                                    initial={{ scale: 0.85, opacity: 0 }}
                                    animate={{
                                        scale: wateringActive ? 1.05 : 1,
                                        opacity: 1,
                                    }}
                                    transition={{
                                        scale: { duration: 0.4 },
                                        opacity: { duration: 0.6 },
                                    }}
                                    className="relative"
                                    style={{
                                        width: phase.height * 1.2,
                                        height: phase.height,
                                    }}
                                >
                                    {/* Trunk */}
                                    <div
                                        className="absolute bottom-0 left-1/2 -translate-x-1/2 transition-all duration-1000 ease-out"
                                        style={{
                                            width: Math.max(16, phase.height * 0.12),
                                            height: phase.height * 0.55,
                                            background: "linear-gradient(180deg, #8b6f5a 0%, #705846 50%, #5a4639 100%)",
                                            borderRadius: "4px 4px 0 0",
                                            boxShadow:
                                                "0 10px 40px rgba(0,0,0,0.08), inset 0 2px 4px rgba(255,255,255,0.1)",
                                        }}
                                    />

                                    {/* Canopy - Multiple Layers */}
                                    {phase.branches >= 1 && (
                                        <motion.div
                                            initial={{ scale: 0, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            transition={{ delay: 0.2, duration: 0.8 }}
                                            className="absolute transition-all duration-1000"
                                            style={{
                                                width: phase.height * 0.7,
                                                height: phase.height * 0.7,
                                                left: "50%",
                                                top: phase.height * 0.05,
                                                transform: "translateX(-50%)",
                                                background: "radial-gradient(ellipse at center, #a7d3b0 0%, #99c08e 45%, #6db48c 100%)",
                                                borderRadius: "50%",
                                                boxShadow:
                                                    "0 20px 60px rgba(34, 197, 94, 0.15), inset 0 -10px 20px rgba(0,0,0,0.1)",
                                                filter: "blur(0.5px)",
                                            }}
                                        />
                                    )}

                                    {phase.branches >= 2 && (
                                        <>
                                            <motion.div
                                                initial={{ scale: 0, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                transition={{ delay: 0.3, duration: 0.8 }}
                                                className="absolute transition-all duration-1000"
                                                style={{
                                                    width: phase.height * 0.5,
                                                    height: phase.height * 0.5,
                                                    left: "15%",
                                                    top: phase.height * 0.2,
                                                    background: "radial-gradient(ellipse at 40% 40%, #a7d3b0 0%, #99c08e 50%, #6db48c 100%)",
                                                    borderRadius: "50%",
                                                    boxShadow: "0 15px 40px rgba(34, 197, 94, 0.12)",
                                                    filter: "blur(0.5px)",
                                                }}
                                            />
                                            <motion.div
                                                initial={{ scale: 0, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                transition={{ delay: 0.35, duration: 0.8 }}
                                                className="absolute transition-all duration-1000"
                                                style={{
                                                    width: phase.height * 0.5,
                                                    height: phase.height * 0.5,
                                                    right: "15%",
                                                    top: phase.height * 0.2,
                                                    background: "radial-gradient(ellipse at 60% 40%, #a7d3b0 0%, #99c08e 50%, #6db48c 100%)",
                                                    borderRadius: "50%",
                                                    boxShadow: "0 15px 40px rgba(34, 197, 94, 0.12)",
                                                    filter: "blur(0.5px)",
                                                }}
                                            />
                                        </>
                                    )}

                                    {phase.branches >= 4 && (
                                        <>
                                            <motion.div
                                                initial={{ scale: 0, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                transition={{ delay: 0.4, duration: 0.8 }}
                                                className="absolute transition-all duration-1000"
                                                style={{
                                                    width: phase.height * 0.35,
                                                    height: phase.height * 0.35,
                                                    left: "5%",
                                                    top: phase.height * 0.35,
                                                    background: "radial-gradient(ellipse, #a7d3b0 0%, #99c08e 60%, #6db48c 100%)",
                                                    borderRadius: "50%",
                                                    boxShadow: "0 10px 30px rgba(34, 197, 94, 0.1)",
                                                    filter: "blur(0.5px)",
                                                }}
                                            />
                                            <motion.div
                                                initial={{ scale: 0, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                transition={{ delay: 0.45, duration: 0.8 }}
                                                className="absolute transition-all duration-1000"
                                                style={{
                                                    width: phase.height * 0.35,
                                                    height: phase.height * 0.35,
                                                    right: "5%",
                                                    top: phase.height * 0.35,
                                                    background: "radial-gradient(ellipse, #a7d3b0 0%, #99c08e 60%, #6db48c 100%)",
                                                    borderRadius: "50%",
                                                    boxShadow: "0 10px 30px rgba(34, 197, 94, 0.1)",
                                                    filter: "blur(0.5px)",
                                                }}
                                            />
                                        </>
                                    )}

                                    {/* Water Particles */}
                                    <AnimatePresence>
                                        {wateringActive && (
                                            <>
                                                {[...Array(6)].map((_, i) => (
                                                    <motion.div
                                                        key={i}
                                                        initial={{ scale: 0, x: 0, y: 0, opacity: 0 }}
                                                        animate={{
                                                            scale: [0, 1.2, 0],
                                                            x: Math.cos((i * 60 * Math.PI) / 180) * 90,
                                                            y: Math.sin((i * 60 * Math.PI) / 180) * 90,
                                                            opacity: [0, 0.7, 0],
                                                        }}
                                                        exit={{ opacity: 0 }}
                                                        transition={{ duration: 0.8, ease: "easeOut" }}
                                                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                                                        style={{
                                                            width: 18,
                                                            height: 18,
                                                            borderRadius: 8,
                                                            background: "radial-gradient(circle, #ffb4b4 0%, #99c08e 100%)",
                                                            boxShadow: "0 0 20px rgba(153, 192, 142, 0.35)",
                                                            transform: "rotate(45deg)",
                                                        }}
                                                    />
                                                ))}
                                            </>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            </div>

                            {/* Stats Overlay */}
                            <div className="absolute top-6 left-6">
                                <div className="bg-white/80 backdrop-blur-sm rounded-xl px-4 py-3 border border-emerald-100 shadow-sm">
                                    <div className="text-xs text-emerald-700/70 mb-1">성장 지표</div>
                                    <div className="text-2xl font-bold" style={{ color: "#2f3a2f" }}>
                                        {phase.height}
                                        <span className="text-sm text-emerald-700/70 font-normal ml-1">cm</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Notification Toast */}
            <AnimatePresence>
                {notification && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="fixed bottom-8 right-8 z-[1100] text-white px-6 py-4 rounded-xl shadow-2xl border max-w-sm"
                        style={{ background: "linear-gradient(135deg, #99c08e, #6db48c)", borderColor: "#a7d3b0" }}
                    >
                        <div className="flex items-start gap-3">
                            <div className="w-2 h-2 rounded-full bg-white/80 mt-1.5" />
                            <div>
                                <div className="font-semibold text-sm mb-1">💖 작은 성장이 이루어졌어요</div>
                                <div className="text-sm text-neutral-300">{notification}</div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Completion Modal */}
            <AnimatePresence>
                {showCompletionScreen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[1300] bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-6"
                    >
                        <motion.div
                            initial={{ y: -30, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ type: "spring", damping: 25 }}
                            className="bg-white rounded-3xl p-10 max-w-md w-full shadow-2xl border border-emerald-100"
                        >
                            <div className="text-center">
                                <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center shadow-lg"
                                     style={{ background: "linear-gradient(135deg, #ffb4b4, #99c08e)" }}>
                                    <svg
                                        className="w-10 h-10 text-white"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2.5}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                </div>

                                <h2 className="text-2xl font-bold mb-2" style={{ color: "#2f3a2f" }}>너의 나무가 완전히 자랐어요 🌳✨</h2>

                                <p className="text-emerald-800/70 mb-2">#{totalCompleted}번째 나무가 자라났어요!</p>

                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-full mt-4">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <span className="text-sm font-medium text-emerald-700">정원으로 이동 중...</span>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Garden slide transition */}
            <AnimatePresence>
                {showGardenTransition && (
                    <motion.div
                        initial={{ y: "-100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ duration: 0.8, ease: "easeInOut" }}
                        className="fixed inset-0 z-[1400]"
                        style={{ background: "linear-gradient(180deg, #eef6ef 0%, #fff 100%)" }}
                    />
                )}
            </AnimatePresence>

            {/* Resource Alert */}
            {showResourceAlert && (
                <div className="fixed inset-0 z-[1200] bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-6">
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
                    >
                        <div className="px-8 py-6 border-b border-neutral-100">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-neutral-900">Insufficient Resources</h3>
                                <button
                                    onClick={() => setShowResourceAlert(false)}
                                    className="w-8 h-8 rounded-lg hover:bg-neutral-100 flex items-center justify-center transition-colors"
                                >
                                    <svg
                                        className="w-5 h-5 text-neutral-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div className="px-8 py-6">
                            <p className="text-neutral-600 mb-6 leading-relaxed">
                                Complete courses or challenges to acquire additional water resources.
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => router.push("/courses")}
                                    className="py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-medium transition-colors"
                                >
                                    View Courses
                                </button>
                                <button
                                    onClick={() => router.push("/escape")}
                                    className="py-3 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-900 font-medium transition-colors"
                                >
                                    Challenges
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
