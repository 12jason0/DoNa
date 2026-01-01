"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import FrameRenderer from "@/components/FrameRenderer";
import { useSearchParams, useRouter } from "next/navigation";
import dynamicImport from "next/dynamic";
import imageCompression from "browser-image-compression";
import JongroMapFinalExact from "@/components/JongroMapFinalExact";
import { getS3StaticUrl } from "@/lib/s3Static";
function EpilogueFromDB({
    storyId,
    step,
    onNext,
    onComplete,
}: {
    storyId: number;
    step: number;
    onNext: () => void;
    onComplete: () => void;
}) {
    const [lines, setLines] = React.useState<string[] | null>(null);
    const [dialogues, setDialogues] = React.useState<DialogueMessage[] | null>(null);
    React.useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const res = await fetch(`/api/escape/outro?storyId=${storyId}`, { cache: "no-store" });
                const data = await res.json();
                if (!alive) return;
                const arr = Array.isArray(data?.messages)
                    ? (data.messages as any[]).map((m) => {
                          const raw = String(m?.text || "");
                          const normalized = raw.replace(/\\n/g, "\n"); // '\n' 리터럴을 실제 줄바꿈으로
                          return {
                              speaker: String(m?.speaker || ""),
                              role: String(m?.role || ""),
                              text: normalized,
                          };
                      })
                    : [];
                if (arr.length > 0) {
                    setDialogues(arr as any);
                } else {
                    setLines(["오늘의 편지를 잘 전했어요.", "이제 앨범에서 추억을 골라 템플릿를 완성해 볼까요?"]);
                }
            } catch {
                if (!alive) return;
                setLines(["오늘의 편지를 잘 전했어요.", "이제 앨범에서 추억을 골라 템플릿를 완성해 볼까요?"]);
            }
        })();
        return () => {
            alive = false;
        };
    }, [storyId]);

    if (!lines && !dialogues) return null;
    return (
        <DialogueFlow
            messages={
                dialogues && dialogues.length
                    ? (dialogues as any)
                    : (lines || []).map((t) => ({ text: t, speaker: "narrator" } as any))
            }
            step={step}
            onNext={onNext}
            onComplete={onComplete}
            letterMode
        />
    );
}

// --- 간단한 Webtoon 인트로 렌더러(1차 연결용) ---
function WebtoonIntro({ tokens, flow, onComplete }: { tokens?: any; flow?: any; onComplete: () => void }) {
    const scenes = Array.isArray(flow?.scenes) ? flow.scenes : [];
    const shouldSkip = !scenes || scenes.length === 0;
    React.useEffect(() => {
        if (!shouldSkip) return;
        const timer = setTimeout(() => onComplete(), 100);
        return () => clearTimeout(timer);
    }, [shouldSkip, onComplete]);
    if (shouldSkip) {
        return null;
    }
    return (
        <div className="fixed inset-0 z-[1400] bg-black/60 flex items-start justify-center p-4 animate-fade-in overflow-y-auto">
            <div className="w-full max-w-3xl bg-white/95 rounded-2xl shadow-lg border overflow-hidden">
                <div className="p-4 md:p-6 space-y-4">
                    {scenes.map((scene: any, si: number) => {
                        const panels = Array.isArray(scene?.panels) ? scene.panels : [];
                        return (
                            <div key={si} className="space-y-3">
                                {panels.map((p: any, pi: number) => {
                                    const bgImg = p?.bg?.image as string | undefined;
                                    const narration = Array.isArray(p?.balloons)
                                        ? p.balloons
                                              .filter((b: any) => b?.type === "narration")
                                              .map((b: any) => String(b?.text || ""))
                                              .join("\n")
                                        : undefined;
                                    const speech = Array.isArray(p?.balloons)
                                        ? p.balloons
                                              .filter((b: any) => b?.type === "speech")
                                              .map((b: any) => String(b?.text || ""))
                                              .join("\n")
                                        : undefined;
                                    return (
                                        <div
                                            key={pi}
                                            className="relative rounded-xl overflow-hidden border bg-gray-50"
                                            style={{ minHeight: 180 }}
                                        >
                                            {bgImg ? (
                                                <img
                                                    src={bgImg}
                                                    alt=""
                                                    className="absolute inset-0 w-full h-full object-cover"
                                                />
                                            ) : null}
                                            <div className="absolute inset-0 bg-black/20" />
                                            <div className="relative p-4 space-y-2">
                                                {narration ? (
                                                    <div className="inline-block bg-white/85 rounded-xl px-3 py-2 text-gray-900 shadow">
                                                        {narration}
                                                    </div>
                                                ) : null}
                                                {speech ? (
                                                    <div className="inline-block bg-blue-100 rounded-xl px-3 py-2 text-[#0F2B46] border border-blue-200">
                                                        {speech}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                    <div className="text-right">
                        <button
                            onClick={onComplete}
                            className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow"
                        >
                            계속
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- 웹툰 스크롤 → 맵 UI 렌더러 ---
function WebtoonScrollToMap({
    tokens,
    flow,
    onComplete,
    backgroundImage,
}: {
    tokens?: any;
    flow?: any;
    onComplete: () => void;
    backgroundImage?: string | null;
}) {
    type ChatMsg = { type: "npc" | "me" | "system"; text: string };
    const [messages, setMessages] = React.useState<ChatMsg[]>([]);
    const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
    const [selectedPlace, setSelectedPlace] = React.useState<any | null>(null);
    const [showMap, setShowMap] = React.useState<boolean>(false);
    const mapTriggerRef = React.useRef<HTMLDivElement | null>(null);
    const bgUrl = backgroundImage ? String(backgroundImage) : "";

    const introIds: number[] = React.useMemo(() => {
        const idsFromFlow =
            (Array.isArray(flow?.intro) && Array.isArray(flow.intro[0]?.ids) && flow.intro[0].ids) ||
            (Array.isArray(flow?.ids) && flow.ids) ||
            [];
        return (idsFromFlow as any[]).map((v) => Number(v)).filter((n) => Number.isFinite(n));
    }, [flow]);

    // scenes → 메시지 폴백 생성기
    const fallbackMessagesFromScenes: ChatMsg[] = React.useMemo(() => {
        const scenes = Array.isArray(flow?.scenes) ? flow.scenes : [];
        if (!scenes.length) return [];
        const first = scenes[0];
        const panels = Array.isArray(first?.panels) ? first.panels : [];
        const msgs: ChatMsg[] = [];
        for (const panel of panels) {
            const balloons = Array.isArray(panel?.balloons) ? panel.balloons : [];
            for (const b of balloons) {
                const rawType = String(b?.type || "").toLowerCase();
                const text = String(b?.text || "")
                    .replace(/\\n/g, "\n")
                    .trim();
                if (!text) continue;
                let type: ChatMsg["type"] = "npc";
                if (rawType === "system") type = "system";
                else if (rawType === "speech") type = "me";
                else type = "npc"; // narration 등은 npc 버블로
                msgs.push({ type, text });
            }
        }
        return msgs;
    }, [flow]);

    React.useEffect(() => {
        // ids가 있으면 우선 API에서 로드, 없으면 scenes 폴백 사용
        if (!introIds.length) {
            setMessages(fallbackMessagesFromScenes);
            return;
        }
        (async () => {
            try {
                const res = await fetch(`/api/escape/messages?ids=${introIds.join(",")}`, { cache: "no-store" });
                const data = await res.json().catch(() => ({}));
                const list = Array.isArray(data?.messages) ? data.messages : [];
                // placeId가 있는 메시지는 placeStory → 인트로에서 제외
                const onlyIntro = list.filter(
                    (m: any) => !m?.placeId && String(m?.type || "").toLowerCase() !== "place"
                );
                let mapped: ChatMsg[] = onlyIntro.map((m: any) => {
                    const raw = String(m?.text ?? "");
                    const normalized = raw.replace(/\\n/g, "\n");
                    const role = String(m?.role ?? "").toLowerCase();
                    const type: "npc" | "me" | "system" =
                        role === "system" ? "system" : role === "user" || role === "me" ? "me" : "npc";
                    return { type, text: normalized };
                });
                if (mapped.length === 0 && fallbackMessagesFromScenes.length > 0) {
                    mapped = fallbackMessagesFromScenes;
                }
                setMessages(mapped);
            } catch {
                setMessages(fallbackMessagesFromScenes);
            }
        })();
    }, [introIds, fallbackMessagesFromScenes]);

    React.useEffect(() => {
        const obs = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) setShowMap(true);
            },
            { threshold: 0.1 }
        );
        const el = mapTriggerRef.current;
        if (el) obs.observe(el);
        return () => {
            if (el) obs.unobserve(el);
        };
    }, []);

    const categories: any[] = React.useMemo(() => {
        if (Array.isArray(flow?.places)) return flow.places;
        if (Array.isArray(flow?.categories)) return flow.categories;
        return [];
    }, [flow]);

    const title = String(tokens?.title || flow?.title || "");
    const subtitle = String(tokens?.subtitle || flow?.subtitle || "");

    const nl2br = (text: string) =>
        text.split("\n").map((line, i) => (
            <span key={i}>
                {line}
                <br />
            </span>
        ));

    const selectedCategoryData = React.useMemo(
        () => categories.find((c: any) => String(c?.id) === String(selectedCategory)),
        [categories, selectedCategory]
    );

    return (
        <div className="fixed inset-0 z-[1400]">
            {bgUrl ? (
                <>
                    <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${bgUrl})` }} />
                    <div className="absolute inset-0 bg-linear-to-b from-black/60 to-black/20" />
                </>
            ) : (
                <div className="absolute inset-0 bg-black/60" />
            )}
            <div className="absolute inset-0 flex items-end justify-center p-4 pb-[12vh] animate-fade-in overflow-y-auto">
                <div className="w-full max-w-lg rounded-xl overflow-hidden">
                    <div className="bg-white/95 rounded-t-2xl p-5 max-h-[70vh] overflow-y-auto space-y-4">
                        <header className="text-center mb-6 pt-4 pb-3 border-b border-[#c8aa64]">
                            {title ? (
                                <h1 className="font-serif text-2xl text-[#c8aa64] tracking-wide font-bold">{title}</h1>
                            ) : null}
                            {subtitle ? <h2 className="font-serif text-sm text-[#8b8070] mt-2">{subtitle}</h2> : null}
                        </header>
                        <div className="space-y-4">
                            {messages.map((msg, index) => {
                                const isTriggerMessage = index === messages.length - 5;
                                return (
                                    <div key={index}>
                                        {isTriggerMessage ? (
                                            <div ref={mapTriggerRef} className="h-px invisible" />
                                        ) : null}
                                        <div
                                            className={
                                                msg.type === "system"
                                                    ? "flex justify-center my-6"
                                                    : msg.type === "me"
                                                    ? "flex justify-end pr-2"
                                                    : "flex justify-start pl-2"
                                            }
                                        >
                                            {msg.type === "system" ? (
                                                <div className="w-[90%] bg-[rgba(200,170,100,0.08)] border-2 border-[#c8aa64] p-4 text-center outline-[3px] outline-double outline-[rgba(200,170,100,0.3)] outline-offset-[-8px]">
                                                    <div className="font-serif text-[#c8aa64] font-bold whitespace-pre-wrap">
                                                        {nl2br(msg.text)}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div
                                                    className={
                                                        msg.type === "me"
                                                            ? "max-w-[80%] px-4 py-3 rounded-xl bg-[#3a3530] text-[#d4a574] italic border border-[#5a5450] shadow"
                                                            : "max-w-[80%] px-4 py-3 rounded-xl bg-[#f5e6d3] text-[#3a3530] border border-[#d4a574] shadow"
                                                    }
                                                >
                                                    <div className="leading-7 text-[0.95rem]">{nl2br(msg.text)}</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="h-10" />
                    </div>

                    <div className="bg-white/95 rounded-b-2xl p-4 text-right border-t">
                        <button
                            onClick={onComplete}
                            className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow font-medium"
                        >
                            계속
                        </button>
                    </div>
                </div>
            </div>

            {/* 맵 섹션 (오버레이) */}
            <div className="absolute inset-0" style={{ display: showMap && categories.length > 0 ? "block" : "none" }}>
                <div className="absolute inset-0 max-w-[500px] mx-auto">
                    {selectedCategory || selectedPlace ? (
                        <button
                            className="absolute top-8 left-8 z-50 bg-[rgba(200,170,100,0.2)] border-2 border-[#c8aa64] text-[#c8aa64] px-4 py-2 rounded"
                            onClick={() => {
                                setSelectedCategory(null);
                                setSelectedPlace(null);
                            }}
                        >
                            ← 뒤로
                        </button>
                    ) : null}

                    {/* 배경 이미지 */}
                    <div
                        className="absolute inset-0"
                        style={{
                            backgroundImage: `url('${getS3StaticUrl("escape/jongro/jongroMap.png")}')`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                        }}
                    />

                    {/* 마커 */}
                    {!selectedCategory && (
                        <div className="absolute inset-0 z-10">
                            {categories.map((category: any) => (
                                <button
                                    key={String(category?.id)}
                                    className="absolute -translate-x-1/2 -translate-y-full"
                                    style={{
                                        top: category?.position?.top || "50%",
                                        left: category?.position?.left || "50%",
                                    }}
                                    onClick={() => setSelectedCategory(String(category?.id))}
                                    title={String(category?.label || category?.name || "")}
                                >
                                    <div className="w-10 h-12 rounded-[60%_60%_70%_70%] bg-linear-to-br from-red-500 via-orange-500 to-red-500 shadow-[0_0_25px_rgba(255,68,68,0.85),0_0_50px_rgba(255,68,68,0.4),inset_-8px_-8px_15px_rgba(0,0,0,0.4),inset_8px_2px_15px_rgba(255,255,200,0.35)]" />
                                    <div className="mt-1 text-xs font-bold text-[#c8aa64] bg-black/60 px-2 py-0.5 rounded border border-[rgba(200,170,100,0.3)]">
                                        {String(category?.label || category?.name || "")}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* 카테고리 팝업 */}
                    {selectedCategory && !selectedPlace && (
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[88%] max-w-[360px] bg-linear-to-br from-[#3a3530] to-[#4a4440] border-4 border-[#c8aa64] rounded-xl z-50 shadow-2xl overflow-hidden">
                            <button
                                className="absolute right-3 top-3 w-7 h-7 rounded-full bg-black/30 border border-[#c8aa64] text-[#c8aa64]"
                                onClick={() => setSelectedCategory(null)}
                            >
                                ✕
                            </button>
                            <div className="p-6 relative">
                                <div className="absolute inset-0 m-4 border-2 border-[#c8aa64] rounded pointer-events-none opacity-50" />
                                <h2 className="text-center text-xl font-serif text-[#c8aa64] font-bold">
                                    {String(selectedCategoryData?.name || "")}{" "}
                                    {String(selectedCategoryData?.icon || "")}
                                </h2>
                                <p className="text-center text-sm text-[#c8aa64] mt-2">
                                    {String(selectedCategoryData?.label || "")}
                                </p>
                                <p className="text-center text-sm text-[#8b8070] mt-2">
                                    {String(selectedCategoryData?.description || "")}
                                </p>
                                <button className="mt-3 w-full bg-linear-to-r from-[#d4af37] to-[#daa520] text-[#2a2620] py-3 rounded font-serif font-bold">
                                    이곳으로 가기
                                </button>
                                <div className="grid grid-cols-2 gap-2 mt-3">
                                    {(selectedCategoryData?.places || []).map((place: any, idx: number) => (
                                        <button
                                            key={idx}
                                            className="py-2 bg-[rgba(200,170,100,0.08)] border border-[#5a5450] rounded text-[#c8aa64]"
                                            onClick={() => setSelectedPlace(place)}
                                        >
                                            <span className="text-base text-[#ff6b35] font-bold mr-2">{idx + 1}</span>
                                            <span className="text-xs text-[#8b8070]">{String(place?.name || "")}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 장소 상세 */}
                    {selectedPlace && (
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[88%] max-w-[330px] bg-linear-to-br from-[#3a3530] to-[#4a4440] border-4 border-[#c8aa64] rounded-xl z-50 shadow-2xl overflow-hidden">
                            <button
                                className="px-6 py-4 text-[#c8aa64] font-serif"
                                onClick={() => setSelectedPlace(null)}
                            >
                                ← 돌아가기
                            </button>
                            <div className="p-6">
                                <h3 className="text-center text-xl font-serif text-[#c8aa64] font-bold">
                                    {String(selectedPlace?.name || "")}
                                </h3>
                                <p className="text-center text-sm text-[#8b8070] mt-2">
                                    {String(selectedPlace?.description || "")}
                                </p>
                                <div className="mt-3 bg-[rgba(200,170,100,0.1)] p-4 border-l-[3px] border-[#c8aa64] rounded text-sm text-[#c8aa64]">
                                    {String(selectedPlace?.story || "")
                                        .split("\n")
                                        .map((line: string, idx: number) => (
                                            <div key={idx}>{line}</div>
                                        ))}
                                </div>
                                <button className="mt-4 w-full bg-linear-to-r from-[#d4af37] to-[#daa520] text-[#2a2620] py-3 rounded font-serif font-bold">
                                    이 장소 선택하기
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// --- Letter 엔진 어댑터(메시지 id → DB 조회 → DialogueFlow 재사용) ---
function LetterIntro({ flow, onComplete }: { flow: any; onComplete: () => void }) {
    const [messages, setMessages] = React.useState<DialogueMessage[] | null>(null);
    React.useEffect(() => {
        // flow 형태 호환: { ids:[] } | { flow:[{ids:[]}, ...] } | { intro:[{ids:[]}, ...] }
        const idsFromFlow =
            (Array.isArray(flow?.ids) && flow.ids) ||
            (Array.isArray(flow?.flow) && Array.isArray(flow.flow[0]?.ids) && flow.flow[0].ids) ||
            (Array.isArray(flow?.intro) && Array.isArray(flow.intro[0]?.ids) && flow.intro[0].ids) ||
            [];
        const ids = (idsFromFlow as any[]).map((v) => Number(v)).filter((n) => Number.isFinite(n));
        if (!ids || ids.length === 0) {
            onComplete();
            return;
        }
        (async () => {
            try {
                const res = await fetch(`/api/escape/messages?ids=${ids.join(",")}`, { cache: "no-store" });
                const data = await res.json().catch(() => ({}));
                const list = Array.isArray(data?.messages) ? data.messages : [];
                const mapped: DialogueMessage[] = list.map((m: any) => {
                    const raw = String(m?.text ?? "");
                    // "\n" 리터럴을 실제 줄바꿈으로 변환
                    const normalized = raw.replace(/\\n/g, "\n");
                    return {
                        speaker: String(m?.speaker ?? ""),
                        text: normalized,
                        role: String(m?.role ?? "").toLowerCase(),
                    };
                });
                setMessages(mapped);
            } catch {
                setMessages([]);
            }
        })();
    }, [flow, onComplete]);

    if (!messages) return <LoadingSpinner />;
    return <DialogueFlow messages={messages} step={0} onNext={() => {}} onComplete={onComplete} letterMode />;
}

// --- 타입 정의 ---
type DialogueMessage = {
    speaker: string;
    text: string;
    role?: string; // user | npc | system (옵션)
};

type Story = {
    id: number;
    title: string;
    synopsis: string;
    imageUrl?: string | null;
    epilogue_text?: any;
};

type StoryChapter = {
    id: number;
    story_id: number;
    chapter_number: number;
    title: string;
    latitude?: number;
    longitude?: number;
    address?: string;
    location_name?: string;
    story_text?: string | DialogueMessage[];
    mission_type?: string;
    mission_payload?: any;
    placeOptions?: Array<{
        id: number;
        name: string;
        address?: string;
        latitude?: number | null;
        longitude?: number | null;
        description?: string;
        imageUrl?: string;
        signature?: string;
    }>;
};

// --- 로딩 컴포넌트 ---
function LoadingSpinner() {
    const [show, setShow] = React.useState(false);
    React.useEffect(() => {
        const t = setTimeout(() => setShow(true), 350); // 0.35s 이후에만 노출 → 체감상 짧게
        return () => clearTimeout(t);
    }, []);
    if (!show) return null;
    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center">
            <div className="absolute inset-0 bg-linear-to-b from-black/70 to-black/50" />
            <p className="relative text-[#c8aa64] font-serif text-lg font-bold tracking-wider drop-shadow">
                이야기를 불러오는 중...
            </p>
        </div>
    );
}

// 로딩 이후 잠깐 보여줄 '시간 되감기' 스플래시
function PostLoadClockSplash({ text = "시간을 거슬러 이동 중..." }: { text?: string }) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        let renderer: any;
        let scene: any;
        let camera: any;
        let stars: any;
        let starGeo: any;
        let clockGroup: any;
        let hourHand: any;
        let minuteHand: any;
        let raf = 0;
        let disposed = false;
        // cleanup 함수를 effect의 return으로 제대로 전달하기 위해 외부 변수에 보관
        let cleanup: (() => void) | null = null;
        (async () => {
            const THREE = await import("three");
            // Scene
            scene = new THREE.Scene();
            scene.fog = new THREE.FogExp2(0x050505, 0.002);
            // Camera
            camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
            camera.position.z = 1;
            camera.rotation.x = Math.PI / 2;
            // Renderer
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(Math.min(2.5, window.devicePixelRatio || 1));
            // 최신 three 타입 대응
            // @ts-ignore
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.2;
            containerRef.current?.appendChild(renderer.domElement);
            // Stars tunnel
            starGeo = new THREE.BufferGeometry();
            const starCount = 6000;
            const posArray = new Float32Array(starCount * 3);
            for (let i = 0; i < starCount * 3; i += 3) {
                const r = Math.random() * 100 + 50;
                const theta = Math.random() * Math.PI * 2;
                posArray[i] = r * Math.cos(theta); // x
                posArray[i + 1] = (Math.random() - 0.5) * 800; // y
                posArray[i + 2] = r * Math.sin(theta); // z
            }
            starGeo.setAttribute("position", new THREE.BufferAttribute(posArray, 3));
            const starSprite = new THREE.TextureLoader().load("https://threejs.org/examples/textures/sprites/disc.png");
            const starMaterial = new THREE.PointsMaterial({
                color: 0xd4af37,
                size: 0.9,
                map: starSprite,
                transparent: true,
                opacity: 0.85,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            });
            stars = new THREE.Points(starGeo, starMaterial);
            scene.add(stars);
            // Minimal clock
            clockGroup = new THREE.Group();
            const ringGeo1 = new THREE.TorusGeometry(16, 0.22, 32, 180);
            const ringMat1 = new THREE.MeshPhysicalMaterial({
                color: 0xd4af37,
                metalness: 1.0,
                roughness: 0.25,
                clearcoat: 0.6,
                clearcoatRoughness: 0.2,
                emissive: 0x3a2a00,
                emissiveIntensity: 0.15,
            });
            const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
            const ringGeo2 = new THREE.TorusGeometry(15.5, 0.08, 32, 180);
            const ringMat2 = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.35,
            });
            const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
            clockGroup.add(ring1);
            clockGroup.add(ring2);
            const handMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const hGeo = new THREE.BoxGeometry(0.7, 10, 0.15);
            hGeo.translate(0, 5, 0);
            hourHand = new THREE.Mesh(hGeo, handMat);
            const mGeo = new THREE.BoxGeometry(0.45, 15, 0.15);
            mGeo.translate(0, 7.5, 0);
            minuteHand = new THREE.Mesh(mGeo, handMat);
            clockGroup.add(hourHand);
            clockGroup.add(minuteHand);
            // subtle glow sprite
            const glowSprite = new THREE.TextureLoader().load("https://threejs.org/examples/textures/sprites/disc.png");
            const glowMat = new THREE.SpriteMaterial({
                map: glowSprite,
                color: 0xd4af37,
                transparent: true,
                opacity: 0.6,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            });
            const glow = new THREE.Sprite(glowMat);
            glow.scale.set(48, 48, 1);
            clockGroup.add(glow);
            clockGroup.position.y = 200;
            clockGroup.rotation.x = -Math.PI / 2;
            clockGroup.scale.set(1.4, 1.4, 1.4);
            scene.add(clockGroup);
            // Resize
            const onResize = () => {
                if (!renderer) return;
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
            };
            window.addEventListener("resize", onResize);
            // Animate
            const animate = () => {
                if (disposed) return;
                const positions = starGeo.attributes.position.array as Float32Array;
                for (let i = 1; i < positions.length; i += 3) {
                    positions[i] -= 4;
                    if (positions[i] < -200) positions[i] = 400;
                }
                starGeo.attributes.position.needsUpdate = true;
                stars.rotation.y -= 0.002;
                const time = Date.now() * 0.001;
                // 역방향(되감기)으로 훨씬 빠르게 회전
                const speedH = 6.0; // 시침 속도(기존 대비 대폭 증가)
                const speedM = 18.0; // 분침 속도(시침보다 훨씬 빠르게)
                hourHand.rotation.z = -time * speedH;
                minuteHand.rotation.z = -time * speedM;
                clockGroup.rotation.x = -Math.PI / 2 + Math.sin(time) * 0.05;
                clockGroup.rotation.y = Math.cos(time) * 0.05;
                renderer.render(scene, camera);
                raf = requestAnimationFrame(animate);
            };
            raf = requestAnimationFrame(animate);
            // Cleanup (비동기 IIFE 내에서 생성되므로 외부에 전달)
            cleanup = () => {
                disposed = true;
                cancelAnimationFrame(raf);
                window.removeEventListener("resize", onResize);
                try {
                    containerRef.current?.removeChild(renderer.domElement);
                } catch {}
                renderer?.dispose?.();
                starGeo?.dispose?.();
                // dispose materials/geometries explicitly
                ringGeo1?.dispose?.();
                ringGeo2?.dispose?.();
                hGeo?.dispose?.();
                mGeo?.dispose?.();
                ringMat1?.dispose?.();
                ringMat2?.dispose?.();
                handMat?.dispose?.();
                starSprite?.dispose?.();
                glowSprite?.dispose?.();
            };
        })();
        // 실제 effect의 cleanup 반환
        return () => {
            disposed = true;
            if (cleanup) cleanup();
        };
    }, []);
    return (
        <div className="fixed inset-0 z-[2000]">
            {/* 종로 지도 배경 */}
            <div className="tw3-bg" />
            <div ref={containerRef} className="absolute inset-0" />
            {/* 이전 스타일의 2D 시계 오버레이 (가독성 강화용) */}
            <div className="clock2-container">
                <div className="clock2-face">
                    <div className="roman2 r-12">XII</div>
                    <div className="roman2 r-3">III</div>
                    <div className="roman2 r-6">VI</div>
                    <div className="roman2 r-9">IX</div>
                    <div className="hand2 hour2" />
                    <div className="hand2 minute2" />
                    <div className="center2" />
                </div>
            </div>
            <p className="tw3-text">{text}</p>
            <style jsx>{`
                .tw3-bg {
                    position: absolute;
                    inset: 0;
                    background-image: url("${getS3StaticUrl("escape/jongro/jongroMap.png")}");
                    background-size: cover;
                    background-position: center;
                    filter: brightness(0.35) saturate(0.85);
                }
                /* 2D 시계 오버레이 */
                .clock2-container {
                    position: absolute;
                    left: 50%;
                    top: 50%;
                    transform: translate(-50%, -50%);
                    width: 260px;
                    height: 260px;
                    border-radius: 50%;
                    background: rgba(20, 20, 20, 0.8);
                    border: 12px solid #d4af37;
                    box-shadow: 0 0 50px rgba(212, 175, 55, 0.5), inset 0 0 20px #000;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    pointer-events: none;
                    z-index: 2;
                    animation: container-pulse 3s infinite alternate;
                }
                .clock2-face {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    border-radius: 50%;
                }
                .hand2 {
                    position: absolute;
                    bottom: 50%;
                    left: 50%;
                    transform-origin: bottom center;
                    background: #d4af37;
                    border-radius: 4px;
                }
                .hour2 {
                    width: 6px;
                    height: 62px;
                    background: #ffffff;
                    animation: rewind 0.9s linear infinite;
                }
                .minute2 {
                    width: 4px;
                    height: 92px;
                    background: #d4af37;
                    animation: rewind 0.35s linear infinite;
                }
                .center2 {
                    position: absolute;
                    width: 14px;
                    height: 14px;
                    background: #d4af37;
                    border-radius: 50%;
                    z-index: 3;
                    left: 50%;
                    top: 50%;
                    transform: translate(-50%, -50%);
                    box-shadow: 0 0 10px rgba(212, 175, 55, 0.8);
                }
                .roman2 {
                    position: absolute;
                    color: #d4af37;
                    font-weight: bold;
                    font-size: 20px;
                    text-shadow: 0 0 5px rgba(212, 175, 55, 0.8);
                }
                .r-12 {
                    top: 8px;
                    left: 50%;
                    transform: translateX(-50%);
                }
                .r-3 {
                    right: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                }
                .r-6 {
                    bottom: 8px;
                    left: 50%;
                    transform: translateX(-50%);
                }
                .r-9 {
                    left: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                }
                .tw3-text {
                    position: absolute;
                    bottom: 10%;
                    width: 100%;
                    text-align: center;
                    color: #c8aa64;
                    font-family: "Noto Serif KR", serif;
                    font-weight: 700;
                    letter-spacing: 1px;
                    text-shadow: 0 0 10px rgba(0, 0, 0, 0.8);
                    z-index: 2;
                }
                @keyframes rewind {
                    from {
                        transform: translateX(-50%) rotate(360deg);
                    }
                    to {
                        transform: translateX(-50%) rotate(0deg);
                    }
                }
                @keyframes container-pulse {
                    0% {
                        transform: translate(-50%, -50%) scale(1);
                        box-shadow: 0 0 30px rgba(212, 175, 55, 0.3);
                    }
                    100% {
                        transform: translate(-50%, -50%) scale(1.05);
                        box-shadow: 0 0 80px rgba(212, 175, 55, 0.8);
                    }
                }
            `}</style>
        </div>
    );
}

// --- 대화형 인트로 컴포넌트 ---
const DialogueFlow = ({
    messages,
    step,
    onNext,
    onComplete,
    letterMode = false,
    onLetterOpened,
    fallbackParts,
}: {
    messages: string | DialogueMessage[] | undefined;
    step: number;
    onNext: () => void;
    onComplete: () => void;
    letterMode?: boolean;
    onLetterOpened?: (opened: boolean) => void;
    fallbackParts?: string[];
}) => {
    // 1장 인트로: 편지가 날아와 도착 → 클릭 시 모달로 펼침
    const [letterArrived] = useState<boolean>(!!letterMode);
    const [showLetter, setShowLetter] = useState<boolean>(false);
    const [arrived, setArrived] = useState<boolean>(false);
    const [opened, setOpened] = useState<boolean>(false);
    const [visibleMessageCount, setVisibleMessageCount] = useState<number>(1);
    const [canCloseLetter, setCanCloseLetter] = useState<boolean>(false);
    const messageListRef = useRef<HTMLDivElement | null>(null);

    const letterItems = useMemo(() => {
        if (!showLetter) return [] as Array<{ text: string; isUser: boolean; speaker?: string }>;
        const norm = (s: any) =>
            String(s ?? "")
                .trim()
                .toLowerCase();

        if (Array.isArray(messages)) {
            const arr = (messages as DialogueMessage[])
                .map((m) => ({
                    text: String(m?.text || "").trim(),
                    isUser: norm(m?.role) === "user" || ["user", "me", "나"].includes(norm(m?.speaker)),
                    speaker: m?.speaker,
                }))
                .filter((m) => m.text.length > 0);

            // ✅ 동일한 텍스트 중복 제거
            const unique = arr.filter((v, i, self) => i === self.findIndex((x) => x.text === v.text));
            return unique;
        }

        if (typeof messages === "string") {
            const arr = messages
                .split(/\n{2,}/)
                .map((s, i) => ({ text: s.trim(), isUser: i % 2 === 1 }))
                .filter((m) => m.text.length > 0);
            return arr;
        }

        // fallbackParts는 messages가 완전히 없을 때만 사용
        if (!messages && Array.isArray(fallbackParts) && fallbackParts.length > 0) {
            return fallbackParts.map((t, i) => ({
                text: String(t || "").trim(),
                isUser: i % 2 === 1,
            }));
        }

        return [] as Array<{ text: string; isUser: boolean; speaker?: string }>;
    }, [showLetter, messages, fallbackParts]);

    // 줄 단위 표시 및 자동 진행 설정
    const autoAdvance = true;
    const flatLetterLines = useMemo(
        () =>
            (letterItems || []).flatMap((m) =>
                String(m?.text || "")
                    .split(/\n+/)
                    .filter(Boolean)
                    .map((line) => ({ text: line, isUser: m.isUser, speaker: (m as any)?.speaker }))
            ),
        [letterItems]
    );

    useEffect(() => {
        if (!showLetter) return;
        const t1 = setTimeout(() => setArrived(true), 5);
        const t2 = setTimeout(() => setOpened(true), 240);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [showLetter]);

    // 편지 열림 시에는 부모에 통지하지 않음 (닫을 때만 통지)

    // 열림 이후 수동/자동 진행 설정 + 자동 스크롤
    useEffect(() => {
        if (!showLetter || !opened) return;
        setVisibleMessageCount(1);
        const total = flatLetterLines.length;
        if (!autoAdvance || total <= 1) return;
        const id = setInterval(() => {
            setVisibleMessageCount((n) => {
                const next = Math.min(n + 1, total);
                if (next === total) clearInterval(id);
                return next;
            });
        }, 1000);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [opened, showLetter, flatLetterLines.length]);

    useEffect(() => {
        try {
            if (messageListRef.current) {
                messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
            }
        } catch {}
    }, [visibleMessageCount]);

    // 모든 말풍선이 나타난 뒤 1초 후 버튼 활성화
    useEffect(() => {
        if (!showLetter || !opened) return;
        const total = flatLetterLines.length;
        if (total === 0) {
            const tid = setTimeout(() => setCanCloseLetter(true), 1000);
            return () => clearTimeout(tid);
        }
        if (visibleMessageCount >= total) {
            const tid = setTimeout(() => setCloseAfterAll(), 1000);
            return () => clearTimeout(tid);
        } else {
            setCanCloseLetter(false);
        }
        function setCloseAfterAll() {
            setCanCloseLetter(true);
        }
    }, [visibleMessageCount, showLetter, opened, flatLetterLines.length]);

    // 도착 알림(중앙 작은 봉투 버튼) – 클릭 시 모달 열림 (텍스트 없이 아이콘만)
    if (letterMode && !showLetter) {
        return (
            <div className="fixed inset-0 z-[1450] pointer-events-none flex items-center justify-center">
                <button
                    onClick={() => setShowLetter(true)}
                    className="pointer-events-auto select-none relative"
                    aria-label="편지 열기"
                >
                    <svg
                        width="72"
                        height="52"
                        viewBox="0 0 72 52"
                        xmlns="http://www.w3.org/2000/svg"
                        className="animate-bounce drop-shadow-lg"
                    >
                        <rect
                            x="1.5"
                            y="1.5"
                            rx="8"
                            ry="8"
                            width="69"
                            height="49"
                            fill="#F8E7A3"
                            stroke="#C9A04A"
                            strokeWidth="3"
                        />
                        <path
                            d="M6 16 L36 32 L66 16"
                            fill="none"
                            stroke="#C9A04A"
                            strokeWidth="3"
                            strokeLinecap="round"
                        />
                    </svg>
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex items-center justify-center rounded-full h-4 w-4 bg-rose-600 text-white text-[10px] font-bold border border-white shadow">
                            1
                        </span>
                    </span>
                </button>
            </div>
        );
    }

    if (showLetter) {
        const items = flatLetterLines;
        const goNextLine = () => {
            setVisibleMessageCount((n) => Math.min(n + 1, items.length));
        };
        return (
            <div className="fixed inset-0 z-[1450] bg-linear-to-b from-black/60 to-black/20 flex items-end justify-center p-4 pb-[12vh]">
                <div
                    className={`relative w-full max-w-lg transition-transform duration-700 ease-out ${
                        arrived ? "translate-y-0 scale-100 rotate-0" : "-translate-y-16 scale-95 rotate-3"
                    }`}
                >
                    {/* 봉투 바디 */}
                    <div className="relative rounded-2xl flex flex-col max-h-[70vh]">
                        {/* 봉투 덮개(열림 효과) */}
                        <div
                            className={`absolute inset-x-0 top-0 h-10 bg-transparent transition-all duration-700 ${
                                opened ? "-translate-y-10 opacity-0" : "translate-y-0 opacity-100"
                            }`}
                        />
                        {/* 편지지 노출 */}
                        <div
                            className={`px-6 pt-6 pb-3 transition-all duration-700 ${
                                opened ? "opacity-100" : "opacity-0"
                            } overflow-hidden flex-1 min-h-0`}
                            style={{ maxHeight: opened ? "unset" : 0 }}
                        >
                            {/* 제목 제거: 디자인 요구사항 */}
                            <div
                                ref={messageListRef}
                                className="max-h-[46vh] w-full max-w-full overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y space-y-3 pr-1 pb-3 cursor-pointer"
                                onClick={goNextLine}
                            >
                                {items.slice(0, visibleMessageCount).map((m, i) => {
                                    const identity = String((m as any)?.role || (m as any)?.speaker || "")
                                        .trim()
                                        .toLowerCase();
                                    const isSystem = identity === "system";
                                    if (isSystem) {
                                        // System: 텍스트만, 가운데에서 말하는 느낌 (말풍선 제거)
                                        return (
                                            <div
                                                key={i}
                                                className={`flex justify-center ${
                                                    i === visibleMessageCount - 1 ? "animate-fade-in-up" : ""
                                                }`}
                                                style={
                                                    i === visibleMessageCount - 1
                                                        ? { animationDuration: "1000ms" }
                                                        : undefined
                                                }
                                            >
                                                <div className="max-w-[88%]">
                                                    <div className="rounded-2xl px-5 py-3 bg-white/70 backdrop-blur-[1px] border border-white/40 shadow-md">
                                                        <p className="text-gray-900 font-medium text-sm leading-relaxed whitespace-pre-wrap break-words">
                                                            {m.text}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div
                                            key={i}
                                            className={`flex ${m.isUser ? "justify-end" : "justify-start"} ${
                                                i === visibleMessageCount - 1 ? "animate-fade-in-up" : ""
                                            }`}
                                            style={
                                                i === visibleMessageCount - 1
                                                    ? { animationDuration: "1000ms" }
                                                    : undefined
                                            }
                                        >
                                            <div className={`max-w-[78%] ${m.isUser ? "mr-2" : "ml-2"}`}>
                                                <div
                                                    className={`relative rounded-2xl px-4 py-2.5 text-left shadow-md border ${
                                                        m.isUser
                                                            ? "bg-[#B7D3F5] text-[#0F2B46] border-[#30568b]/20"
                                                            : "bg-[#FFF1D6]/95 text-neutral-900 border-black/5"
                                                    }`}
                                                >
                                                    {/* 말꼬리: NPC는 왼쪽, Me는 오른쪽 */}
                                                    {m.isUser ? (
                                                        <span className="absolute -right-2 bottom-3 w-0 h-0 border-y-[8px] border-y-transparent border-l-[10px] border-l-[#B7D3F5]" />
                                                    ) : (
                                                        <span className="absolute -left-2 bottom-3 w-0 h-0 border-y-[8px] border-y-transparent border-r-[10px] border-r-[#FFF1D6]" />
                                                    )}
                                                    <p className="font-medium text-sm leading-relaxed whitespace-pre-wrap break-words">
                                                        {m.text}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {((items.length > 0 && visibleMessageCount >= items.length) || items.length === 0) && (
                                <div className="mt-3 p-3 bg-transparent sticky bottom-0 text-center">
                                    <button
                                        onClick={() => {
                                            // 닫기를 눌러야만 진행되도록: 먼저 모달 상태 정리
                                            setShowLetter(false);
                                            setOpened(false);
                                            // 부모에 닫힘 통지 → 카테고리 화면으로 전환
                                            try {
                                                if (typeof onLetterOpened === "function") onLetterOpened(false);
                                            } catch {}
                                            // onComplete 콜백(있다면) 호출
                                            if (typeof onComplete === "function") onComplete();
                                        }}
                                        disabled={!canCloseLetter}
                                        className={`px-5 py-2 rounded-lg text-white shadow ${
                                            canCloseLetter
                                                ? "bg-blue-600 hover:bg-blue-700"
                                                : "bg-blue-400 opacity-60 cursor-not-allowed"
                                        }`}
                                    >
                                        닫기
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    // 메시지가 문자열인 경우: 문단 단위로 쪼개서 채팅 스타일로 보여주기
    if (typeof messages === "string") {
        const parts = messages
            .split(/\n{2,}/)
            .map((s) => s.trim())
            .filter(Boolean);
        return (
            <div className="fixed inset-0 z-[1400] bg-linear-to-b from-black/60 to-black/20 flex items-end justify-center p-4 animate-fade-in">
                <div className="w-full max-w-3xl bg-[#fffef8]/95 rounded-t-2xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.15)] border-t border-amber-100 font-['Gowun_Dodum']">
                    <div className="max-h-[46vh] overflow-y-auto space-y-4 pr-1 pb-3">
                        {parts.map((t, i) => (
                            <div
                                key={i}
                                className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"} animate-fade-in-up`}
                            >
                                <div
                                    className={`${
                                        i % 2 === 0
                                            ? "bg-[#fffdf7] text-gray-900 border border-amber-200 shadow-sm"
                                            : "bg-linear-to-b from-amber-500 to-amber-600 text-white shadow-lg"
                                    } px-5 py-3 rounded-2xl max-w-[80%] leading-relaxed tracking-wide whitespace-pre-wrap break-words`}
                                >
                                    {t}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="text-right mt-4">
                        <button
                            onClick={onComplete}
                            className="px-6 py-2.5 bg-linear-to-b from-amber-400 to-amber-600 text-white rounded-full shadow-inner hover:brightness-105 transition-all"
                        >
                            미션 시작하기
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!messages || !Array.isArray(messages)) {
        const text = "이 챕터의 이야기가 시작됩니다.";
        return (
            <div className="fixed inset-0 z-[1400] bg-black/60 flex items-end justify-center p-4 animate-fade-in">
                <div className="w-full max-w-3xl bg-white/90 rounded-t-2xl p-4 shadow-lg border-t">
                    <div className="max-h-[46vh] overflow-y-auto space-y-3 pr-1 pb-3">
                        <div className="flex justify-start">
                            <div className="bg-gray-100 text-gray-900 px-4 py-2 rounded-2xl max-w-[80%] shadow">
                                <p className="whitespace-pre-wrap break-words leading-relaxed">{text}</p>
                            </div>
                        </div>
                    </div>
                    <div className="text-right mt-4">
                        <button onClick={onComplete} className="btn-vintage">
                            미션 시작하기
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const currentMessage = messages[step];
    const isLastMessage = step >= messages.length - 1;

    const handleContinue = () => {
        if (isLastMessage) {
            onComplete();
        } else {
            onNext();
        }
    };

    if (!currentMessage) return null;

    return (
        <div className="fixed inset-0 z-[1400] bg-black/60 flex items-end justify-center p-4 animate-fade-in">
            <div className="w-full max-w-3xl bg-white/90 rounded-t-2xl p-6 shadow-lg border-t">
                {currentMessage.speaker && currentMessage.speaker !== "narrator" && (
                    <p className="font-bold text-lg mb-2 text-gray-800">
                        {currentMessage.speaker === "user" ? "나" : currentMessage.speaker}
                    </p>
                )}
                <p className="text-gray-900 text-lg whitespace-pre-wrap break-words min-h-[4em]">
                    {currentMessage.text}
                </p>
                <div className="text-right mt-4">
                    <button onClick={handleContinue} className="btn-vintage">
                        {isLastMessage ? "미션 시작" : "계속"}
                    </button>
                </div>
            </div>
        </div>
    );
};

function EscapeIntroPageInner() {
    // [추가] 페이지 진입 시 스크롤을 맨 위로 고정
    useEffect(() => {
        window.scrollTo(0, 0);
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = "";
        };
    }, []);

    const COUNT_PAGES = 21;
    const numFlipPages = 11;
    const router = useRouter();
    const search = useSearchParams();
    const storyId = Number(search.get("id"));

    // 🟢 성능 최적화: escape 페이지 진입 시 메인 페이지를 미리 로드하여 빠른 전환 보장
    useEffect(() => {
        router.prefetch("/");
    }, [router]);

    // --- 상태 관리 ---
    const [story, setStory] = useState<Story | null>(null);
    const [chapters, setChapters] = useState<StoryChapter[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    // 로딩이 끝난 직후 시계 스플래시 표시
    const [showPostClock, setShowPostClock] = useState<boolean>(false);
    const [animationFinished, setAnimationFinished] = useState<boolean>(false);
    const [isClosing, setIsClosing] = useState<boolean>(false);
    const [currentChapterIdx, setCurrentChapterIdx] = useState<number>(0);
    const [puzzleAnswer, setPuzzleAnswer] = useState<string>("");
    const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
    const [validationError, setValidationError] = useState<string>("");
    const [answerChecked, setAnswerChecked] = useState<boolean>(false);
    const STORAGE_KEY = useMemo(() => `escape_progress_${storyId}`, [storyId]);
    const [resumed, setResumed] = useState<boolean>(false);
    const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
    const [selectedGallery, setSelectedGallery] = useState<string[]>([]);
    // 템플릿 프레임 수에 맞춰 선택 수를 제한
    const [requiredPhotoCount, setRequiredPhotoCount] = useState<number>(4);
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/collages/templates", { cache: "no-store" });
                const data = await res.json().catch(() => ({}));
                const list = Array.isArray(data?.templates) ? data.templates : [];
                const t =
                    list.find(
                        (it: any) =>
                            String(it?.name || "")
                                .toLowerCase()
                                .includes("hongdae") || String(it?.imageUrl || "").includes("hongdaelatter_template")
                    ) || list[0];
                const raw = (t?.framesJson ?? t?.frames_json) as any;
                const frames = Array.isArray(raw) ? raw : [];
                const cnt = Number.isFinite(frames.length) && frames.length > 0 ? frames.length : 4;
                setRequiredPhotoCount(cnt);
            } catch {}
        })();
    }, [storyId]);
    // 로딩 종료 감지 → 2.6초간 시계 스플래시 (체감상 더 길게)
    useEffect(() => {
        if (!loading) {
            setShowPostClock(true);
            const t = setTimeout(() => setShowPostClock(false), 2600);
            return () => clearTimeout(t);
        }
    }, [loading]);
    // 콜라주 1회 저장 제어를 위한 키/상태
    const COLLAGE_URL_KEY = useMemo(() => `escape_collage_url_${storyId}`, [storyId]);
    const [savedCollageUrl, setSavedCollageUrl] = useState<string | null>(null);
    useEffect(() => {
        try {
            const u = localStorage.getItem(COLLAGE_URL_KEY);
            if (u) setSavedCollageUrl(u);
        } catch {}
    }, [COLLAGE_URL_KEY]);
    // 사진 자리 교체를 위한 첫 번째 선택
    const [swapFrom, setSwapFrom] = useState<string | null>(null);
    const collageCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isEndFlip, setIsEndFlip] = useState<boolean>(false);
    const [badge, setBadge] = useState<{
        id: number;
        name: string;
        description?: string | null;
        image_url?: string | null;
    } | null>(null);
    const [endingFlowStarted, setEndingFlowStarted] = useState<boolean>(false);
    const [endingDialogueStep, setEndingDialogueStep] = useState<number>(0);
    const [toast, setToast] = useState<string | null>(null);
    const [endingStep, setEndingStep] = useState<"finalMessage" | "epilogue" | "gallery" | "badge" | null>(null);
    // 대화형 인트로(기존 컴포넌트용) 상태
    const [isDialogueActive, setIsDialogueActive] = useState<boolean>(false);
    // 편지 닫을 때만 UI를 보이게 하기 위해, 로컬스토리지 상태를 우선 반영
    const [isLetterOpened, setIsLetterOpened] = useState<boolean>(() => {
        try {
            const key = `escape_letter_shown_${storyId}`;
            return localStorage.getItem(key) === "1";
        } catch {
            return false;
        }
    });
    // 비밀 편지를 이미 본 적이 있는지(스토리별) 영구 플래그
    const [letterEverShown, setLetterEverShown] = useState<boolean>(false);
    const [dialogueStep, setDialogueStep] = useState<number>(0);
    // 완료된 카테고리(카페 등)를 기록하여 카테고리 선택 화면에서 숨김 처리
    const [completedCategories, setCompletedCategories] = useState<string[]>([]);

    // UI 엔진(스토리별) – 존재 시 엔진별 렌더러로 분기
    const [uiEngine, setUiEngine] = useState<string | null>(null);
    const [uiTokens, setUiTokens] = useState<any>(null);
    const [uiFlow, setUiFlow] = useState<any>(null);
    useEffect(() => {
        if (!Number.isFinite(storyId)) return;
        (async () => {
            try {
                const res = await fetch(`/api/escape/ui?storyId=${storyId}`, { cache: "no-store" });
                const data = await res.json().catch(() => ({}));
                if (data && data.engine) {
                    setUiEngine(String(data.engine));
                    setUiTokens(data.tokens || null);
                    setUiFlow(data.flow || null);
                } else {
                    setUiEngine(null);
                    setUiTokens(null);
                    setUiFlow(null);
                }
            } catch {
                setUiEngine(null);
            }
        })();
    }, [storyId]);

    // 새 흐름 상태 (책 펼침 제거 UI)
    const [flowStep, setFlowStep] = useState<
        "prologue" | "category" | "placeList" | "dialogue" | "mission" | "pieceAward" | "walk" | "done"
    >("prologue");
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedPlaceIndex, setSelectedPlaceIndex] = useState<number | null>(null);
    const [selectedPlaceId, setSelectedPlaceId] = useState<number | null>(null);
    const [selectedPlaceType, setSelectedPlaceType] = useState<string | null>(null);
    const [selectedPlaceConfirm, setSelectedPlaceConfirm] = useState<number | null>(null);
    const [missionUnlocked, setMissionUnlocked] = useState<boolean>(false);
    const [answersByMission, setAnswersByMission] = useState<Record<number, string>>({});
    const [solvedMissionIds, setSolvedMissionIds] = useState<number[]>([]);
    const [clearedMissions, setClearedMissions] = useState<Record<number, boolean>>({});
    const [clearedPlaces, setClearedPlaces] = useState<Record<number, boolean>>({});
    const [selectedSolvedMissionId, setSelectedSolvedMissionId] = useState<number | null>(null);
    const [missionModalOpen, setMissionModalOpen] = useState<boolean>(false);
    const [activeMission, setActiveMission] = useState<any | null>(null);
    // 2개 완료 시 진행 버튼을 누르면 뜨는 안내 모달 (4개 완료 시 쿠폰 안내)
    const [showProceedModal, setShowProceedModal] = useState<boolean>(false);
    // Modal answer/check states
    const [modalAnswer, setModalAnswer] = useState<string>("");
    const [modalWrongOnce, setModalWrongOnce] = useState<boolean>(false);
    const [modalError, setModalError] = useState<string | null>(null);
    // Post-mission story modal
    const [showPostStory, setShowPostStory] = useState<boolean>(false);
    const [postStoryQueue, setPostStoryQueue] = useState<string[]>([]);
    const [postStoryIdx, setPostStoryIdx] = useState<number>(0);
    const [galleryPage, setGalleryPage] = useState<number>(0);

    const normalizeAnswer = (v: any): string =>
        String(v ?? "")
            .trim()
            .toLowerCase();

    // --- 통합 상태 전환 헬퍼 ---
    const [lastScrollY, setLastScrollY] = useState<number>(0);
    const listScrollRef = useRef<HTMLDivElement>(null);

    const changeFlowStep = (newStep: typeof flowStep, options?: { resetMission?: boolean; resetPlace?: boolean }) => {
        if (endingStartedRef.current && newStep !== "done") return;

        // category -> 다른 화면으로 갈 때 스크롤 저장
        if (flowStep === "category" && newStep !== "category") {
            try {
                setLastScrollY(window.scrollY);
            } catch {}
        }

        setFlowStep(newStep);

        // 다른 화면 -> category로 돌아올 때 스크롤 복원
        if (newStep === "category") {
            setTimeout(() => {
                try {
                    window.scrollTo({ top: lastScrollY, behavior: "instant" });
                } catch {}
            }, 0);
        }

        if (options?.resetMission) {
            try {
                setMissionUnlocked(false);
                setActiveMission(null);
                setMissionModalOpen(false);
                setModalAnswer("");
                setModalError(null);
                setModalWrongOnce(false);
            } catch {}
        }
        if (options?.resetPlace) {
            try {
                setSelectedPlaceId(null);
                setSelectedPlaceIndex(null);
                setSelectedPlaceConfirm(null);
            } catch {}
        }
    };

    // --- 제출 후 진행 통합 ---
    const proceedAfterMission = async () => {
        try {
            const place = (currentChapter?.placeOptions || []).find(
                (p: any) => Number(p.id) === Number(selectedPlaceId)
            );
            const queue: string[] = Array.isArray((place as any)?.stories)
                ? (place as any).stories
                      .map((s: any) => String(s?.dialogue || s?.narration || s || "").trim())
                      .filter(Boolean)
                : [];
            if (queue.length > 0) {
                setPostStoryQueue(queue);
                setPostStoryIdx(0);
                setShowPostStory(true);
                return;
            }
        } catch {}
        // 스토리 없으면 카테고리 화면으로
        changeFlowStep("category", { resetMission: true });
    };

    // --- 통합 제출 함수 ---
    const submitMission = async (args: {
        chapterId: number;
        missionType: string;
        photoUrls?: string[];
        textAnswer?: string;
        isCorrect?: boolean;
    }): Promise<{ success: boolean; error?: string }> => {
        try {
            const res = await fetch("/api/submit-mission", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    chapterId: args.chapterId,
                    isCorrect: args.isCorrect ?? true,
                    textAnswer: args.textAnswer,
                    photoUrls: args.photoUrls,
                    missionType: args.missionType,
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({} as any));
                return { success: false, error: err?.message || "제출 실패" };
            }
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e?.message || "제출 실패" };
        }
    };
    const isCorrectForPayload = (payload: any, userInput: string): boolean => {
        const user = normalizeAnswer(userInput);
        const ans = (payload && (payload.answer ?? payload.correct ?? payload.answers)) as any;
        if (Array.isArray(ans)) return ans.some((a) => normalizeAnswer(a) === user);
        if (typeof ans === "number") return String(ans) === user;
        if (typeof ans === "string") return normalizeAnswer(ans) === user;
        return true;
    };
    const [placeDialogueDone, setPlaceDialogueDone] = useState<boolean>(false);
    const [dialogueQueue, setDialogueQueue] = useState<
        Array<{ speaker?: string | null; text: string; missionId?: number | null }>
    >([]);
    const [piecesCollected, setPiecesCollected] = useState<number>(0);
    const [pendingNextChapterIdx, setPendingNextChapterIdx] = useState<number | null>(null);
    const [noteOpenAnim, setNoteOpenAnim] = useState<boolean>(false);
    const [titlePopAnim, setTitlePopAnim] = useState<boolean>(false);
    const introBgmRef = useRef<HTMLAudioElement | null>(null);
    const endingBgmRef = useRef<HTMLAudioElement | null>(null);
    const [prologueQueue, setPrologueQueue] = useState<string[]>([]);
    const [inSelectedRange, setInSelectedRange] = useState<boolean>(false);
    const [selectedDistance, setSelectedDistance] = useState<number | null>(null);
    const [isMoving, setIsMoving] = useState<boolean>(false);

    const [photoFiles, setPhotoFiles] = useState<File[]>([]);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [isSharing, setIsSharing] = useState<boolean>(false);
    const [photoUploaded, setPhotoUploaded] = useState<boolean>(false);
    const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
    const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
    const [lastUploadedUrls, setLastUploadedUrls] = useState<string[]>([]);

    // 대화 중 미션 줄 자동 팝업 (currentChapter 선언 이후에 동작하도록 아래에서 다시 등록)

    // 콜라주 미리보기
    const [showCollagePreview, setShowCollagePreview] = useState<boolean>(false);
    const [collagePreviewUrl, setCollagePreviewUrl] = useState<string | null>(null);
    // FrameRenderer 기반 미리보기용 템플릿(배경/프레임 좌표)
    const [framePreviewTemplate, setFramePreviewTemplate] = useState<
        import("@/components/FrameRenderer").FrameTemplate | null
    >(null);

    // 미리보기: 기준 컨테이너(w-full flex-1 ... ) 크기 기준으로 배치
    const previewRootRef = useRef<HTMLDivElement | null>(null);
    const frameImageRef = useRef<HTMLImageElement | null>(null);
    const [previewDims, setPreviewDims] = useState<{
        iw: number;
        ih: number;
        offsetX: number;
        offsetY: number;
        baseW: number;
        baseH: number;
    }>({ iw: 0, ih: 0, offsetX: 0, offsetY: 0, baseW: 0, baseH: 0 });

    useEffect(() => {
        if (!showCollagePreview) return;
        const rootEl = previewRootRef.current;
        const imgEl = frameImageRef.current;
        if (!rootEl || !imgEl) return;
        const calc = () => {
            const base = rootEl.getBoundingClientRect();
            const bw = base.width;
            const bh = base.height;

            // ----- [수정할 부분] -----
            // 기존: 이미지 파일의 실제 크기를 따라감 (위험! 파일이 작으면 좌표 엉킴)
            // const BASE_W = imgEl.naturalWidth || 1080;
            // const BASE_H = imgEl.naturalHeight || 1920;

            // 변경: 파일 크기가 뭐든 무조건 1080x1920 기준으로 계산 (안전)
            const BASE_W = 1080;
            const BASE_H = 1920;
            // -------------------------

            // 아래 계산식은 그대로 두면,
            // "1080짜리를 현재 화면(bw)에 맞추려면 몇 배(scale) 줄여야 하나?"가 정확히 계산됩니다.
            const scale = Math.min(bw / BASE_W, bh / BASE_H);

            // 화면에 보여질 실제 이미지 크기
            const iw = Math.round(BASE_W * scale);
            const ih = Math.round(BASE_H * scale);

            const offsetX = (bw - iw) / 2;
            const offsetY = (bh - ih) / 2;

            setPreviewDims({ iw, ih, offsetX, offsetY, baseW: BASE_W, baseH: BASE_H });
        };
        if (imgEl.complete) calc();
        else imgEl.addEventListener("load", calc);
        window.addEventListener("resize", calc);
        return () => {
            try {
                imgEl.removeEventListener("load", calc);
            } catch {}
            window.removeEventListener("resize", calc);
        };
    }, [showCollagePreview, framePreviewTemplate]);

    // 회색 프레임을 덮기 위한 오버랩 (퍼센트)
    const PREVIEW_OVERLAP_PERCENT = 1.5;

    const renderedPreviewPhotos = useMemo(() => {
        const { iw, ih, offsetX, offsetY, baseW, baseH } = previewDims;
        if (iw === 0 || ih === 0) return null;
        const BASE_W = baseW || 1080;
        const BASE_H = baseH || 1920;
        const raw = (framePreviewTemplate as any)?.framesJson || (framePreviewTemplate as any)?.frames_json || [];
        const frames = Array.isArray(raw) ? raw : [];
        const urls = selectedGallery.slice(0, requiredPhotoCount);
        const sx = iw / BASE_W;
        const sy = ih / BASE_H;
        return frames.slice(0, urls.length).map((f: any, i: number) => {
            const isPercent = f.x <= 1 && f.y <= 1 && f.w <= 1 && f.h <= 1;
            const px = isPercent
                ? { x: f.x * BASE_W, y: f.y * BASE_H, w: f.w * BASE_W, h: f.h * BASE_H }
                : { x: f.x, y: f.y, w: f.w, h: f.h };
            const ovx = (PREVIEW_OVERLAP_PERCENT / 100) * iw;
            const ovy = (PREVIEW_OVERLAP_PERCENT / 100) * ih;
            const left = offsetX + px.x * sx - ovx;
            const top = offsetY + px.y * sy - ovy;
            const width = Math.max(0, px.w * sx + ovx * 2);
            const height = Math.max(0, px.h * sy + ovy * 2);
            return (
                <img
                    key={i}
                    alt={`photo-${i + 1}`}
                    src={urls[i]}
                    style={{
                        position: "absolute",
                        left,
                        top,
                        width,
                        height,
                        objectFit: "cover",
                        zIndex: 2,
                        borderRadius: 4,
                        filter: "sepia(0.3) contrast(0.9) brightness(0.95) saturate(0.8)",
                    }}
                />
            );
        });
    }, [previewDims, framePreviewTemplate, selectedGallery]);

    // --- 미리보기 측정 모드 (contentBounds 추출용) ---
    const [measureMode, setMeasureMode] = useState<boolean>(false);

    // 포털: 변환(transform) 조상 영향 없이 전역(body)에 모달을 렌더링
    const ClientPortal = ({ children }: { children: React.ReactNode }) => {
        const [mounted, setMounted] = useState(false);
        useEffect(() => setMounted(true), []);
        if (!mounted) return null;
        return createPortal(children as any, document.body);
    };
    const [measurePoints, setMeasurePoints] = useState<Array<{ x: number; y: number }>>([]);
    const measureOverlay = useMemo(() => {
        const { iw, ih, offsetX, offsetY, baseW, baseH } = previewDims;
        if (measurePoints.length < 2 || iw === 0 || ih === 0) return null;
        const [p1, p2] = measurePoints;
        const x = Math.min(p1.x, p2.x);
        const y = Math.min(p1.y, p2.y);
        const w = Math.abs(p1.x - p2.x);
        const h = Math.abs(p1.y - p2.y);
        const left = ((x + offsetX) / (offsetX * 2 + iw)) * 100; // percent within preview root
        const top = ((y + offsetY) / (offsetY * 2 + ih)) * 100;
        const width = (w / (offsetX * 2 + iw)) * 100;
        const height = (h / (offsetY * 2 + ih)) * 100;
        return { left, top, width, height };
    }, [measurePoints, previewDims]);

    const handleMeasureClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!measureMode) return;
        const root = previewRootRef.current;
        const { iw, ih, offsetX, offsetY, baseW, baseH } = previewDims;
        if (!root || iw === 0 || ih === 0) return;
        const rect = root.getBoundingClientRect();
        const cx = e.clientX - rect.left - offsetX;
        const cy = e.clientY - rect.top - offsetY;
        const sx = iw / (baseW || 1080);
        const sy = ih / (baseH || 1920);
        const bx = Math.max(0, Math.min(baseW || 1080, Math.round(cx / sx)));
        const by = Math.max(0, Math.min(baseH || 1920, Math.round(cy / sy)));
        setMeasurePoints((prev) => {
            const next = [...prev, { x: bx, y: by }].slice(-2);
            if (next.length === 2) {
                const [p1, p2] = next;
                const x = Math.min(p1.x, p2.x);
                const y = Math.min(p1.y, p2.y);
                const w = Math.abs(p1.x - p2.x);
                const h = Math.abs(p1.y - p2.y);
                const bw = baseW || 1080;
                const bh = baseH || 1920;
                const percent = {
                    x: +(x / bw).toFixed(4),
                    y: +(y / bh).toFixed(4),
                    w: +(w / bw).toFixed(4),
                    h: +(h / bh).toFixed(4),
                };
                // eslint-disable-next-line no-console
                console.log("content_bounds (px):", { x, y, w, h });
                // eslint-disable-next-line no-console
                console.log("content_bounds (percent):", percent);
            }
            return next;
        });
    };

    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    useEffect(() => {
        if (typeof window === "undefined" || !navigator?.geolocation) return;
        const onOk = (pos: GeolocationPosition) => {
            const { latitude, longitude } = pos.coords;
            setUserLocation({ lat: latitude, lng: longitude });
        };
        const onErr = () => {
            setUserLocation(null);
        };
        navigator.geolocation.getCurrentPosition(onOk, onErr, {
            enableHighAccuracy: true,
            maximumAge: 60_000,
            timeout: 8_000,
        });
        const watchId = navigator.geolocation.watchPosition(onOk, onErr, {
            enableHighAccuracy: true,
            maximumAge: 60_000,
            timeout: 20_000,
        });
        return () => navigator.geolocation.clearWatch?.(watchId);
    }, []);

    const requestLocation = () => {
        if (typeof window === "undefined" || !navigator?.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            },
            () => {},
            { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 }
        );
    };

    useEffect(() => {
        let timer: any;
        let lastNotifiedChapterId: number | null = null;
        let lastNotifiedStation = false;

        async function ensurePermission() {
            return;
        }

        async function poll() {
            try {
                if (!storyId || !userLocation) return;
                // 알림 권한/알림 노출 제거
                const res = await fetch("/api/escape/geofence", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        storyId,
                        lat: userLocation.lat,
                        lng: userLocation.lng,
                        radius: 150,
                        ...(selectedPlaceId ? { placeOptionId: selectedPlaceId } : {}),
                    }),
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok && typeof data?.inRange === "boolean" && selectedPlaceId) {
                    setInSelectedRange(Boolean(data.inRange));
                } else if (res.ok && data?.inRange && data?.started) {
                    const nearest = data.nearest as { type: "station" | "chapter"; id: number | null };
                    if (nearest?.type === "station" && !lastNotifiedStation) {
                        lastNotifiedStation = true;
                    } else if (nearest?.type === "chapter" && nearest?.id && lastNotifiedChapterId !== nearest.id) {
                        lastNotifiedChapterId = nearest.id;
                    }
                }
            } catch {}
        }
        timer = setInterval(poll, 10000);
        poll();
        return () => clearInterval(timer);
    }, [storyId, userLocation, selectedPlaceId]);

    const NaverMap = useMemo(
        () =>
            dynamicImport(() => import("@/components/NaverMap"), {
                ssr: false,
                loading: () => (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                        지도 로딩...
                    </div>
                ),
            }),
        []
    );

    const [mountMapAfterOpen, setMountMapAfterOpen] = useState<boolean>(false);
    useEffect(() => {
        if (!animationFinished) return;
        const t = setTimeout(() => setMountMapAfterOpen(true), 150);
        return () => clearTimeout(t);
    }, [animationFinished]);

    const [isMobile, setIsMobile] = useState<boolean>(false);
    const [showMapModal, setShowMapModal] = useState<boolean>(false);
    const [showIntroModal, setShowIntroModal] = useState<boolean>(false);
    // 엔딩 시작 중복 클릭 방지
    const endingStartedRef = useRef<boolean>(false);

    // 스토리 전체 완료 여부(로컬 진행 기준)
    const isAllChaptersCompleted = useMemo(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const obj = raw ? JSON.parse(raw) : {};
            const nums = (chapters || [])
                .map((c: any) => Number(c?.chapter_number || 0))
                .filter((n) => Number.isFinite(n) && n > 0);
            if (nums.length === 0) return false;
            return nums.every((n) => Boolean(obj[String(n)]?.completed));
        } catch {
            return false;
        }
    }, [chapters?.length, currentChapterIdx, piecesCollected, flowStep]);

    // 모든 카테고리의 미션을 다 클리어했는지 판단 (카테고리 기반)
    // availableCategoryKeys는 아래에서 계산되므로 의존성만 받아 쓰도록 지연 선언을 사용할 수 없어서,
    // 함수 형태로 계산해 바로 아래 useMemo에 전달합니다.
    const computeAllCategoriesCleared = (keys: string[]) => {
        if (!keys || keys.length === 0) return false;
        const s = new Set((completedCategories || []).map((k) => String(k)));
        return keys.every((k) => s.has(String(k)));
    };

    // 엔딩 플로우 시작 헬퍼
    const startEndingFlow = async () => {
        if (endingStartedRef.current) return;
        endingStartedRef.current = true;
        setEndingFlowStarted(true);
        setFlowStep("done");
        setEndingStep("epilogue");
        try {
            setMissionModalOpen(false);
            setActiveMission(null);
        } catch {}
        try {
            setShowPostStory(false);
            setPostStoryQueue([]);
            setPostStoryIdx(0);
        } catch {}
        try {
            setIsDialogueActive(false);
            setEndingDialogueStep(0);
            setIsLetterOpened(true);
            setLetterEverShown(true);
            setMissionUnlocked(false);
            setSelectedPlaceId(null);
            setSelectedPlaceIndex(null);
            setSelectedPlaceConfirm(null);
            setShowMapModal(false);
            setInSelectedRange(false);
        } catch {}
        try {
            const [subResult, badgeResult] = await Promise.allSettled([
                fetch(`/api/escape/submissions?storyId=${storyId}`, { credentials: "include" }),
                fetch(`/api/escape/badge?storyId=${storyId}`),
            ]);
            if (subResult.status === "fulfilled" && subResult.value?.ok) {
                const data = await subResult.value.json();
                if (Array.isArray(data?.urls)) setGalleryUrls(data.urls);
            }
            if (badgeResult.status === "fulfilled" && badgeResult.value?.ok) {
                const bd = await badgeResult.value.json();
                if (bd?.badge) setBadge(bd.badge);
            }
        } catch {}
    };

    useEffect(() => {
        if (typeof window === "undefined") return;
        const mq = window.matchMedia("(max-width: 768px)");
        const update = () => setIsMobile(mq.matches);
        update();
        mq.addEventListener?.("change", update);
        return () => mq.removeEventListener?.("change", update);
    }, []);

    useEffect(() => {
        if (typeof document !== "undefined") {
            const originalBodyOverflow = document.body.style.overflow;
            const originalHtmlOverflow = document.documentElement.style.overflow;
            document.body.style.overflow = "hidden";
            document.documentElement.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = originalBodyOverflow;
                document.documentElement.style.overflow = originalHtmlOverflow;
            };
        }
    }, []);

    useEffect(() => {
        if (!Number.isFinite(storyId)) {
            setLoading(false);
            return;
        }

        (async () => {
            try {
                const [storyRes, chaptersRes] = await Promise.all([
                    fetch(`/api/escape/stories?storyId=${storyId}`, { cache: "no-store" }),
                    fetch(`/api/escape/chapters?storyId=${storyId}`, { cache: "no-store" }),
                ]);

                const storyData = await storyRes.json();
                const chaptersData = await chaptersRes.json();

                if (storyData && !storyData.error) {
                    setStory(storyData);
                    const syn = String(storyData.synopsis || "").trim();
                    if (syn) {
                        const lines = syn
                            .split(/\n+/)
                            .map((s: string) => s.trim())
                            .filter(Boolean);
                        setPrologueQueue(lines);
                    }
                }

                if (Array.isArray(chaptersData)) {
                    const sorted = chaptersData
                        .filter((c: any) => c && typeof c === "object")
                        .sort((a: any, b: any) => (a.chapter_number || 0) - (b.chapter_number || 0));
                    setChapters(sorted);
                }

                // DB 기반 완료 카테고리 자동 비활성화 목록 가져오기
                try {
                    const cr = await fetch(`/api/escape/completed-categories?storyId=${storyId}`, {
                        credentials: "include",
                    });
                    const cd = await cr.json();
                    if (cr.ok && Array.isArray(cd?.categories)) {
                        // 정규화해 저장
                        const norm = (cd.categories as string[])
                            .map((s) =>
                                String(s || "")
                                    .toLowerCase()
                                    .replace(/\s+/g, "")
                            )
                            .filter(Boolean);
                        setCompletedCategories(Array.from(new Set(norm)));
                    }
                } catch {}
            } catch (error) {
                console.error("Failed to fetch data:", error);
            } finally {
                setLoading(false);
            }
        })();
    }, [storyId]);

    useEffect(() => {
        const DURATION = 5000;
        const INITIAL = 500;
        const total = DURATION + INITIAL + 200;

        const animTimer = setTimeout(() => {
            setAnimationFinished(true);
        }, total);

        return () => clearTimeout(animTimer);
    }, []);

    // 이미 완료한 유저는 접근 제한 → 마이페이지 사건 파일로 이동
    useEffect(() => {
        if (!storyId || !Number.isFinite(Number(storyId))) return;
        (async () => {
            try {
                const res = await fetch(`/api/escape/complete?storyId=${storyId}`, { cache: "no-store" });
                const data = await res.json().catch(() => ({}));
                if (res.ok && data?.completed) {
                    setToast("이미 완료한 스토리입니다. 마이페이지로 이동합니다.");
                    setTimeout(() => router.push("/mypage?tab=casefiles"), 600);
                }
            } catch {}
        })();
    }, [storyId, router]);

    const currentChapter = chapters[currentChapterIdx];

    // 대화 중 미션 줄을 만나면 자동으로 미션 모달을 띄운다 (데이터 주도)
    useEffect(() => {
        if (flowStep !== "dialogue") return;
        if (!dialogueQueue || dialogueQueue.length === 0) return;
        if (missionModalOpen) return;
        const currentLine = dialogueQueue[0] as any;
        try {
            // 디버깅: 현재 대사와 연결된 미션 ID 확인
            // eslint-disable-next-line no-console
            console.log("💬 현재 대사:", currentLine?.text ?? currentLine?.dialogue ?? "");
            // eslint-disable-next-line no-console
            console.log("👉 미션 ID:", currentLine?.missionId ?? null);
        } catch {}
        if (!currentLine?.missionId) return;
        try {
            const placeList = (currentChapter as any)?.placeOptions || [];
            const place = placeList.find((p: any) => Number(p.id) === Number(selectedPlaceId));
            const mission = place?.missions?.find((m: any) => Number(m.id) === Number(currentLine.missionId));
            if (!mission) return;
            // 대사를 잠깐 읽을 시간(1.2s)을 준 뒤 모달 오픈. 언마운트/변경 시 타이머 정리
            const timer = window.setTimeout(() => {
                // 초기화 후 모달 오픈 (홍대와 동일 업로드 로직 재사용)
                setModalError(null);
                // @ts-ignore
                setModalWrongOnce(false);
                setPhotoFiles([]);
                setPhotoPreviewUrl(null);
                setPhotoPreviewUrls([]);
                setPhotoUploaded(false);
                setModalAnswer("");
                try {
                    // eslint-disable-next-line no-console
                    console.log("🧩 자동 실행: 미션 오픈", mission?.id);
                } catch {}
                setActiveMission(mission);
                setMissionModalOpen(true);
            }, 1200);
            return () => window.clearTimeout(timer);
        } catch {}
    }, [flowStep, dialogueQueue, missionModalOpen, currentChapter, selectedPlaceId]);
    // 엔딩 라벨 조건 추가했던 보조 상태 제거 (원복)

    // 지도에서는 사용자가 장소를 선택하기 전에는 장소 마커를 표시하지 않습니다.
    // 장소를 선택한 후에만 해당 장소 1개를 표시하고, 현재 위치와의 경로를 그립니다.
    const currentPlace = (() => {
        if (!currentChapter || !Array.isArray(currentChapter.placeOptions)) return [] as any[];
        const placeList: any[] = currentChapter.placeOptions as any[];
        const byId = selectedPlaceId ? placeList.find((p: any) => Number(p.id) === Number(selectedPlaceId)) : null;
        const byIndex = byId || (selectedPlaceIndex != null ? placeList[selectedPlaceIndex as number] : null);
        if (!byIndex) return [] as any[];
        return [
            {
                id: byIndex.id,
                name: byIndex.name,
                latitude: Number(byIndex.latitude ?? 0),
                longitude: Number(byIndex.longitude ?? 0),
                address: byIndex.address,
            },
        ];
    })();

    // NaverMap 컴포넌트가 userLocation prop으로 자기 위치 핀을 자동으로 생성하므로,
    // mapPlaces에는 자기 위치를 추가하지 않음 (중복 방지)
    const mapPlaces = currentPlace;

    useEffect(() => {
        if (animationFinished && mountMapAfterOpen && currentChapter && chapters.length > 0) {
            const t = setTimeout(() => {
                setDialogueStep(0);
                // 편지는 맨 처음(prologue)에만 표시
                // prologue 단계이고 첫 챕터일 때는 항상 편지 표시 (처음 진입 시)
                if (currentChapter.chapter_number === 1 && flowStep === "prologue") {
                    setIsDialogueActive(true);
                } else {
                    setIsDialogueActive(false);
                    if (currentChapter.chapter_number !== 1 || flowStep !== "prologue") {
                        setIsLetterOpened(true);
                    }
                }
            }, 80);
            return () => clearTimeout(t);
        }
    }, [animationFinished, mountMapAfterOpen, currentChapter, chapters.length, storyId, flowStep]);

    const handleCloseBook = () => {
        setEndingStep(null);
        setIsClosing(true);
        router.prefetch("/");
        setTimeout(() => {
            router.push("/");
        }, 1300);
    };

    const normalize = (v: any) =>
        String(v ?? "")
            .trim()
            .toLowerCase();

    const distanceKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
        try {
            const R = 6371; // km
            const toRad = (v: number) => (v * Math.PI) / 180;
            const dLat = toRad(lat2 - lat1);
            const dLng = toRad(lng2 - lng1);
            const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        } catch {
            return NaN;
        }
    };

    const canProceed = useMemo(() => {
        // 선택된 장소의 미션 중 완료된 개수를 기준으로 진행 가능 여부를 판단한다
        const placeList = (currentChapter as any)?.placeOptions || [];
        const placeById = selectedPlaceId ? placeList.find((p: any) => Number(p.id) === Number(selectedPlaceId)) : null;
        const placeByIndex = placeById || (selectedPlaceIndex != null ? placeList[selectedPlaceIndex as number] : null);
        const missions: any[] = Array.isArray((placeByIndex as any)?.missions) ? (placeByIndex as any).missions : [];
        const missionIds: number[] =
            missions.length > 0
                ? missions.map((m: any) => Number(m.id)).filter(Number.isFinite)
                : (currentChapter as any)?.id
                ? [Number((currentChapter as any).id)]
                : [];

        const clearedCount = missionIds.filter(
            (mid) => !!clearedMissions[mid] || solvedMissionIds.includes(mid)
        ).length;
        return clearedCount >= 2;
    }, [selectedPlaceId, selectedPlaceIndex, currentChapterIdx, currentChapter, clearedMissions, solvedMissionIds]);

    // 미션 진행 중 강제 가드: 카테고리/장소 리스트가 다시 보이는 것을 방지
    const inMission = useMemo(() => Boolean(selectedPlaceId && missionUnlocked), [selectedPlaceId, missionUnlocked]);
    useEffect(() => {
        if (flowStep === "done") return; // 엔딩 중에는 단계 고정
        if (inMission && flowStep !== "mission") {
            setFlowStep("mission");
        }
    }, [inMission, flowStep]);

    // 배경음 세팅 (비활성화: 성능/UX 향상 위해 오디오 재생 제거)
    const ENABLE_ESCAPE_AUDIO = false;
    useEffect(() => {
        if (!ENABLE_ESCAPE_AUDIO) return;
        try {
            if (!introBgmRef.current) {
                const a = new Audio("/sounds/intro.mp3");
                a.loop = true;
                a.volume = 0.0;
                introBgmRef.current = a;
                // a.play().catch(() => {});
            }
        } catch {}
    }, []);

    // 브라우저 뒤로가기 처리
    useEffect(() => {
        const handlePopState = () => {
            // 카테고리 화면에서 뒤로가기를 누른 경우
            if (flowStep === "category" && selectedCategory) {
                setSelectedCategory(null);
                setSelectedPlaceId(null);
                setSelectedPlaceIndex(null);
                setSelectedPlaceConfirm(null);
                setMissionUnlocked(false);
                setInSelectedRange(false);
                setFlowStep("category");
            }
            // 장소 목록 화면에서 뒤로가기를 누른 경우
            else if (flowStep === "placeList" && selectedCategory) {
                setSelectedCategory(null);
                setSelectedPlaceId(null);
                setSelectedPlaceIndex(null);
                setSelectedPlaceConfirm(null);
                setMissionUnlocked(false);
                setInSelectedRange(false);
                setFlowStep("category");
            }
            // 미션 화면에서 뒤로가기를 누른 경우
            else if (flowStep === "mission") {
                setMissionUnlocked(false);
                setSelectedPlaceId(null);
                setSelectedPlaceIndex(null);
                setSelectedPlaceConfirm(null);
                setInSelectedRange(false);
                setFlowStep("placeList");
            }
        };

        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, [flowStep, selectedCategory]);

    // 스텝 전환 효과 및 오디오 전환
    useEffect(() => {
        if (flowStep === "category") {
            setTitlePopAnim(true);
            const audio = introBgmRef.current;
            if (audio) {
                let v = audio.volume;
                const t = setInterval(() => {
                    v = Math.max(0, v - 0.05);
                    audio.volume = v;
                    if (v <= 0) {
                        audio.pause();
                        clearInterval(t);
                    }
                }, 120);
            }
            const clear = setTimeout(() => setTitlePopAnim(false), 1200);
            return () => clearTimeout(clear);
        }
        if (flowStep === "mission") {
            setNoteOpenAnim(true);
            const clear = setTimeout(() => setNoteOpenAnim(false), 1000);
            return () => clearTimeout(clear);
        }
        if (!ENABLE_ESCAPE_AUDIO) return;
        if (flowStep === "done") {
            try {
                if (!endingBgmRef.current) {
                    const a = new Audio("/sounds/ending.mp3");
                    a.loop = true;
                    a.volume = 0.0;
                    endingBgmRef.current = a;
                    // a.play().catch(() => {});
                }
            } catch {}
        }
    }, [flowStep]);

    // 엔딩 화면 기본값 보장: done 단계에서 endingStep이 비어 있고, 별도 플로우 시작 표시가 없을 때만 epilogue로 세팅
    useEffect(() => {
        if (flowStep === "done" && !endingStep && !endingFlowStarted) {
            setEndingStep("epilogue");
        }
    }, [flowStep, endingStep, endingFlowStarted]);

    const handleToggleSelectPhoto = (url: string) => {
        setSelectedGallery((prev) => {
            if (prev.includes(url)) return prev.filter((u) => u !== url);
            if (prev.length >= 4) return prev; // 최대 4장
            return [...prev, url];
        });
    };

    // 썸네일 클릭: 선택된 항목을 다시 클릭하면 즉시 선택 해제
    const handleClickPhoto = (url: string) => {
        const isSelected = selectedGallery.includes(url);
        if (isSelected) {
            setSelectedGallery((prev) => prev.filter((u) => u !== url));
            setSwapFrom(null);
            return;
        }
        if (selectedGallery.length >= requiredPhotoCount) return; // 최대 프레임 수 제한
        setSelectedGallery((prev) => [...prev, url]);
    };

    const renderCollage = async () => {
        const urls = (
            Array.isArray(selectedGallery) && selectedGallery.length > 0 ? selectedGallery : galleryUrls || []
        ).slice(0, requiredPhotoCount);

        if (urls.length !== requiredPhotoCount) {
            console.warn("템플릿 합성에 필요한 사진 수가 부족합니다");
            setToast(`사진 ${requiredPhotoCount}장을 선택해주세요`);
            return;
        }

        const canvas = collageCanvasRef.current || document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            console.error("Canvas context를 생성할 수 없습니다");
            return;
        }

        const FRAME_OVERLAP = 0;

        // DB에서 템플릿 조회
        let bgUrl = getS3StaticUrl("hongdaeEscape_tamplete.png");
        let framesFromDB: Array<{ x: number; y: number; w: number; h: number }> | null = null;
        let templateWidth: number | null = null;
        let templateHeight: number | null = null;
        try {
            const res = await fetch(`/api/collages/templates?storyId=${storyId}`, { cache: "no-store" });
            const data = await res.json();
            const list = Array.isArray(data?.templates) ? data.templates : [];
            // API가 storyId 우선으로 정렬하므로 첫 번째 항목을 기본 선택
            const t = list[0];

            if (t) {
                if (t.imageUrl) bgUrl = String(t.imageUrl);
                if (t.framesJson && Array.isArray(t.framesJson)) framesFromDB = t.framesJson as any;
                if (typeof t?.width === "number") templateWidth = Number(t.width);
                if (typeof t?.height === "number") templateHeight = Number(t.height);
            }
        } catch (err) {
            console.warn("템플릿 조회 실패, 기본값 사용:", err);
        }

        // ✅ CORS 안전한 이미지 로딩 (타임아웃 포함)
        const loadImageSafe = (src: string): Promise<HTMLImageElement> => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = "anonymous";

                const isExternal = /^https?:\/\//i.test(src) && !src.startsWith(location.origin);
                const finalSrc = isExternal ? `/api/image-proxy?url=${encodeURIComponent(src)}` : src;

                const timeout = setTimeout(() => {
                    img.src = "";
                    reject(new Error(`이미지 로딩 타임아웃: ${src.slice(0, 50)}...`));
                }, 15000);

                img.onload = () => {
                    clearTimeout(timeout);
                    console.log("✅ 이미지 로드 성공:", finalSrc.slice(0, 80));
                    resolve(img);
                };

                img.onerror = () => {
                    clearTimeout(timeout);
                    console.error("❌ 이미지 로드 실패:", finalSrc);
                    reject(new Error(`이미지 로드 실패: ${src.slice(0, 50)}...`));
                };

                img.src = finalSrc;
            });
        };

        try {
            console.log("🎨 템플릿 합성 시작...");
            console.log("📦 배경 템플릿:", bgUrl);
            console.log("📸 사용자 사진:", urls.length, "장");

            const [bg, ...photos] = await Promise.all([
                loadImageSafe(bgUrl),
                ...urls.map((u, i) => {
                    console.log(`📥 사진 ${i + 1} 로딩 중:`, u.slice(0, 80));
                    return loadImageSafe(u);
                }),
            ]);

            console.log("✅ 모든 이미지 로드 완료");

            // ⭐ 템플릿 기준 크기 (메타 > 배경 원본 > 기본값)
            // 스케일 기준을 템플릿 메타로 고정 (없으면 1080x1920)
            const baseW = templateWidth ?? 1080;
            const baseH = templateHeight ?? 1920;

            // 출력 고정 크기
            const outW = 1080;
            const outH = 1920;

            // 필요 시 고해상도 저장을 위해 DPR 적용 가능
            // const dpr = window.devicePixelRatio || 1;
            // canvas.width = Math.round(outW * dpr);
            // canvas.height = Math.round(outH * dpr);
            // ctx.scale(dpr, dpr);

            canvas.width = outW;
            canvas.height = outH;
            console.log("📐 템플릿 기준 크기:", baseW, "x", baseH);
            console.log("📐 캔버스 크기(고정):", canvas.width, "x", canvas.height);

            // 배경을 템플릿 크기에 강제로 맞춰서 그리기
            ctx.drawImage(bg, 0, 0, outW, outH);

            // 프레임 좌표 (DB 우선, 없으면 기본값 - 1080x1920 기준)
            let framesData = framesFromDB || [
                { x: 310, y: 270, w: 460, h: 360 },
                { x: 310, y: 680, w: 460, h: 360 },
                { x: 310, y: 1090, w: 460, h: 360 },
                { x: 310, y: 1500, w: 460, h: 360 },
            ];
            // 스케일 변환: base → 출력
            const sx = outW / baseW;
            const sy = outH / baseH;
            const frames = framesData.map((f: any) => ({
                x: Math.round(f.x * sx),
                y: Math.round(f.y * sy),
                w: Math.round(f.w * sx),
                h: Math.round(f.h * sy),
            }));
            console.log("📍 프레임 좌표:", frames);

            // 각 프레임 합성
            photos.forEach((img, i) => {
                if (!frames[i]) {
                    console.warn(`⚠️ 프레임 ${i}가 없습니다`);
                    return;
                }

                const original = frames[i];
                const f = {
                    x: original.x - FRAME_OVERLAP,
                    y: original.y - FRAME_OVERLAP,
                    w: original.w + FRAME_OVERLAP * 2,
                    h: original.h + FRAME_OVERLAP * 2,
                };

                ctx.save();
                ctx.filter = "sepia(0.2) contrast(0.95) brightness(1.0) saturate(0.9)";
                ctx.beginPath();
                ctx.rect(f.x, f.y, f.w, f.h);
                ctx.clip();

                const imgRatio = img.naturalWidth / img.naturalHeight;
                const frameRatio = f.w / f.h;
                let drawWidth: number, drawHeight: number, offsetX: number, offsetY: number;
                if (imgRatio > frameRatio) {
                    drawHeight = f.h;
                    drawWidth = drawHeight * imgRatio;
                    offsetX = f.x - (drawWidth - f.w) / 2;
                    offsetY = f.y;
                } else {
                    drawWidth = f.w;
                    drawHeight = drawWidth / imgRatio;
                    offsetX = f.x;
                    offsetY = f.y - (drawHeight - f.h) / 2;
                }
                ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

                // 회색 덧칠 제거
                // ctx.filter = "none";
                // ctx.fillStyle = "rgba(250, 245, 235, 0.15)";
                // ctx.fillRect(f.x, f.y, f.w, f.h);
                ctx.restore();

                console.log(`✅ 사진 ${i + 1} 합성 완료 (${f.x}, ${f.y}, ${f.w}x${f.h})`);
            });

            const preview = canvas.toDataURL("image/jpeg", 0.93);
            setCollagePreviewUrl(preview);
            collageCanvasRef.current = canvas;
            console.log("🎉 템플릿 합성 완료!");
            console.log("📊 결과 이미지 크기:", Math.round(preview.length / 1024), "KB");
        } catch (error: any) {
            console.error("❌ 템플릿 합성 실패:", error);
            setToast(`이미지 합성 실패: ${error.message || "알 수 없는 오류"}`);
            throw error;
        }
    };

    const handleDownloadCollage = async () => {
        await renderCollage();
        const canvas = collageCanvasRef.current;
        if (!canvas) return;
        if (canvas.toBlob) {
            canvas.toBlob(
                async (blob) => {
                    if (!blob) return;
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "hongdae-secret-letter-collage.jpg";
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                    setEndingStep("badge");
                },
                "image/jpeg",
                0.95
            );
        } else {
            // 폴백: 일부 구형 브라우저
            const a = document.createElement("a");
            a.href = canvas.toDataURL("image/jpeg", 0.95);
            a.download = "hongdae-secret-letter-collage.jpg";
            document.body.appendChild(a);
            a.click();
            a.remove();
            setEndingStep("badge");
        }
    };

    const getCollageBlob = async (): Promise<Blob | null> => {
        try {
            await renderCollage();
            const canvas = collageCanvasRef.current;
            if (!canvas) {
                console.error("캔버스를 찾을 수 없습니다");
                return null;
            }
            return await new Promise<Blob | null>((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error("Blob 생성 타임아웃")), 10000);
                canvas.toBlob(
                    (blob) => {
                        clearTimeout(timeout);
                        if (blob) {
                            console.log("✅ Blob 생성 완료:", Math.round(blob.size / 1024), "KB");
                            resolve(blob);
                        } else {
                            console.error("❌ Blob 생성 실패");
                            reject(new Error("Blob 생성 실패"));
                        }
                    },
                    "image/jpeg",
                    0.93
                );
            });
        } catch (error) {
            console.error("getCollageBlob 오류:", error);
            return null;
        }
    };

    // 템플릿 배경 이미지 URL 해석 (DB 템플릿 우선, 없으면 기본값)
    const resolveTemplateBackgroundUrl = async (): Promise<string> => {
        let bgUrl = getS3StaticUrl("hongdaeEscape_tamplete.png");
        try {
            const res = await fetch("/api/collages/templates", { cache: "no-store" });
            const data = await res.json();
            const list = Array.isArray(data?.templates) ? data.templates : [];
            const t =
                list.find(
                    (it: any) =>
                        String(it?.name || "")
                            .toLowerCase()
                            .includes("hongdae") || String(it?.imageUrl || "").includes("hongdaelatter_template")
                ) || list[0];
            if (t) {
                if (t.imageUrl) bgUrl = String(t.imageUrl);
            }
        } catch {}
        return bgUrl;
    };

    // 미리보기 모달이 열리면 다운로드 이미지와 동일한 합성 결과로 미리보기 생성
    useEffect(() => {
        if (!showCollagePreview) return;
        (async () => {
            try {
                await renderCollage();
            } catch {}
        })();
    }, [showCollagePreview, selectedGallery, galleryUrls, framePreviewTemplate]);

    // 콜라주 자동 저장: 캔버스 → 업로드 → /api/collages 저장
    const autoSaveCollage = async (): Promise<string | null> => {
        try {
            // 이미 저장된 URL이 있으면 그대로 재사용 (1회만 저장)
            if (savedCollageUrl && typeof savedCollageUrl === "string") {
                return savedCollageUrl;
            }
            try {
                const fromStorage = typeof window !== "undefined" ? localStorage.getItem(COLLAGE_URL_KEY) : null;
                if (fromStorage) {
                    setSavedCollageUrl(fromStorage);
                    return fromStorage;
                }
            } catch {}

            const blob = await getCollageBlob();
            if (!blob) return null;
            const form = new FormData();
            form.append("photos", new File([blob], "collage.jpg", { type: "image/jpeg" }));
            const up = await fetch("/api/upload", { method: "POST", body: form, credentials: "include" });
            if (!up.ok) return null;
            const ur = await up.json();
            const url: string | undefined = Array.isArray(ur?.photo_urls) ? ur.photo_urls[0] : undefined;
            if (!url) return null;
            try {
                await fetch("/api/collages", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ storyId, collageUrl: url }),
                });
            } catch {}
            try {
                localStorage.setItem(COLLAGE_URL_KEY, url);
            } catch {}
            setSavedCollageUrl(url);
            return url;
        } catch {
            return null;
        }
    };

    // 공유/저장 후 배지 지급과 완료 기록 저장
    const awardBadgeAndComplete = async () => {
        try {
            // 배지 조회 → 지급
            try {
                const br = await fetch(`/api/escape/badge?storyId=${storyId}`);
                const bd = await br.json();
                if (br.ok && bd?.badge && bd.badge.id) {
                    // 🟢 쿠키 기반 인증: authenticatedFetch 사용
                    const { authenticatedFetch } = await import("@/lib/authClient");
                    await authenticatedFetch("/api/users/badges", {
                        method: "POST",
                        body: JSON.stringify({ badgeId: bd.badge.id }),
                    }).catch(() => {});
                    setBadge(bd.badge);
                }
            } catch {}

            // 템플릿 자동 저장 → 완료 기록 저장 (마이페이지 사건 파일에 반영)
            try {
                try {
                    await autoSaveCollage();
                } catch {}
                // 🟢 쿠키 기반 인증: authenticatedFetch 사용
                const { authenticatedFetch } = await import("@/lib/authClient");
                await authenticatedFetch("/api/escape/complete", {
                    method: "POST",
                    body: JSON.stringify({ storyId }),
                }).catch(() => {});
            } catch {}
        } catch {
        } finally {
            // 서버 오류가 있어도 배지 단계로 이동하여 사용자 흐름 유지
            setEndingStep("badge");
        }
    };

    const handleShareToKakao = async () => {
        try {
            setIsSharing(true);

            // 선택된 이미지 확인
            if (selectedGallery.length !== requiredPhotoCount) {
                setToast(`사진 ${requiredPhotoCount}장을 선택해주세요`);
                setIsSharing(false);
                return;
            }

            setToast("템플릿을 생성하는 중...");
            const blob = await getCollageBlob();
            if (!blob) {
                setToast("이미지 생성에 실패했습니다");
                setIsSharing(false);
                return;
            }

            setToast("이미지 업로드 중...");
            let imageUrl = await autoSaveCollage();
            if (!imageUrl) {
                // 수동 업로드 시도
                try {
                    const form = new FormData();
                    form.append("photos", new File([blob], "collage.jpg", { type: "image/jpeg" }));
                    const up = await fetch("/api/upload", { method: "POST", body: form, credentials: "include" });
                    if (up.ok) {
                        const ur = await up.json();
                        imageUrl = Array.isArray(ur?.photo_urls) ? ur.photo_urls[0] : undefined;
                    }
                } catch {}
            }

            if (!imageUrl) {
                setToast("이미지 업로드에 실패했습니다");
                setIsSharing(false);
                return;
            }

            const landingUrl = typeof window !== "undefined" ? `${window.location.origin}/mypage` : "https://dona.app";

            // Kakao JS SDK 로드 및 초기화
            const ensureKakao = () =>
                new Promise<void>((resolve, reject) => {
                    const w = window as any;
                    if (w.Kakao) return resolve();
                    const s = document.createElement("script");
                    s.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";
                    s.async = true;
                    s.onload = () => resolve();
                    s.onerror = () => reject(new Error("Kakao SDK load failed"));
                    document.head.appendChild(s);
                });

            await ensureKakao();
            const w = window as any;
            const Kakao = w.Kakao;

            if (!Kakao) {
                setToast("카카오 SDK를 불러올 수 없습니다");
                setIsSharing(false);
                return;
            }

            // JS Key 가져오기 (서버 API 우선, 없으면 클라이언트 환경 변수)
            let jsKey: string | undefined = undefined;
            try {
                const configRes = await fetch("/api/config/kakao-js-key");
                if (configRes.ok) {
                    const configData = await configRes.json();
                    jsKey = configData.jsKey;
                }
            } catch {}

            if (!jsKey) {
                jsKey =
                    (process.env.NEXT_PUBLIC_KAKAO_JS_KEY as string | undefined) ||
                    (process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY as string | undefined);
            }

            if (!jsKey) {
                setToast("카카오 공유 설정이 완료되지 않았습니다");
                setIsSharing(false);
                return;
            }

            // SDK 초기화
            if (!Kakao.isInitialized()) {
                Kakao.init(jsKey);
            }

            // 카카오톡 공유 실행 (이미지 단독 공유: 링크를 이미지 URL로 설정, 버튼 제거)
            setToast("카카오톡 공유 창을 여는 중...");
            Kakao.Share.sendDefault({
                objectType: "feed",
                content: {
                    // feed 템플릿은 title 필수 → 최소 텍스트로 설정
                    title: "이미지 보기",
                    // 설명은 생략하여 이미지 중심 카드로 표시
                    description: "",
                    imageUrl: imageUrl,
                    // 클릭 시 이미지 원본으로 열리도록 링크를 이미지로 지정
                    link: {
                        mobileWebUrl: imageUrl,
                        webUrl: imageUrl,
                    },
                },
                // 버튼 없이 이미지 링크만 제공
            });

            setToast("카카오톡 공유 창이 열렸어요!");

            // 보상 및 완료 처리
            await awardBadgeAndComplete();
        } catch (error: any) {
            console.error("[카카오 공유] 에러:", error);
            setToast("카카오톡 공유 중 오류가 발생했습니다");
        } finally {
            setIsSharing(false);
        }
    };

    const handleCheckAnswer = () => {
        if (!currentChapter) return;
        const payload = currentChapter.mission_payload || {};
        const expected = payload?.answer;
        const user = puzzleAnswer.trim();
        if (expected === undefined || expected === null) {
            if (user.length === 0) {
                setValidationError("답을 입력하세요.");
                return;
            }
            setAnswerChecked(true);
            setValidationError("");
            setToast("정답입니다!");
            return;
        }
        if (normalize(user) === normalize(expected)) {
            setAnswerChecked(true);
            setValidationError("");
            setToast("정답입니다!");
        } else {
            setValidationError("정답이 아니에요");
        }
    };

    const goToNextChapter = async () => {
        if (!currentChapter || isSubmitting) return;
        if (!canProceed) {
            setValidationError("미션을 완료해야 다음으로 진행할 수 있어요.");
            return;
        }

        setIsSubmitting(true);
        setValidationError("");
        setToast("미션 결과를 제출하는 중...");

        try {
            const missionType = String(currentChapter.mission_type || "").toUpperCase();
            // chapterId는 placeOption.id(= selectedPlaceId)를 사용해야 엔딩 조회와 정확히 매칭됩니다.
            let submissionPayload: any = { chapterId: Number(selectedPlaceId ?? currentChapter.id), isCorrect: true };
            try {
                console.log("[DEBUG-0] submit start", {
                    missionType,
                    canProceed,
                    isSubmitting,
                    photoFilesLen: Array.isArray(photoFiles) ? photoFiles.length : null,
                });
            } catch {}

            if (missionType === "PHOTO") {
                if (photoFiles.length < 2) throw new Error("사진 2장을 업로드해 주세요.");

                setToast("사진을 압축하고 있어요...");
                const options = { maxSizeMB: 1.5, maxWidthOrHeight: 1920, useWebWorker: true };
                // Blob -> File 변환하여 filename/content-type 누락 방지
                const compressedFiles = await Promise.all(
                    photoFiles.map(async (orig, idx) => {
                        const blob = await imageCompression(orig, options);
                        const ext = (orig.type?.split("/")[1] || "jpg").toLowerCase();
                        const safeName = orig.name || `photo_${idx + 1}.${ext}`;
                        return new File([blob], safeName, { type: "image/jpeg" });
                    })
                );

                const formData = new FormData();
                compressedFiles.forEach((f) => formData.append("photos", f, f.name));
                
                // 탈출방 업로드를 위한 파라미터 추가
                formData.append("type", "escape");
                formData.append("escapeId", storyId.toString());
                
                try {
                    console.log(
                        "[Upload] files",
                        compressedFiles.map((f) => ({ name: f.name, type: f.type, size: f.size }))
                    );
                    console.log("[photoFiles]", photoFiles);
                    for (const [key, value] of (formData as any).entries()) {
                        const v: any = value as any;
                        console.log("FormData entry:", key, v?.name || v);
                    }
                } catch {}

                setToast("사진을 업로드하는 중...");
                try {
                    console.log("[DEBUG-1] Upload start", formData);
                } catch {}
                const uploadResponse = await fetch("/api/upload", {
                    method: "POST",
                    body: formData,
                    credentials: "include",
                    cache: "no-store",
                });
                try {
                    console.log("[DEBUG-2] Upload response status:", uploadResponse.status);
                } catch {}

                if (!uploadResponse.ok) {
                    const errText = await uploadResponse.text().catch(() => "(no response)");
                    throw new Error(`업로드 실패: ${errText}`);
                }

                // 응답 파싱: JSON 실패 시 raw text로 재시도
                let uploadResult: any = null;
                let rawText: string | null = null;
                try {
                    uploadResult = await uploadResponse.json();
                } catch (e) {
                    try {
                        rawText = await uploadResponse.text();
                        uploadResult = JSON.parse(rawText);
                    } catch {
                        throw new Error(`업로드 응답 파싱 실패: ${String(rawText || "(empty)").slice(0, 200)}`);
                    }
                }
                try {
                    console.log("[DEBUG-3] UploadResult:", uploadResult);
                } catch {}
                // snake_case 또는 camelCase 모두 지원
                let urls = (uploadResult as any)?.photo_urls || (uploadResult as any)?.photoUrls;
                try {
                    console.log("[urls]", urls);
                } catch {}
                if (!urls || urls.length === 0) {
                    // 업로드 응답 파싱 실패 시 직전 성공값으로 폴백
                    urls = Array.isArray(lastUploadedUrls) && lastUploadedUrls.length > 0 ? lastUploadedUrls : [];
                    try {
                        console.warn("[WARN] urls empty, fallback to lastUploadedUrls:", urls);
                    } catch {}
                    if (!urls || urls.length === 0) {
                        throw new Error("업로드된 사진 URL을 받지 못했습니다.");
                    }
                }
                // ✅ camelCase로 통일하여 서버에 전송
                submissionPayload.photoUrls = urls;
                try {
                    console.log("[DEBUG-4] submissionPayload:", submissionPayload);
                } catch {}
                if (Array.isArray(urls)) setLastUploadedUrls(urls);

                // 통합 제출 사용
                const r = await submitMission({
                    chapterId: Number(selectedPlaceId ?? currentChapter?.id),
                    missionType,
                    photoUrls: urls,
                    isCorrect: true,
                });
                if (!r.success) throw new Error(r.error || "미션 저장 실패");

                // ✅ 사진 업로드 성공 후 상태 저장
                setPhotoUploaded(true);
                try {
                    const raw = localStorage.getItem(STORAGE_KEY);
                    const obj = raw ? JSON.parse(raw) : {};
                    obj[String(currentChapter.chapter_number)] = {
                        ...obj[String(currentChapter.chapter_number)],
                        photo: true,
                    };
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
                } catch {}

                // ✅ 미션 완료 처리 (해당 미션만 완료 표시)
                if (activeMission?.id != null) {
                    setSolvedMissionIds((prev) => Array.from(new Set([...prev, Number(activeMission.id)])));
                    setClearedMissions((prev) => ({
                        ...prev,
                        [Number(activeMission.id)]: true,
                    }));
                }

                // ✅ 미션이 2개 완료되었는지 확인
                const place = (currentChapter?.placeOptions || []).find(
                    (p: any) => Number(p.id) === Number(selectedPlaceId)
                );
                const placeMissions: any[] = Array.isArray((place as any)?.missions) ? (place as any).missions : [];
                const placeMissionIds: number[] =
                    placeMissions.length > 0 ? placeMissions.map((m: any) => Number(m.id)).filter(Number.isFinite) : [];
                const placeClearedCount = placeMissionIds.filter((mid) => {
                    if (mid === Number(activeMission?.id)) return true; // 방금 완료한 미션
                    return clearedMissions[mid] || solvedMissionIds.includes(mid);
                }).length;

                // ✅ 장소 미션 4개 모두 완료 시 AI 쿠폰 1개 지급(서버 측 중복 방지 + 로컬 1회 플래그)
                try {
                    const total = placeMissionIds.length;
                    if (total >= 4 && placeClearedCount >= total && Number(selectedPlaceId)) {
                        let already = false;
                        try {
                            const raw = localStorage.getItem(STORAGE_KEY);
                            const obj = raw ? JSON.parse(raw) : {};
                            const awarded = Array.isArray(obj.__couponAwardedPlaces) ? obj.__couponAwardedPlaces : [];
                            already = awarded.includes(Number(selectedPlaceId));
                            if (!already) {
                                // 🟢 쿠키 기반 인증: authenticatedFetch 사용
                                const { authenticatedFetch } = await import("@/lib/authClient");
                                await authenticatedFetch("/api/escape/award-coupon", {
                                    method: "POST",
                                    body: JSON.stringify({ placeId: Number(selectedPlaceId) }),
                                }).catch(() => {});
                                const next = Array.from(new Set([...(awarded || []), Number(selectedPlaceId)]));
                                obj.__couponAwardedPlaces = next;
                                localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
                                setToast("AI 추천 쿠폰 1개가 지급되었습니다.");
                            }
                        } catch {}
                    }
                } catch {}

                // ✅ 미션이 2개 완료되었을 때 카테고리 완료 처리 (자동 이동 제거)
                if (placeClearedCount >= 2) {
                    try {
                        const catKey = normalizeCategory((place as any)?.category || (place as any)?.type || "");
                        if (catKey) {
                            setCompletedCategories((prev) => {
                                const next = Array.from(new Set([...(prev || []), catKey]));
                                try {
                                    const raw = localStorage.getItem(STORAGE_KEY);
                                    const obj = raw ? JSON.parse(raw) : {};
                                    obj.__completedCategories = next;
                                    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
                                } catch {}
                                return next;
                            });
                        }
                    } catch {}

                    // 모달 닫고 미션 목록으로 돌아감 (버튼 클릭으로 이동)
                    setMissionModalOpen(false);
                    setActiveMission(null);
                    setPhotoFiles([]);
                    setPhotoPreviewUrl(null);
                    setPhotoPreviewUrls([]);
                    setPhotoUploaded(false);
                    setToast("미션 완료! 다음 카테고리로 버튼을 눌러주세요.");
                } else {
                    // 미션이 2개 미완료인 경우: 모달만 닫고 미션 목록으로 돌아감
                    setMissionModalOpen(false);
                    setActiveMission(null);
                    setPhotoFiles([]);
                    setPhotoPreviewUrl(null);
                    setPhotoPreviewUrls([]);
                    setPhotoUploaded(false);
                    setToast("미션 완료!");
                }

                setIsSubmitting(false);
                return;
            } else if (missionType === "PUZZLE_ANSWER") {
                const r = await submitMission({
                    chapterId: Number(selectedPlaceId ?? currentChapter?.id),
                    missionType,
                    isCorrect: true,
                    textAnswer: puzzleAnswer,
                });
                if (!r.success) throw new Error(r.error || "미션 저장 실패");

                // ✅ 미션 완료 처리 (해당 미션만 완료 표시)
                if (activeMission?.id != null) {
                    setSolvedMissionIds((prev) => Array.from(new Set([...prev, Number(activeMission.id)])));
                    setClearedMissions((prev) => ({
                        ...prev,
                        [Number(activeMission.id)]: true,
                    }));
                }

                // ✅ 미션이 2개 완료되었는지 확인
                const place = (currentChapter?.placeOptions || []).find(
                    (p: any) => Number(p.id) === Number(selectedPlaceId)
                );
                const placeMissions: any[] = Array.isArray((place as any)?.missions) ? (place as any).missions : [];
                const placeMissionIds: number[] =
                    placeMissions.length > 0 ? placeMissions.map((m: any) => Number(m.id)).filter(Number.isFinite) : [];
                const placeClearedCount = placeMissionIds.filter((mid) => {
                    if (mid === Number(activeMission?.id)) return true; // 방금 완료한 미션
                    return clearedMissions[mid] || solvedMissionIds.includes(mid);
                }).length;

                // ✅ 장소 미션 4개 모두 완료 시 AI 쿠폰 1개 지급(서버 측 중복 방지 + 로컬 1회 플래그)
                try {
                    const total = placeMissionIds.length;
                    if (total >= 4 && placeClearedCount >= total && Number(selectedPlaceId)) {
                        let already = false;
                        try {
                            const raw = localStorage.getItem(STORAGE_KEY);
                            const obj = raw ? JSON.parse(raw) : {};
                            const awarded = Array.isArray(obj.__couponAwardedPlaces) ? obj.__couponAwardedPlaces : [];
                            already = awarded.includes(Number(selectedPlaceId));
                            if (!already) {
                                // 🟢 쿠키 기반 인증: authenticatedFetch 사용
                                const { authenticatedFetch } = await import("@/lib/authClient");
                                await authenticatedFetch("/api/escape/award-coupon", {
                                    method: "POST",
                                    body: JSON.stringify({ placeId: Number(selectedPlaceId) }),
                                }).catch(() => {});
                                const next = Array.from(new Set([...(awarded || []), Number(selectedPlaceId)]));
                                obj.__couponAwardedPlaces = next;
                                localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
                                setToast("AI 추천 쿠폰 1개가 지급되었습니다.");
                            }
                        } catch {}
                    }
                } catch {}

                // ✅ 미션이 2개 완료되었을 때 카테고리 완료 처리 (자동 이동 제거)
                if (placeClearedCount >= 2) {
                    try {
                        const catKey = normalizeCategory((place as any)?.category || (place as any)?.type || "");
                        if (catKey) {
                            setCompletedCategories((prev) => {
                                const next = Array.from(new Set([...(prev || []), catKey]));
                                try {
                                    const raw = localStorage.getItem(STORAGE_KEY);
                                    const obj = raw ? JSON.parse(raw) : {};
                                    obj.__completedCategories = next;
                                    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
                                } catch {}
                                return next;
                            });
                        }
                    } catch {}

                    // 모달 닫고 미션 목록으로 돌아감 (버튼 클릭으로 이동)
                    setMissionModalOpen(false);
                    setActiveMission(null);
                    setModalAnswer("");
                    setToast("미션 완료! 다음 카테고리로 버튼을 눌러주세요.");
                } else {
                    // 미션이 2개 미완료인 경우: 모달만 닫고 미션 목록으로 돌아감
                    setMissionModalOpen(false);
                    setActiveMission(null);
                    setModalAnswer("");
                    setToast("미션 완료!");
                }

                setIsSubmitting(false);
                return;
            } else {
                try {
                    console.log("[DEBUG-NON-PHOTO] missionType branch:", missionType);
                } catch {}
                // 다른 미션 타입의 경우 기본 처리
                setToast("미션 완료!");
                setIsSubmitting(false);
            }
        } catch (error: any) {
            setValidationError(error.message || "오류가 발생했습니다.");
            setToast(null);
        } finally {
            setIsSubmitting(false);
        }
    };

    const goToPrevChapter = () => {
        if (currentChapterIdx > 0) {
            const prevIdx = currentChapterIdx - 1;
            const prevChapter = chapters[prevIdx];
            setCurrentChapterIdx(prevIdx);
            setDialogueStep(0);
            // 편지는 prologue 단계에서만 표시
            if (prevChapter?.chapter_number === 1 && flowStep === "prologue") {
                setIsDialogueActive(true);
            } else {
                setIsDialogueActive(false);
            }
        }
    };

    // ✨ 다음 카테고리 선택 화면으로 이동 (서버 제출 없이 UI 전환)
    const advanceToNextCategory = () => {
        if (isSubmitting) return;

        try {
            const firstPlace: any = (currentChapter as any)?.placeOptions?.[0] || null;
            const categoryKey = normalizeCategory(firstPlace?.category || firstPlace?.type || "");
            if (categoryKey) {
                setCompletedCategories((prev) => {
                    const updated = Array.from(new Set([...(prev || []), categoryKey]));
                    try {
                        const raw = localStorage.getItem(STORAGE_KEY);
                        const obj = raw ? JSON.parse(raw) : {};
                        obj.__completedCategories = updated;
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
                    } catch {}
                    return updated;
                });
            }
        } catch {}

        // 1) 현재 선택된 장소의 스토리가 있으면, 다음 카테고리로 넘어가기 전에 해당 스토리를 먼저 노출
        try {
            const place = (currentChapter?.placeOptions || []).find(
                (p: any) => Number(p.id) === Number(selectedPlaceId)
            );
            const queue: string[] = Array.isArray((place as any)?.stories)
                ? (place as any).stories
                      .map((s: any) => String(s?.dialogue || s?.narration || s || "").trim())
                      .filter(Boolean)
                : [];
            const nextIdxCandidate = currentChapterIdx + 1 < chapters.length ? currentChapterIdx + 1 : null;
            if (queue.length > 0) {
                setPostStoryQueue(queue);
                setPostStoryIdx(0);
                setShowPostStory(true);
                setPendingNextChapterIdx(nextIdxCandidate);
                // 조각 획득은 스토리 모달 종료 시점에 pieceAward 단계에서 처리됨
                return;
            }
        } catch {}

        const nextIdx = currentChapterIdx + 1;
        if (nextIdx < chapters.length) {
            // 스토리가 없는 경우에는 바로 조각 카운트 증가 후 다음 카테고리로 이동
            setPiecesCollected((n) => n + 1);
            setCurrentChapterIdx(nextIdx);
            changeFlowStep("category", { resetMission: true, resetPlace: true });
            setDialogueStep(0);
            setSelectedCategory(null);
            try {
                localStorage.setItem(`escape_letter_shown_${storyId}`, "1");
                setIsLetterOpened(true);
            } catch {}
            return;
        }

        // 모든 카테고리 완료 → 엔딩 진입(가드 포함)
        if (endingFlowStarted) {
            setFlowStep("done");
            setEndingStep((prev) => (prev ? prev : "epilogue"));
            return;
        }
        setEndingFlowStarted(true);
        setIsEndFlip(true);
        setFlowStep("done");
        setTimeout(async () => {
            setIsEndFlip(false);
            try {
                const res = await fetch(`/api/escape/submissions?storyId=${storyId}`, { credentials: "include" });
                const data = await res.json();
                if (res.ok && Array.isArray(data?.urls)) setGalleryUrls(data.urls);
            } catch {}

            // [추가] 스토리 완료 기록 저장 (마이페이지 연동용)
            try {
                // 🟢 쿠키 기반 인증: authenticatedFetch 사용
                const { authenticatedFetch } = await import("@/lib/authClient");
                await authenticatedFetch("/api/escape/complete", {
                    method: "POST",
                    body: JSON.stringify({ storyId }),
                });
            } catch (e) {
                console.error("스토리 완료 처리 실패:", e);
            }

            try {
                const br = await fetch(`/api/escape/badge?storyId=${storyId}`);
                const bd = await br.json();
                if (br.ok && bd?.badge) {
                    setBadge(bd.badge);
                    if (bd.badge.id) {
                        // 🟢 쿠키 기반 인증: authenticatedFetch 사용
                        const { authenticatedFetch } = await import("@/lib/authClient");
                        await authenticatedFetch("/api/users/badges", {
                            method: "POST",
                            body: JSON.stringify({ badgeId: bd.badge.id }),
                        });
                    }
                }
            } catch {}
            setEndingStep("epilogue");
        }, 800);
    };
    // 1️⃣ chapters를 useMemo로 감싸기
    const memoChapters = useMemo(() => chapters, [chapters?.length]);
    // 카테고리 매칭 유틸: 다양한 표기를 하나의 키로 정규화 (availableCategoryKeys에서 사용하므로 먼저 선언)
    const normalizeCategory = (raw: unknown): string => {
        const s = String(raw || "")
            .toLowerCase()
            .replace(/\s+/g, "");
        if (["cafe", "카페", "카페투어"].includes(s)) return "cafe";
        // restaurant 계열 → lunch(점심)로 통일
        if (["lunch", "점심", "restaurant", "food", "맛집", "음식점", "식사", "레스토랑"].includes(s)) return "lunch";
        if (["date", "walk", "산책", "데이트"].includes(s)) return "date";
        // 저녁은 dinner 로 고정
        if (["dinner", "다이닝"].includes(s)) return "dinner";
        // 야경은 nightview 로 고정
        if (["night", "nightview", "야경"].includes(s)) return "nightview";
        if (s === "") return "misc";
        return s;
    };
    // 스토리에 실제 존재하는 카테고리만 버튼으로 노출
    const availableCategoryKeys = useMemo(() => {
        const s = new Set<string>();
        (chapters || []).forEach((ch: any) => {
            const first = (ch?.placeOptions || [])[0];
            const k = normalizeCategory(first?.category || first?.type || "");
            if (k) s.add(k);
        });
        return Array.from(s);
    }, [chapters]);

    // 2️⃣ useEffect에서 memoChapters 사용
    useEffect(() => {
        if (!currentChapter) return;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const obj = raw ? JSON.parse(raw) : {};
            const saved = obj[String(currentChapter.chapter_number)] || {};
            setPuzzleAnswer(saved.answer || "");
            setSelectedOptionIndex(typeof saved.option === "number" ? saved.option : null);
            const wasPhotoUploaded = !!saved.photo;
            setPhotoUploaded(wasPhotoUploaded);
            // 사진이 이미 업로드된 경우가 아니면 사진 파일 초기화
            // (사진 업로드 후 나갔다가 다시 들어온 경우를 위해)
            if (!wasPhotoUploaded) {
                setPhotoFiles([]);
                setPhotoPreviewUrl(null);
                setPhotoPreviewUrls([]);
            }
        } finally {
            setAnswerChecked(false);
            setValidationError("");
        }
    }, [currentChapterIdx, memoChapters, STORAGE_KEY]);

    useEffect(() => {
        const beforeUnload = () => {
            if (!currentChapter) return;
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                const obj = raw ? JSON.parse(raw) : {};
                obj[String(currentChapter.chapter_number)] = {
                    ...obj[String(currentChapter.chapter_number)],
                    answer: puzzleAnswer,
                    option: selectedOptionIndex,
                    photo: photoUploaded,
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
            } catch {}
        };
        window.addEventListener("beforeunload", beforeUnload);
        return () => window.removeEventListener("beforeunload", beforeUnload);
    }, [STORAGE_KEY, currentChapter, puzzleAnswer, selectedOptionIndex, photoUploaded]);

    useEffect(() => {
        if (resumed || chapters.length === 0) return;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return setResumed(true);
            const obj = JSON.parse(raw) || {};
            const completedNumbers = Object.keys(obj)
                .filter((k) => obj[k]?.completed)
                .map(Number)
                .filter(Number.isFinite)
                .sort((a, b) => a - b);

            if (completedNumbers.length > 0) {
                const lastCompleted = completedNumbers.pop()!;
                const nextChapterIndex = chapters.findIndex((c) => c.chapter_number === lastCompleted + 1);
                if (nextChapterIndex !== -1) setCurrentChapterIdx(nextChapterIndex);
            }

            // 초기 진입에서는 완료 카테고리를 복원하지 않는다. (미션 완료 시점에만 세팅)
        } catch {}
        setResumed(true);
    }, [chapters, STORAGE_KEY, resumed]);

    const matchesSelectedCategory = (place: any, sel: string | null): boolean => {
        if (!sel) return true;
        const normalizedSel = normalizeCategory(sel);
        const placeCat = normalizeCategory(place?.category || place?.type || "");
        if (!placeCat) return false; // 선택된 카테고리일 때는 비분류 항목 제외
        if (normalizedSel === placeCat) return true;
        // 보조 매칭: date ↔ walk
        if (normalizedSel === "date" && ["walk"].includes(placeCat)) return true;
        return false;
    };

    // 선택된 장소의 모든 미션을 반환 (없으면 챕터 대표 미션으로 폴백)
    const getSelectedPlaceMissions = (): any[] => {
        const placeList = (currentChapter as any)?.placeOptions || [];
        const placeById = selectedPlaceId ? placeList.find((p: any) => Number(p.id) === Number(selectedPlaceId)) : null;
        const placeByIndex = placeById || (selectedPlaceIndex != null ? placeList[selectedPlaceIndex as number] : null);
        const missions = Array.isArray((placeByIndex as any)?.missions) ? (placeByIndex as any).missions : [];
        if (missions.length > 0) return missions;
        // 폴백: 기존 챕터 대표 미션을 하나의 리스트로 노출
        if (currentChapter && (currentChapter as any).mission_type) {
            return [
                {
                    id: (currentChapter as any).id,
                    missionType: (currentChapter as any).mission_type,
                    missionPayload: (currentChapter as any).mission_payload || {},
                },
            ];
        }
        return [];
    };

    if (loading) {
        return <LoadingSpinner />;
    }
    // 종로/익선 스토리 식별 (훅 사용 금지: 조기 리턴 경로에서도 훅 순서 고정)
    const isJongroStory = (() => {
        const text = `${String(story?.title || "")} ${String((story as any)?.region || "")} ${String(
            (story as any)?.stationName || ""
        )}`;
        return /1919|익선|종로/i.test(text);
    })();
    // 로딩 후 웹툰/지도 전, 짧은 시계 연출 (종로 escape 한정)
    if (showPostClock && isJongroStory) {
        return <PostLoadClockSplash />;
    }

    // 강제 렌더 테스트 제거됨

    // 새 인트로 UI (책 펼침 제거, 배경 + 오버레이 레이아웃)
    const useNewIntroUI = true;
    // 엔진이 'webtoon'이면 전용 렌더러로 분기
    if (uiEngine === "webtoon") {
        const flowType = String(uiFlow?.type || "");
        if (flowType === "webtoon_scroll_to_map") {
            // 1. chapters에 있는 모든 장소(placeOptions)를 하나로 모읍니다.
            // DB에서 가져온 theme, stories, missions 정보가 여기 다 들어있습니다.
            const allPlaces = chapters
                .flatMap((ch: any) => ch.placeOptions || [])
                .map((p: any) => ({
                    ...p,
                    theme: p.theme || p.category || "footsteps",

                    // 👇 [여기 수정!] stories 배열을 만들 때 missionId를 꼭 챙겨야 합니다.
                    stories: Array.isArray(p.stories)
                        ? p.stories.map((s: any) => ({
                              id: s.id,
                              speaker: s.speaker,
                              dialogue: s.dialogue || s.narration || s.text || "",

                              // 🚨 [필수] 이 줄이 없으면 미션 모달이 절대 안 뜹니다!
                              missionId: s.missionId ?? null,
                          }))
                        : [],

                    missions: p.missions,
                }));

            // 2. 모은 장소 정보(allPlaces)를 flow.places에 담아서 넘겨줍니다.
            return (
                <JongroMapFinalExact
                    data={{
                        flow: {
                            ...uiFlow,
                            places: allPlaces, // ✨ 여기가 핵심! 이걸 넘겨야 지도에 뜹니다.
                        },
                        tokens: uiTokens,
                        backgroundImage: story?.imageUrl,
                        synopsis: story?.synopsis,
                    }}
                />
            );
        }
        return (
            <WebtoonIntro
                tokens={uiTokens}
                flow={uiFlow}
                onComplete={() => {
                    setFlowStep("category");
                }}
            />
        );
    }

    // 엔진이 'letter'이면 LetterIntro로 분기 (prologue에서만)
    if (uiEngine === "letter" && flowStep === "prologue") {
        // flow 호환: uiFlow.intro[0] | uiFlow.flow[0] | uiFlow
        const letterFlow =
            (Array.isArray(uiFlow?.intro) && uiFlow.intro[0]) ||
            (Array.isArray(uiFlow?.flow) && uiFlow.flow[0]) ||
            uiFlow ||
            null;
        const bgUrl = story?.imageUrl || getS3StaticUrl("homepage.png");
        return (
            <>
                <div className="fixed inset-0 z-[1000]">
                    <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${bgUrl})` }} />
                    <div className="absolute inset-0 bg-linear-to-b from-black/60 to-black/20" />
                </div>
                <LetterIntro
                    flow={letterFlow}
                    onComplete={() => {
                        setFlowStep("category");
                    }}
                />
            </>
        );
    }

    if (useNewIntroUI) {
        const bgUrl = story?.imageUrl || getS3StaticUrl("homepage.png");
        // 편지는 맨 처음(prologue)과 맨 마지막(epilogue)에만 표시
        // prologue 단계이고 첫 챕터일 때는 편지 표시 (처음 진입 시)
        // 단, 카테고리에서 뒤로 가기로 돌아온 경우는 제외 (flowStep이 "category"로 변경되면 편지 안 보임)
        // isDialogueActive가 true이면 편지가 활성화된 상태이므로 letterGateActive도 true
        const letterGateActive = flowStep === "prologue" && currentChapter?.chapter_number === 1 && isDialogueActive;
        return (
            <div
                className="relative overflow-hidden"
                style={{
                    height: "100dvh", // minHeight -> height로 변경하여 스크롤 방지
                    paddingTop: "env(safe-area-inset-top)",
                    paddingBottom: "env(safe-area-inset-bottom)",
                }}
            >
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${bgUrl})` }} />
                <div
                    className={`absolute inset-0 ${
                        letterGateActive ? "bg-transparent" : flowStep === "walk" ? "bg-black/45" : "bg-black/30"
                    } transition-colors duration-[1400ms]`}
                >
                    {/* 엔딩 편지 봉투/편지: sunset 오버레이 안쪽에 렌더 */}
                    {flowStep === "done" && endingStep === "epilogue" && (
                        <EpilogueFromDB
                            storyId={storyId}
                            step={endingDialogueStep}
                            onNext={() => setEndingDialogueStep((s) => s + 1)}
                            onComplete={() => {
                                setFlowStep("done");
                                setEndingStep("gallery");
                            }}
                        />
                    )}
                </div>
                <div
                    className="absolute inset-x-0 bottom-2 md:bottom-10 max-w-[980px] mx-auto px-4 pb-2 md:pb-4"
                    style={{
                        paddingBottom: `calc(0.5rem + env(safe-area-inset-bottom, 0px))`,
                    }}
                >
                    {/* 편지 닫기 전에는 상단 버튼 등 UI 숨김 */}
                    {!letterGateActive && (flowStep as unknown as string) !== "done" ? (
                        <div className="flex justify-center gap-3 mb-4 absolute inset-x-0 bottom-[100%] md:static md:mb-4">
                            {inMission && flowStep !== "done" ? (
                                <button
                                    onClick={() => setShowMapModal(true)}
                                    className="px-4 py-2 rounded-xl bg-white/80 hover:bg-white text-gray-900 shadow"
                                >
                                    지도 보기
                                </button>
                            ) : null}
                            {/* 편지 종료 후, 카테고리 화면에서만 표시 */}
                            {flowStep === "category" && !inMission && (
                                <button
                                    onClick={() => setShowIntroModal(true)}
                                    className="px-4 py-2 rounded-xl bg-white/80 hover:bg-white text-gray-900 shadow"
                                >
                                    대화 보기
                                </button>
                            )}
                            {flowStep === "category" &&
                                !inMission &&
                                computeAllCategoriesCleared(availableCategoryKeys) && (
                                    <button
                                        onClick={startEndingFlow}
                                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow"
                                    >
                                        엔딩 보기
                                    </button>
                                )}
                        </div>
                    ) : null}

                    <div
                        className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-transform duration-[1400ms] ease-in-out ${
                            flowStep === "walk" ? "translate-y-[-40px]" : "translate-y-0"
                        }`}
                    >
                        {/* 좌: 대화 영역 */}
                        <div className={`space-y-3 ${letterGateActive ? "hidden" : "block"}`}>
                            {/* 초기 대화(프로로그) 섹션은 숨김 처리 */}

                            {flowStep === "category" && (
                                <div className="space-y-3">
                                    {/* 뒤로가기 버튼 - selectedCategory가 있을 때만 표시 */}
                                    {selectedCategory && (
                                        <button
                                            onClick={() => {
                                                setSelectedCategory(null);
                                                setSelectedPlaceId(null);
                                                setSelectedPlaceIndex(null);
                                                setSelectedPlaceConfirm(null);
                                                setMissionUnlocked(false);
                                                setInSelectedRange(false);
                                                setFlowStep("category");
                                            }}
                                            className="inline-flex items-center px-3 py-1.5 rounded-lg bg-white/85 hover:bg-white text-gray-900 border shadow mb-2"
                                        >
                                            ← 뒤로
                                        </button>
                                    )}
                                    <div
                                        ref={listScrollRef} // 📍 [수정] 여기에 ref 추가
                                        className={`grid grid-cols-2 gap-3 ${
                                            titlePopAnim ? "animate-[titlePop_400ms_ease-out]" : ""
                                        } max-h-[56vh] overflow-auto pr-1`}
                                    >
                                        {(() => {
                                            const label = (k: string) =>
                                                ((
                                                    {
                                                        cafe: "☕ 카페",
                                                        date: "🌳 산책",
                                                        lunch: "🍱 점심",
                                                        dinner: "🌙 저녁",
                                                        nightview: "🌃 야경",
                                                    } as Record<string, string>
                                                )[k] || k);
                                            // 카테고리 우선순위: 야경(nightview)을 마지막으로 배치
                                            let base = availableCategoryKeys.map((k) => ({ key: k, label: label(k) }));
                                            base = base.sort((a, b) => {
                                                const lastKey = "nightview";
                                                if (a.key === lastKey && b.key !== lastKey) return 1;
                                                if (b.key === lastKey && a.key !== lastKey) return -1;
                                                return 0;
                                            });
                                            return base.map((cat) => {
                                                const disabled = completedCategories.includes(cat.key);
                                                return (
                                                    <button
                                                        key={cat.key}
                                                        onClick={() => {
                                                            if (disabled) return;
                                                            setSelectedCategory(cat.key);
                                                            try {
                                                                const targetIdx = chapters.findIndex((ch: any) => {
                                                                    const first = (ch?.placeOptions || [])[0];
                                                                    const chCat = normalizeCategory(
                                                                        first?.category || first?.type || ""
                                                                    );
                                                                    return chCat === cat.key;
                                                                });
                                                                if (targetIdx >= 0) setCurrentChapterIdx(targetIdx);
                                                            } catch {}
                                                            setSelectedPlaceId(null);
                                                            setInSelectedRange(false);
                                                            setMissionUnlocked(false);
                                                            setFlowStep(inMission ? "mission" : "placeList");
                                                        }}
                                                        disabled={disabled}
                                                        className={`px-4 py-3 rounded-xl text-gray-900 shadow ${
                                                            disabled
                                                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                                                : "bg-white/85 hover:bg-white"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span>{cat.label}</span>
                                                            {disabled && (
                                                                <span className="ml-1 text-xs text-emerald-600">
                                                                    완료됨
                                                                </span>
                                                            )}
                                                        </div>
                                                    </button>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                            )}

                            {flowStep === "placeList" && selectedCategory && !inMission && (
                                <>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between mb-2">
                                            {/* 뒤로 가기 버튼: 모든 카테고리를 완료한 상태(엔딩 직전)가 아닐 때만 표시 */}
                                            {!computeAllCategoriesCleared(availableCategoryKeys) && (
                                                <button
                                                    onClick={() => {
                                                        // 카테고리 선택 화면으로 복귀
                                                        setSelectedCategory(null);
                                                        setSelectedPlaceId(null);
                                                        setSelectedPlaceIndex(null);
                                                        setSelectedPlaceConfirm(null);
                                                        setMissionUnlocked(false);
                                                        setInSelectedRange(false);
                                                        setFlowStep("category");
                                                    }}
                                                    className="inline-flex items-center px-3 py-1.5 rounded-lg bg-white/85 hover:bg-white text-gray-900 border shadow"
                                                >
                                                    ← 카테고리로
                                                </button>
                                            )}
                                            {/* [추가] 선택된 장소가 있을 때 지도 보기 버튼 표시 */}
                                            {selectedPlaceConfirm && (
                                                <button
                                                    onClick={() => setShowMapModal(true)}
                                                    className="inline-flex items-center px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white border shadow"
                                                >
                                                    📍 지도 보기
                                                </button>
                                            )}
                                        </div>
                                        {/* placeList에서는 액션 버튼을 숨깁니다 (갤러리 모달 내부로 이동) */}
                                    </div>
                                    {/* 장소 리스트 */}
                                    <div
                                        ref={listScrollRef} // 📍 [수정] 여기에 ref 추가
                                        className="max-h-[56vh] overflow-auto pr-1" // 📍 기존에 없던 overflow-auto 클래스가 필요하다면 여기에 있어야 함
                                    >
                                        {(() => {
                                            const all = ((currentChapter.placeOptions || []) as any[]).slice();
                                            const list = all.filter((p: any) =>
                                                matchesSelectedCategory(p, selectedCategory)
                                            );
                                            return list.map((p: any, idx: number) => (
                                                <div
                                                    key={p.id}
                                                    className={`p-3 rounded-xl border shadow mb-2 ${
                                                        selectedPlaceConfirm === p.id
                                                            ? "bg-emerald-50 border-emerald-300"
                                                            : "bg-white/85 hover:bg-white border-gray-200"
                                                    }`}
                                                    onClick={() => {
                                                        // 첫 클릭: 상세(주소/시그니처)만 보여주고 선택 대기 + 현재 거리 계산
                                                        if (selectedPlaceConfirm !== p.id) {
                                                            setSelectedPlaceConfirm(p.id);
                                                            setSelectedPlaceIndex(idx);
                                                            setSelectedPlaceId(Number(p.id) || null);
                                                            setSelectedPlaceType(
                                                                (p.type || p.category || "").toString() || null
                                                            );
                                                            setInSelectedRange(false);
                                                            setMissionUnlocked(false);
                                                            try {
                                                                if (
                                                                    userLocation &&
                                                                    Number.isFinite(Number(p.latitude)) &&
                                                                    Number.isFinite(Number(p.longitude))
                                                                ) {
                                                                    const km = distanceKm(
                                                                        Number(userLocation.lat),
                                                                        Number(userLocation.lng),
                                                                        Number(p.latitude),
                                                                        Number(p.longitude)
                                                                    );
                                                                    if (Number.isFinite(km)) setSelectedDistance(km);
                                                                    else setSelectedDistance(null);
                                                                } else {
                                                                    setSelectedDistance(null);
                                                                }
                                                            } catch {
                                                                setSelectedDistance(null);
                                                            }
                                                            return;
                                                        }
                                                        // 두번째 클릭: 해당 장소로 확정 → 이동 화면 → 도착 후 대화/미션
                                                        const lines: Array<{
                                                            speaker?: string | null;
                                                            text: string;
                                                            missionId?: number | null;
                                                        }> =
                                                            Array.isArray(p.stories) && p.stories.length > 0
                                                                ? p.stories
                                                                      .map((s: any) => ({
                                                                          speaker: s?.speaker || null,
                                                                          text: String(
                                                                              s?.dialogue || s?.narration || ""
                                                                          ).trim(),
                                                                          missionId: s?.missionId ?? null,
                                                                      }))
                                                                      .filter(
                                                                          (d: any) => d.text && d.text.trim().length > 0
                                                                      )
                                                                : [];

                                                        // 이동 화면 표시 후 상태 전환
                                                        setIsMoving(true);
                                                        setTimeout(() => {
                                                            setIsMoving(false);
                                                            // 장소 선택 후에는 항상 먼저 미션 화면으로 진입
                                                            // (장소 스토리는 미션 완료 후 proceedAfterMission()에서 모달로 노출)
                                                            setMissionUnlocked(true);
                                                            setFlowStep("mission");
                                                        }, 1500);
                                                    }}
                                                >
                                                    <div className="font-semibold text-gray-900">{p.name}</div>
                                                    {selectedPlaceConfirm === p.id && (p.address || p.signature) ? (
                                                        <div className="text-xs text-gray-700 mt-2 space-y-1">
                                                            {p.address && (
                                                                <div className="leading-relaxed">{p.address}</div>
                                                            )}
                                                            {p.signature && (
                                                                <div className="inline-flex items-center px-2 py-1 rounded-md bg-amber-100 text-amber-800">
                                                                    {p.signature}
                                                                </div>
                                                            )}
                                                            {/* ✅ 거리 표시 추가 */}
                                                            {selectedDistance != null && (
                                                                <div className="text-[11px] text-gray-500">
                                                                    📍 현재 위치에서 약{" "}
                                                                    <span className="font-medium text-gray-800">
                                                                        {selectedDistance < 1
                                                                            ? `${Math.round(selectedDistance * 1000)}m`
                                                                            : `${selectedDistance.toFixed(1)}km`}
                                                                    </span>{" "}
                                                                    거리
                                                                </div>
                                                            )}
                                                            <div className="text-[11px] text-gray-500">
                                                                한 번 더 클릭하면 이 장소로 진행합니다
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        p.address && (
                                                            <div className="text-xs text-gray-600 mt-0.5">
                                                                {p.address}
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </>
                            )}

                            {flowStep === "dialogue" && !inMission && (
                                <div
                                    className={`bg-white/85 rounded-xl p-4 border shadow transition-opacity duration-500 ${
                                        flowStep !== "dialogue" ? "opacity-0" : "opacity-100"
                                    }`}
                                >
                                    <div className="space-y-3">
                                        {selectedPlaceType && (
                                            <div className="inline-flex items-center px-2 py-1 rounded-md bg-amber-100 text-amber-800 text-xs font-medium">
                                                {selectedPlaceType}
                                            </div>
                                        )}
                                        {dialogueQueue.length > 0 ? (
                                            <div className="text-gray-900 whitespace-pre-wrap break-words">
                                                {dialogueQueue[0]?.speaker && (
                                                    <div className="text-sm text-gray-500 mb-1">
                                                        {dialogueQueue[0].speaker}
                                                    </div>
                                                )}
                                                {dialogueQueue[0]?.text || ""}
                                            </div>
                                        ) : (
                                            <div className="text-gray-700">대화가 종료되었습니다.</div>
                                        )}
                                        <div className="flex justify-end">
                                            <button
                                                className="px-4 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700"
                                                onClick={() => {
                                                    const currentLine =
                                                        dialogueQueue && dialogueQueue.length > 0
                                                            ? dialogueQueue[0]
                                                            : null;
                                                    // 1) 현재 대사에 missionId가 연결되어 있으면 즉시 미션 모달 표시 (대화 일시 정지)
                                                    if (currentLine && (currentLine as any).missionId) {
                                                        try {
                                                            const placeList =
                                                                (currentChapter as any)?.placeOptions || [];
                                                            const place = placeList.find(
                                                                (p: any) => Number(p.id) === Number(selectedPlaceId)
                                                            );
                                                            const mission = place?.missions?.find(
                                                                (m: any) =>
                                                                    Number(m.id) ===
                                                                    Number((currentLine as any).missionId)
                                                            );
                                                            if (mission) {
                                                                // 사진/텍스트 모두 기존 모달 로직을 재사용 (S3 업로드 포함)
                                                                setModalError(null);
                                                                setModalWrongOnce(false as any);
                                                                setPhotoFiles([]);
                                                                setPhotoPreviewUrl(null);
                                                                setPhotoPreviewUrls([]);
                                                                setPhotoUploaded(false);
                                                                setModalAnswer("");
                                                                setActiveMission(mission);
                                                                setMissionModalOpen(true);
                                                                // 대화 진행은 미션 완료 시점에 한 줄 넘김
                                                                return;
                                                            }
                                                        } catch {}
                                                    }
                                                    // 2) 미션이 없거나 찾지 못했으면 다음 줄로 진행
                                                    if (dialogueQueue.length > 1) setDialogueQueue((q) => q.slice(1));
                                                    else {
                                                        // 장소 스토리 → 미션: 노트 펼침 효과와 함께 미션으로 전환
                                                        setPlaceDialogueDone(true);
                                                        setFlowStep("mission");
                                                        setTimeout(() => setPlaceDialogueDone(false), 600);
                                                    }
                                                }}
                                            >
                                                다음
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {flowStep === "pieceAward" && !endingFlowStarted && (
                                <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 text-emerald-900 px-4 py-5 text-center animate-[pieceFloat_800ms_ease-out]">
                                    <div className="text-2xl mb-2">✉️ 편지 조각 {piecesCollected} 획득!</div>
                                    <div className="text-sm mb-4">모든 카테고리를 완료하면 엔딩이 열립니다.</div>
                                    <button
                                        className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                                        onClick={async () => {
                                            try {
                                                // 조각 수와 무관하게 다음 단계로 진행 (마지막이면 엔딩으로 전환)
                                                const nextIndex =
                                                    typeof pendingNextChapterIdx === "number"
                                                        ? pendingNextChapterIdx
                                                        : currentChapterIdx + 1 < chapters.length
                                                        ? currentChapterIdx + 1
                                                        : null;

                                                if (nextIndex === null) {
                                                    // 모든 카테고리를 완료한 경우: 엔딩 단계로 전환
                                                    setFlowStep("done"); // endingStep은 useEffect에서 epilogue로 세팅됨
                                                    return;
                                                }

                                                // 다음 카테고리 이동
                                                setCurrentChapterIdx(nextIndex);
                                                setDialogueStep(0);
                                                setSelectedCategory(null);
                                                setSelectedPlaceIndex(null);
                                                setSelectedPlaceId(null);
                                                setSelectedPlaceConfirm(null);
                                                setMissionUnlocked(false);
                                                setFlowStep("category");
                                                setPendingNextChapterIdx(null);
                                            } catch (err) {
                                                console.error("엔딩 보기 오류:", err);
                                            }
                                        }}
                                    >
                                        계속
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* 우: 엔딩 아웃트로 → 갤러리 */}
                        {flowStep === "done" && endingStep === "badge" && (
                            <ClientPortal>
                                <div className="fixed inset-0 z-[9999] bg-black/50 animate-fade-in">
                                    {/* ✅ 중앙 정렬 컨테이너 */}
                                    <div className="min-h-screen flex items-center justify-center p-4">
                                        <div
                                            className="relative w-[92vw] max-w-[480px] bg-white rounded-2xl shadow-2xl overflow-hidden"
                                            style={{
                                                animation: "scaleIn 0.3s ease-out",
                                            }}
                                        >
                                            {/* 배경 그라디언트 */}
                                            <div className="absolute inset-0 bg-linear-to-br from-emerald-50 via-white to-amber-50 opacity-60" />

                                            {/* 컨텐츠 */}
                                            <div className="relative p-8 flex flex-col items-center text-center">
                                                {/* 축하 효과 */}
                                                <div className="text-6xl mb-4 animate-bounce">🎉</div>

                                                <h3 className="text-2xl font-bold text-gray-900 mb-6">배지 획득!</h3>

                                                {/* 배지 이미지 */}
                                                {badge?.image_url ? (
                                                    <div className="relative mb-6">
                                                        <div className="absolute inset-0 bg-linear-to-r from-yellow-200 to-amber-300 rounded-full blur-xl opacity-50 animate-pulse" />
                                                        <img
                                                            src={badge?.image_url}
                                                            alt={badge?.name || "badge"}
                                                            className="relative w-32 h-32 object-contain drop-shadow-2xl"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="relative mb-6">
                                                        <div className="absolute inset-0 bg-linear-to-r from-yellow-200 to-amber-300 rounded-full blur-xl opacity-50 animate-pulse" />
                                                        <div className="relative w-32 h-32 rounded-full bg-linear-to-br from-yellow-100 to-amber-200 flex items-center justify-center text-6xl shadow-2xl">
                                                            🏅
                                                        </div>
                                                    </div>
                                                )}

                                                {/* 배지 정보 */}
                                                <h4 className="text-xl font-semibold text-gray-900 mb-2">
                                                    {badge?.name || "완료 배지"}
                                                </h4>

                                                {badge?.description && (
                                                    <p className="text-gray-600 mb-8 leading-relaxed max-w-sm">
                                                        {badge?.description}
                                                    </p>
                                                )}

                                                {/* 버튼 */}
                                                <div className="w-full max-w-sm">
                                                    <button
                                                        onClick={() => {
                                                            try {
                                                                window.location.href = "/mypage?tab=casefiles";
                                                            } catch {}
                                                        }}
                                                        className="w-full px-6 py-3 rounded-xl bg-linear-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 transition-all font-medium shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
                                                    >
                                                        마이페이지로 가기
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </ClientPortal>
                        )}

                        {flowStep === "done" && endingStep === "gallery" ? (
                            <div className="fixed inset-0 z-[2000] bg-black/40 flex items-end md:items-center justify-center p-2">
                                <div className="w-[92vw] max-w-[520px] sm:max-w-[640px] max-h-[76vh] md:max-h-[86vh] rounded-2xl bg-white/90 p-3 border shadow overflow-hidden flex flex-col">
                                    <h3 className="text-lg font-bold text-gray-800 mb-3">
                                        엔딩 갤러리 (최대 {requiredPhotoCount}장 선택)
                                    </h3>
                                    <div className="flex-1 overflow-auto pr-1 min-h-0">
                                        {galleryUrls.length === 0 ? (
                                            <div className="text-gray-600">표시할 사진이 없습니다.</div>
                                        ) : (
                                            <div className="grid grid-cols-3 gap-2 mb-3">
                                                {galleryUrls.slice(galleryPage * 9, galleryPage * 9 + 9).map((url) => {
                                                    const sel = selectedGallery.includes(url);
                                                    return (
                                                        <button
                                                            key={url}
                                                            onClick={() => handleClickPhoto(url)}
                                                            className={`relative rounded overflow-hidden border ${
                                                                sel ? "ring-2 ring-amber-500" : ""
                                                            }`}
                                                        >
                                                            <img
                                                                src={url}
                                                                alt="photo"
                                                                className="w-full h-[78px] sm:h-24 object-cover"
                                                            />
                                                            {swapFrom === url &&
                                                                selectedGallery.length === requiredPhotoCount && (
                                                                    <span className="absolute inset-0 bg-amber-500/20" />
                                                                )}
                                                            {sel && (
                                                                <span className="absolute top-1 right-1 text-xs bg-amber-600 text-white px-1 rounded">
                                                                    선택됨
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                    {/* 페이지네이션 + 액션 버튼들 (모달 하단) */}
                                    <div className="mt-2 pt-2 border-t border-gray-200">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setGalleryPage((p) => Math.max(0, p - 1))}
                                                    className="px-3 py-2 rounded-lg text-green-700 hover:bg-green-50 transition-all duration-200 font-medium border border-green-300"
                                                    style={{ backgroundColor: "rgba(153, 192, 142, 0.2)" }}
                                                >
                                                    이전 장
                                                </button>
                                                <button
                                                    onClick={() =>
                                                        setGalleryPage((p) =>
                                                            (p + 1) * 9 < galleryUrls.length ? p + 1 : p
                                                        )
                                                    }
                                                    className="px-3 py-2 rounded-lg text-green-700 hover:bg-green-50 transition-all duration-200 font-medium border border-green-300"
                                                    style={{ backgroundColor: "rgba(153, 192, 142, 0.2)" }}
                                                >
                                                    다음 장
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={handleDownloadCollage}
                                                    disabled={selectedGallery.length !== requiredPhotoCount}
                                                    className="px-4 py-2 rounded-lg text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-md"
                                                    style={{ backgroundColor: "#99c08e" }}
                                                >
                                                    템플릿 이미지 다운로드
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        if (selectedGallery.length !== requiredPhotoCount) return;
                                                        try {
                                                            let bgUrl = getS3StaticUrl("hongdaeEscape_tamplete.png");
                                                            let frames: Array<{
                                                                x: number;
                                                                y: number;
                                                                w: number;
                                                                h: number;
                                                            }> | null = null;
                                                            try {
                                                                const res = await fetch(
                                                                    `/api/collages/templates?storyId=${storyId}`,
                                                                    {
                                                                        cache: "no-store",
                                                                    }
                                                                );
                                                                const data = await res.json();
                                                                const list = Array.isArray(data?.templates)
                                                                    ? data.templates
                                                                    : [];
                                                                const t = list[0];
                                                                if (t) {
                                                                    if (t.imageUrl) bgUrl = String(t.imageUrl);
                                                                    if (t.framesJson && Array.isArray(t.framesJson))
                                                                        frames = t.framesJson as any;
                                                                }
                                                            } catch {}
                                                            if (!frames) {
                                                                frames = [
                                                                    { x: 60, y: 230, w: 300, h: 420 },
                                                                    { x: 410, y: 230, w: 300, h: 420 },
                                                                    { x: 60, y: 730, w: 300, h: 420 },
                                                                    { x: 410, y: 730, w: 300, h: 420 },
                                                                ];
                                                            }
                                                            setFramePreviewTemplate({
                                                                imageUrl: bgUrl,
                                                                framesJson: frames,
                                                                width: 800,
                                                                height: 1200,
                                                            } as any);
                                                            setShowCollagePreview(true);
                                                        } catch {}
                                                    }}
                                                    disabled={selectedGallery.length !== requiredPhotoCount}
                                                    className="px-4 py-2 rounded-lg text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-md"
                                                    style={{ backgroundColor: "#7da871" }}
                                                >
                                                    템플릿 미리보기
                                                </button>
                                                <button
                                                    onClick={handleShareToKakao}
                                                    disabled={
                                                        selectedGallery.length !== requiredPhotoCount || isSharing
                                                    }
                                                    className="px-4 py-2 rounded-lg text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-md bg-linear-to-r from-green-500 to-green-600"
                                                >
                                                    {isSharing ? "공유 준비 중..." : "카카오톡으로 공유"}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : selectedPlaceId && missionUnlocked && flowStep !== "done" ? (
                            <div
                                className={`rounded-2xl bg-white/90 p-4 border shadow transition-opacity duration-500 ${
                                    (flowStep as unknown as string) === "walk" || letterGateActive
                                        ? "opacity-0"
                                        : "opacity-100"
                                } ${
                                    noteOpenAnim && (flowStep as unknown as string) === "mission"
                                        ? "animate-[noteOpen_300ms_ease-out]"
                                        : ""
                                }`}
                            >
                                <div className="mb-2 flex items-center justify-between">
                                    <button
                                        onClick={() => {
                                            setMissionUnlocked(false);
                                            setSelectedPlaceId(null);
                                            setSelectedPlaceIndex(null);
                                            setSelectedPlaceConfirm(null);
                                            setInSelectedRange(false);
                                            setFlowStep("placeList");
                                        }}
                                        className="px-3 py-1.5 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300"
                                    >
                                        ← 뒤로
                                    </button>
                                </div>
                                <h3 className="text-lg font-bold text-gray-800 mb-3">스토리 조각</h3>
                                {/* 모든 미션을 고정 크기 2열 카드로 표시, 클릭 시 모달로 풀이 */}
                                <div className="grid grid-cols-2 gap-2">
                                    {(() => {
                                        const placeList = (currentChapter as any)?.placeOptions || [];
                                        const placeById = selectedPlaceId
                                            ? placeList.find((p: any) => Number(p.id) === Number(selectedPlaceId))
                                            : null;
                                        const placeByIndex =
                                            placeById ||
                                            (selectedPlaceIndex != null
                                                ? placeList[selectedPlaceIndex as number]
                                                : null);
                                        const missions: any[] = Array.isArray((placeByIndex as any)?.missions)
                                            ? (placeByIndex as any).missions
                                            : [];
                                        if (missions.length === 0) {
                                            return (
                                                <div className="col-span-2 text-base text-gray-900 font-medium text-center">
                                                    진행 가능한 미션이 없습니다.
                                                </div>
                                            );
                                        }

                                        return missions
                                            .slice()
                                            .sort(
                                                (a: any, b: any) =>
                                                    Number(a.order || a.missionNumber || 0) -
                                                    Number(b.order || b.missionNumber || 0)
                                            )
                                            .map((m: any, mi: number) => {
                                                const payload = m?.missionPayload || {};
                                                const done =
                                                    !!clearedMissions[Number(m.id)] ||
                                                    solvedMissionIds.includes(Number(m.id));
                                                return (
                                                    <button
                                                        key={m.id ?? mi}
                                                        onClick={() => {
                                                            // 미션마다 사진/답변 상태를 초기화하여 간섭 방지
                                                            // 단, 이미 완료된 미션이면 상태 유지
                                                            const isDone = done;
                                                            if (!isDone) {
                                                                setPhotoFiles([]);
                                                                setPhotoPreviewUrl(null);
                                                                setPhotoPreviewUrls([]);
                                                                setPhotoUploaded(false);
                                                                setModalAnswer("");
                                                            }
                                                            setModalError(null);
                                                            setActiveMission(m);
                                                            setMissionModalOpen(true);
                                                        }}
                                                        className={`rounded-lg border bg-white/95 hover:bg-white text-left p-3 h-28 overflow-hidden ${
                                                            done ? "opacity-60" : ""
                                                        }`}
                                                    >
                                                        <div className="font-semibold text-gray-800 mb-1 line-clamp-2">
                                                            {payload.description ||
                                                                payload.question ||
                                                                `스토리 조각 ${mi + 1}`}
                                                        </div>
                                                        {done ? (
                                                            <div className="text-xs text-emerald-600">✅ 완료됨</div>
                                                        ) : (
                                                            <div className="text-xs text-gray-500">클릭하여 진행</div>
                                                        )}
                                                    </button>
                                                );
                                            });
                                    })()}
                                </div>
                                <div className="mt-4 flex justify-center">
                                    {(() => {
                                        const placeList = (currentChapter as any)?.placeOptions || [];
                                        const placeById = selectedPlaceId
                                            ? placeList.find((p: any) => Number(p.id) === Number(selectedPlaceId))
                                            : null;
                                        const placeByIndex =
                                            placeById ||
                                            (selectedPlaceIndex != null
                                                ? placeList[selectedPlaceIndex as number]
                                                : null);
                                        const placeMissions: any[] = Array.isArray((placeByIndex as any)?.missions)
                                            ? (placeByIndex as any).missions
                                            : [];
                                        const placeMissionIds: number[] =
                                            placeMissions.length > 0
                                                ? placeMissions.map((m: any) => Number(m.id)).filter(Number.isFinite)
                                                : [];
                                        const placeClearedCount = placeMissionIds.filter((mid) => {
                                            return clearedMissions[mid] || solvedMissionIds.includes(mid);
                                        }).length;
                                        const canProceedToNext = placeClearedCount >= 2;

                                        return (
                                            <button
                                                onClick={() => {
                                                    try {
                                                        const total = placeMissionIds.length;
                                                        const openConfirm =
                                                            total >= 4 && canProceedToNext && placeClearedCount < 4;
                                                        if (openConfirm) {
                                                            setShowProceedModal(true);
                                                        } else {
                                                            advanceToNextCategory();
                                                        }
                                                    } catch {
                                                        advanceToNextCategory();
                                                    }
                                                }}
                                                className="px-4 py-2 rounded-lg bg-green-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                                disabled={!canProceedToNext || isSubmitting}
                                            >
                                                {isSubmitting
                                                    ? "처리 중..."
                                                    : canProceedToNext
                                                    ? currentChapterIdx + 1 >= chapters.length
                                                        ? "엔딩 보기"
                                                        : "다음 카테고리로 →"
                                                    : `스토리 조각 ${Math.max(
                                                          0,
                                                          2 - placeClearedCount
                                                      )}개 더 완료 필요`}
                                            </button>
                                        );
                                    })()}
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>

                {/* 기존 대화형 인트로 오버레이 재사용 (유일한 위치에서만 렌더) */}
                {isDialogueActive && currentChapter && !inMission && flowStep !== "done" && (
                    <DialogueFlow
                        messages={currentChapter.story_text}
                        step={dialogueStep}
                        onNext={() => setDialogueStep((s) => s + 1)}
                        onComplete={() => {
                            // 편지 닫기를 눌러야만 UI가 나타나도록 이 시점에서는 숨김 유지
                            setIsDialogueActive(false);
                            try {
                                const key = `escape_letter_shown_${storyId}`;
                                localStorage.setItem(key, "1");
                                setLetterEverShown(true);
                            } catch {}
                        }}
                        letterMode={currentChapter?.chapter_number === 1 && flowStep === "prologue" && isDialogueActive}
                        onLetterOpened={(opened) => {
                            // 열릴 때는 무시, 닫을 때만 UI 표시 + 프롤로그 건너뛰기
                            if (!opened) {
                                setIsLetterOpened(true);
                                setFlowStep("category");
                            }
                        }}
                        fallbackParts={(() => {
                            const syn = String(story?.synopsis || "").trim();
                            return syn
                                ? syn
                                      .split(/\n+/)
                                      .map((s) => s.trim())
                                      .filter(Boolean)
                                : [];
                        })()}
                    />
                )}

                {/* 2개 완료 후 진행 버튼 클릭 시 안내 모달 */}
                {showProceedModal && (
                    <div className="fixed inset-0 z-[1500] bg-black/50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl w-full max-w-md p-6 text-center">
                            <div className="text-lg font-bold text-gray-900 mb-2">조금만 더!</div>
                            <p className="text-gray-700 mb-5">
                                이 장소의 미션을 4개 모두 완료하면 AI 추천 쿠폰을 드려요. 계속 하시겠어요?
                            </p>
                            <div className="flex items-center justify-center gap-3">
                                <button
                                    onClick={() => {
                                        setShowProceedModal(false);
                                        advanceToNextCategory();
                                    }}
                                    className="px-4 py-2 rounded-lg bg-gray-800 text-white hover:bg-gray-900"
                                >
                                    그냥 넘어가기
                                </button>
                                <button
                                    onClick={() => {
                                        setShowProceedModal(false);
                                    }}
                                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                                >
                                    계속 하기
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 콜라주 미리보기 모달 */}
                {showCollagePreview && (
                    <div className="fixed inset-0 z-[2100] bg-black/50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl p-4 max-w-[720px] w-full max-h-[90vh] overflow-hidden flex flex-col">
                            <div className="text-center mb-3 font-semibold">템플릿 미리보기</div>
                            <div
                                ref={previewRootRef}
                                onClick={handleMeasureClick}
                                className="w-full flex-1 flex items-center justify-center overflow-hidden"
                                style={{ cursor: measureMode ? "crosshair" : undefined }}
                            >
                                {collagePreviewUrl ? (
                                    <img
                                        src={collagePreviewUrl || undefined}
                                        alt="collage-preview"
                                        className="max-h-[72vh] w-full h-auto object-contain rounded"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center w-full h-[60vh]">
                                        <div className="animate-pulse text-gray-500">이미지 생성 중...</div>
                                    </div>
                                )}
                            </div>
                            <div className="mt-4 flex justify-end gap-2">
                                <button
                                    onClick={() => setShowCollagePreview(false)}
                                    className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300"
                                >
                                    닫기
                                </button>
                                <button
                                    onClick={async () => {
                                        setShowCollagePreview(false);
                                        await autoSaveCollage();
                                        setEndingStep("badge");
                                    }}
                                    className="px-4 py-2 rounded bg-amber-600 text-white"
                                >
                                    저장하고 계속
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isMobile && showMapModal && flowStep !== "done" && (
                    <div
                        className={`fixed inset-0 z-[1400] bg-black/50 flex items-center justify-center p-4 ${
                            flowStep === "walk" ? "animate-[zoomOutBg_1000ms_ease-out]" : ""
                        }`}
                        role="dialog"
                        aria-modal="true"
                    >
                        <div className="bg-white rounded-2xl w-full max-w-md h-[78vh] overflow-hidden relative">
                            {isMoving && (
                                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/90">
                                    <div className="text-4xl mb-3">🚗</div>
                                    <div className="text-gray-800 font-semibold">이동 중...</div>
                                </div>
                            )}
                            <div className="absolute top-3 right-3 z-10">
                                <button
                                    onClick={() => setShowMapModal(false)}
                                    className="hover:cursor-pointer px-3 py-1.5 text-sm rounded-lg bg-black/80 text-white"
                                >
                                    닫기
                                </button>
                            </div>
                            <div className="w-full h-full min-h-[420px]">
                                <NaverMap
                                    key={showMapModal ? "map-open" : "map-closed"} // [수정] 모달 열릴 때마다 재마운트 강제
                                    places={
                                        selectedPlaceId
                                            ? ([
                                                  (currentChapter?.placeOptions || []).find(
                                                      (p: any) => Number(p.id) === Number(selectedPlaceId)
                                                  ),
                                              ].filter(Boolean) as any)
                                            : []
                                    }
                                    userLocation={userLocation as any}
                                    selectedPlace={null}
                                    onPlaceClick={() => {}}
                                    className="w-full h-full"
                                    drawPath={true}
                                    routeMode={"walking"} // 모바일/PC 구분 없이 walking으로 고정 (홍대 방탈출 특성상)
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* 미션 풀이 모달 */}
                {missionModalOpen && activeMission && (
                    <div className="fixed inset-0 z-[1500] bg-black/50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl w-full max-w-md p-5 relative">
                            <button
                                onClick={() => setMissionModalOpen(false)}
                                className="absolute top-3 right-3 px-3 py-1.5 text-sm rounded-lg bg-black/80 text-white"
                            >
                                닫기
                            </button>
                            {(() => {
                                const t = String(activeMission?.missionType || "").toUpperCase();
                                const payload = activeMission?.missionPayload || {};
                                const p: any = payload || {};
                                const base = p.hints ?? p.hint;
                                let hints: string[] = [];
                                if (Array.isArray(base)) hints = base.filter(Boolean);
                                else if (typeof base === "string" && base.trim()) hints = [base.trim()];
                                else {
                                    Object.keys(p || {}).forEach((k) => {
                                        if (/^hint[_-]?\d+$/i.test(k) && p[k]) hints.push(p[k]);
                                    });
                                }
                                // 통합 확인 핸들러: PHOTO와 PUZZLE_ANSWER 처리
                                // --- 통합 확인 핸들러: PHOTO와 PUZZLE_ANSWER 처리
                                const handleConfirm = async () => {
                                    // 📍 [1] 현재 "리스트 박스"의 스크롤 위치를 저장 (window 아님!)
                                    const savedScrollTop = listScrollRef.current ? listScrollRef.current.scrollTop : 0;

                                    // 📍 [2] 키보드 내리기 (포커스 해제)
                                    if (document.activeElement instanceof HTMLElement) {
                                        document.activeElement.blur();
                                    }

                                    // 📍 [3] 키보드 내려갈 시간 확보 (0.3초)
                                    await new Promise((resolve) => setTimeout(resolve, 300));

                                    try {
                                        setIsSubmitting(true);
                                        if (t === "PHOTO") {
                                            const files = photoFiles || [];
                                            if (files.length < 2) {
                                                setValidationError("사진 2장을 업로드해 주세요.");
                                                setIsSubmitting(false);
                                                return;
                                            }
                                            setToast("사진을 압축하고 있어요...");
                                            const options: any = {
                                                maxSizeMB: 1.2,
                                                maxWidthOrHeight: 1600,
                                                useWebWorker: true,
                                                initialQuality: 0.8,
                                            };
                                            const compressedFiles = await Promise.all(
                                                files.map((f) => imageCompression(f, options))
                                            );
                                            const formData = new FormData();
                                            compressedFiles.forEach((file) =>
                                                formData.append("photos", file, file.name)
                                            );
                                            setToast("사진을 업로드하는 중...");
                                            const uploadResponse = await fetch("/api/upload", {
                                                method: "POST",
                                                body: formData,
                                                credentials: "include",
                                                cache: "no-store",
                                            });
                                            if (!uploadResponse.ok) {
                                                setIsSubmitting(false);
                                                throw new Error(await uploadResponse.text());
                                            }
                                            const uploadResult = await uploadResponse.json();
                                            const urls: string[] = Array.isArray(uploadResult.photo_urls)
                                                ? uploadResult.photo_urls
                                                : [];
                                            if (urls.length === 0) {
                                                setIsSubmitting(false);
                                                throw new Error("업로드된 사진 URL이 없습니다.");
                                            }

                                            setToast("미션 결과 저장 중...");
                                            const r = await submitMission({
                                                chapterId: Number(selectedPlaceId ?? currentChapter?.id),
                                                missionType: t,
                                                photoUrls: urls,
                                                isCorrect: true,
                                            });
                                            if (!r.success) {
                                                setIsSubmitting(false);
                                                throw new Error(r.error || "미션 저장 실패");
                                            }
                                        } else if (t === "PUZZLE_ANSWER" || t === "TEXT") {
                                            const ok = isCorrectForPayload(payload, modalAnswer);
                                            if (!ok && t === "PUZZLE_ANSWER") {
                                                setModalWrongOnce(true);
                                                setModalError("정답이 아니에요");
                                                setIsSubmitting(false);

                                                // 📍 [에러 시 복구] 실패 시에도 스크롤 복구
                                                if (listScrollRef.current) {
                                                    listScrollRef.current.scrollTop = savedScrollTop;
                                                }
                                                return;
                                            }

                                            setModalError(null);
                                            setModalWrongOnce(false);

                                            await submitMission({
                                                chapterId: Number(selectedPlaceId ?? currentChapter?.id),
                                                missionType: t,
                                                isCorrect: true,
                                                textAnswer: (modalAnswer || "").trim(),
                                            });
                                        }

                                        // 공통 후처리
                                        if (activeMission?.id != null) {
                                            setSolvedMissionIds((prev) =>
                                                Array.from(new Set([...prev, Number(activeMission.id)]))
                                            );
                                            setClearedMissions((prev) => ({
                                                ...prev,
                                                [Number(activeMission.id)]: true,
                                            }));
                                        }

                                        // ✅ 미션이 2개 완료되었는지 확인
                                        const place = (currentChapter?.placeOptions || []).find(
                                            (p: any) => Number(p.id) === Number(selectedPlaceId)
                                        );
                                        const placeMissions: any[] = Array.isArray((place as any)?.missions)
                                            ? (place as any).missions
                                            : [];
                                        const placeMissionIds: number[] =
                                            placeMissions.length > 0
                                                ? placeMissions.map((m: any) => Number(m.id)).filter(Number.isFinite)
                                                : [];
                                        const placeClearedCount = placeMissionIds.filter((mid) => {
                                            if (mid === Number(activeMission?.id)) return true; // 방금 완료한 미션
                                            return clearedMissions[mid] || solvedMissionIds.includes(mid);
                                        }).length;

                                        // ✅ 미션이 2개 완료되었을 때 카테고리 완료 처리 (자동 이동 제거)
                                        if (placeClearedCount >= 2) {
                                            try {
                                                const catKey = normalizeCategory(
                                                    (place as any)?.category || (place as any)?.type || ""
                                                );
                                                if (catKey) {
                                                    setCompletedCategories((prev) => {
                                                        const next = Array.from(new Set([...(prev || []), catKey]));
                                                        try {
                                                            const raw = localStorage.getItem(STORAGE_KEY);
                                                            const obj = raw ? JSON.parse(raw) : {};
                                                            obj.__completedCategories = next;
                                                            localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
                                                        } catch {}
                                                        return next;
                                                    });
                                                }
                                            } catch {}

                                            // 모달 닫고 미션 목록으로 돌아감 (버튼 클릭으로 이동)
                                            setMissionModalOpen(false);
                                            setActiveMission(null);
                                            if (t === "PHOTO") {
                                                setPhotoFiles([]);
                                                setPhotoPreviewUrl(null);
                                                setPhotoPreviewUrls([]);
                                                setPhotoUploaded(false);
                                            } else {
                                                setModalAnswer("");
                                            }
                                            setToast("미션 완료! 다음 카테고리로 버튼을 눌러주세요.");
                                        } else {
                                            // 미션이 2개 미완료인 경우: 모달만 닫고 미션 목록으로 돌아감
                                            setMissionModalOpen(false);
                                            setActiveMission(null);
                                            if (t === "PHOTO") {
                                                setPhotoFiles([]);
                                                setPhotoPreviewUrl(null);
                                                setPhotoPreviewUrls([]);
                                                setPhotoUploaded(false);
                                            } else {
                                                setModalAnswer("");
                                            }
                                            setToast("미션 완료!");
                                        }
                                    } catch (e: any) {
                                        setValidationError(e?.message || "오류가 발생했습니다.");
                                        setIsSubmitting(false);

                                        // 📍 [에러 시 복구] 에러가 나도 스크롤 위치 복구
                                        if (listScrollRef.current) {
                                            listScrollRef.current.scrollTop = savedScrollTop;
                                        }
                                    } finally {
                                        setIsSubmitting(false);

                                        // 📍 [4] 핵심: 마지막으로 스크롤 위치를 "리스트 박스"에 강제로 주입
                                        // 모달이 닫히고 화면이 다시 그려지는 찰나(50ms) 뒤에 실행해야 정확함
                                        setTimeout(() => {
                                            if (listScrollRef.current) {
                                                // instant로 설정하여 눈에 띄지 않게 순간이동
                                                listScrollRef.current.scrollTo({
                                                    top: savedScrollTop,
                                                    behavior: "instant",
                                                });
                                            }
                                        }, 50);
                                    }
                                };

                                return (
                                    <div className="space-y-4">
                                        <h4 className="text-lg font-bold text-gray-800">스토리 조각</h4>
                                        <div className="text-gray-900">
                                            {payload.description || payload.question || "스토리 조각"}
                                        </div>
                                        {payload.description && (
                                            <div className="text-sm text-gray-600 whitespace-pre-wrap">
                                                {payload.question}
                                            </div>
                                        )}
                                        {/* PHOTO 전용 상단 확인 버튼 제거 (공통 확인 버튼만 사용) */}
                                        {(t === "PUZZLE_ANSWER" || t === "PHOTO") && (
                                            <div className="flex items-center gap-2">
                                                {t === "PUZZLE_ANSWER" && (
                                                    <input
                                                        type="text"
                                                        value={modalAnswer}
                                                        onChange={(e) => {
                                                            setModalAnswer(e.target.value);
                                                            setModalError(null);
                                                        }}
                                                        placeholder="정답 입력"
                                                        className="flex-1 px-3 py-2 rounded border text-gray-900"
                                                    />
                                                )}
                                                <button
                                                    onClick={handleConfirm}
                                                    disabled={isSubmitting || (t === "PHOTO" && photoFiles.length < 2)}
                                                    className={`px-3 py-2 rounded text-sm text-white ${
                                                        isSubmitting ? "bg-gray-400" : "bg-blue-600"
                                                    } disabled:opacity-50`}
                                                >
                                                    {isSubmitting
                                                        ? t === "PHOTO"
                                                            ? "업로드 중..."
                                                            : "처리 중..."
                                                        : "확인"}
                                                </button>
                                            </div>
                                        )}
                                        {t === "TEXT" && (
                                            <div className="space-y-2">
                                                <textarea
                                                    value={modalAnswer}
                                                    onChange={(e) => {
                                                        setModalAnswer(e.target.value);
                                                        setModalError(null);
                                                    }}
                                                    placeholder="내용을 입력하세요"
                                                    className="w-full min-h-[90px] px-3 py-2 rounded border text-gray-900"
                                                />
                                                <div className="flex justify-end">
                                                    <button
                                                        onClick={async () => {
                                                            const text = (modalAnswer || "").trim();
                                                            if (!text) {
                                                                setModalError("내용을 입력해 주세요.");
                                                                return;
                                                            }
                                                            try {
                                                                // 서버 저장
                                                                const r = await submitMission({
                                                                    chapterId: Number(
                                                                        selectedPlaceId ?? currentChapter?.id
                                                                    ),
                                                                    missionType: t,
                                                                    isCorrect: true,
                                                                    textAnswer: text,
                                                                });
                                                                if (!r.success)
                                                                    throw new Error(r.error || "미션 저장 실패");

                                                                // 공통 후처리 (PHOTO/PUZZLE_ANSWER와 동일한 로직)
                                                                if (activeMission?.id != null) {
                                                                    setSolvedMissionIds((prev) =>
                                                                        Array.from(
                                                                            new Set([...prev, Number(activeMission.id)])
                                                                        )
                                                                    );
                                                                    setClearedMissions((prev) => ({
                                                                        ...prev,
                                                                        [Number(activeMission.id)]: true,
                                                                    }));
                                                                }

                                                                // ✅ 미션이 2개 완료되었는지 확인 (PHOTO/PUZZLE_ANSWER와 동일한 로직)
                                                                const place = (currentChapter?.placeOptions || []).find(
                                                                    (p: any) => Number(p.id) === Number(selectedPlaceId)
                                                                );
                                                                const placeMissions: any[] = Array.isArray(
                                                                    (place as any)?.missions
                                                                )
                                                                    ? (place as any).missions
                                                                    : [];
                                                                const placeMissionIds: number[] =
                                                                    placeMissions.length > 0
                                                                        ? placeMissions
                                                                              .map((m: any) => Number(m.id))
                                                                              .filter(Number.isFinite)
                                                                        : [];
                                                                const placeClearedCount = placeMissionIds.filter(
                                                                    (mid) => {
                                                                        if (mid === Number(activeMission?.id))
                                                                            return true; // 방금 완료한 미션
                                                                        return (
                                                                            clearedMissions[mid] ||
                                                                            solvedMissionIds.includes(mid)
                                                                        );
                                                                    }
                                                                ).length;

                                                                // 미션이 2개 완료되었을 때 카테고리 완료 처리 (자동 이동 제거)
                                                                if (placeClearedCount >= 2) {
                                                                    // 카테고리 완료 처리
                                                                    try {
                                                                        const catKey = normalizeCategory(
                                                                            (place as any)?.category ||
                                                                                (place as any)?.type ||
                                                                                ""
                                                                        );
                                                                        if (catKey) {
                                                                            setCompletedCategories((prev) => {
                                                                                const next = Array.from(
                                                                                    new Set([...(prev || []), catKey])
                                                                                );
                                                                                try {
                                                                                    const raw =
                                                                                        localStorage.getItem(
                                                                                            STORAGE_KEY
                                                                                        );
                                                                                    const obj = raw
                                                                                        ? JSON.parse(raw)
                                                                                        : {};
                                                                                    obj.__completedCategories = next;
                                                                                    localStorage.setItem(
                                                                                        STORAGE_KEY,
                                                                                        JSON.stringify(obj)
                                                                                    );
                                                                                } catch {}
                                                                                return next;
                                                                            });
                                                                        }
                                                                    } catch {}

                                                                    // 모달 닫고 미션 목록으로 돌아감 (버튼 클릭으로 이동)
                                                                    setMissionModalOpen(false);
                                                                    setActiveMission(null);
                                                                    setModalAnswer("");
                                                                    setToast(
                                                                        "미션 완료! 다음 카테고리로 버튼을 눌러주세요."
                                                                    );
                                                                    // 자동 이동 제거
                                                                } else {
                                                                    // 미션이 2개 미완료인 경우: 모달만 닫고 미션 목록으로 돌아감
                                                                    setMissionModalOpen(false);
                                                                    setActiveMission(null);
                                                                    setModalAnswer("");
                                                                    setToast("미션 완료!");
                                                                    // 자동 이동 제거
                                                                }
                                                            } catch (err: any) {
                                                                setModalError(
                                                                    err?.message || "저장 중 오류가 발생했어요."
                                                                );
                                                            }
                                                        }}
                                                        className="px-3 py-2 rounded text-sm text-white bg-blue-600 hover:bg-blue-700"
                                                    >
                                                        제출
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {modalError && <div className="text-sm text-red-600">{modalError}</div>}
                                        {t === "PHOTO" && (
                                            <div className="flex flex-col gap-2">
                                                {photoUploaded ? (
                                                    <div className="px-3 py-2 rounded-md border bg-green-50 text-green-700">
                                                        ✅ 사진이 이미 업로드되었습니다.
                                                    </div>
                                                ) : (
                                                    <>
                                                        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border bg-white cursor-pointer hover:bg-gray-50 w-fit">
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                multiple
                                                                className="hidden"
                                                                onChange={(e) => {
                                                                    const files = Array.from(e.target.files || []);
                                                                    if (files.length > 0) {
                                                                        setPhotoFiles(files.slice(0, 5));
                                                                        try {
                                                                            const urls = files
                                                                                .slice(0, 5)
                                                                                .map((f) => URL.createObjectURL(f));
                                                                            setPhotoPreviewUrl(urls[0] || null);
                                                                            setPhotoPreviewUrls(urls);
                                                                        } catch {}
                                                                        const enough = files.length >= 2;
                                                                        // 업로드 표시는 하지 않고, 확인 시 업로드하도록 변경
                                                                        setPhotoUploaded(false);
                                                                        setValidationError(
                                                                            enough ? "" : "사진 2장을 업로드해 주세요."
                                                                        );
                                                                    }
                                                                }}
                                                            />
                                                            <span>사진 업로드 (2장)</span>
                                                        </label>
                                                        {photoPreviewUrls && photoPreviewUrls.length > 0 && (
                                                            <div className="flex gap-1">
                                                                {photoPreviewUrls.map((u, i) => (
                                                                    <div
                                                                        key={i}
                                                                        className="w-16 h-16 rounded-md overflow-hidden border"
                                                                    >
                                                                        <img
                                                                            src={u}
                                                                            alt={`미리보기-${i + 1}`}
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                                {/* 하단 PHOTO 확인 버튼 제거: 공통 확인 버튼(handleConfirm)만 사용 */}
                                            </div>
                                        )}
                                        {/* 힌트 표시 제거 요청에 따라 숨김 */}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )}

                {/* 미션 이후 스토리 모달 (UI 리뉴얼) */}
                {showPostStory && postStoryQueue.length > 0 && (
                    <div className="fixed inset-0 z-[1550] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
                        <div className="w-full max-w-sm bg-[#FDFBF7] rounded-xl shadow-2xl border border-[#E6E2D6] overflow-hidden relative">
                            {/* 상단 장식 (클립/테이프 느낌) */}
                            <div className="absolute top-0 inset-x-0 h-1 bg-linear-to-r from-[#C8AA64] via-[#E6D2A0] to-[#C8AA64] opacity-80" />

                            <div className="p-8 flex flex-col min-h-[320px]">
                                {/* 소제목: 스토리 조각 */}
                                <div className="text-center mb-6">
                                    <span className="inline-block px-3 py-1 rounded-full border border-[#C8AA64] text-[#8B6E4A] text-[10px] font-bold tracking-widest bg-white">
                                        STORY PIECE {postStoryIdx + 1} / {postStoryQueue.length}
                                    </span>
                                </div>

                                {/* 메인 텍스트 (소설책 느낌) */}
                                <div className="flex-1 flex items-center justify-center">
                                    <p className="text-[#2C2824] font-serif text-lg leading-loose text-center whitespace-pre-wrap break-keep animate-fade-in-up">
                                        {postStoryQueue[postStoryIdx]}
                                    </p>
                                </div>
                            </div>

                            {/* 하단 버튼 영역 */}
                            <div className="bg-[#F7F4EB] p-4 border-t border-[#E6E2D6]">
                                <button
                                    onClick={() => {
                                        if (postStoryIdx < postStoryQueue.length - 1) {
                                            setPostStoryIdx((i) => i + 1);
                                        } else {
                                            // 스토리 종료 로직
                                            setShowPostStory(false);
                                            setPostStoryQueue([]);
                                            setPostStoryIdx(0);

                                            // 다음 단계 처리
                                            if (typeof pendingNextChapterIdx === "number") {
                                                const nextIndex = pendingNextChapterIdx as number;
                                                setPendingNextChapterIdx(null);
                                                setPiecesCollected((n) => n + 1);
                                                setCurrentChapterIdx(nextIndex);
                                                changeFlowStep("category", { resetMission: true, resetPlace: true });
                                                setDialogueStep(0);
                                                setSelectedCategory(null);
                                                setSelectedPlaceIndex(null);
                                                setSelectedPlaceId(null);
                                                setSelectedPlaceConfirm(null);
                                                setMissionUnlocked(false);
                                            } else {
                                                changeFlowStep("category", { resetMission: true, resetPlace: true });
                                            }
                                        }
                                    }}
                                    className="w-full py-3.5 rounded-lg bg-[#3A3530] text-[#E6D2A0] font-serif font-bold text-base shadow hover:bg-[#2C2824] transition-colors flex items-center justify-center gap-2"
                                >
                                    {postStoryIdx < postStoryQueue.length - 1 ? (
                                        <>
                                            다음 페이지 <span className="text-xs">▶</span>
                                        </>
                                    ) : (
                                        "이야기 닫기"
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ✨ 컴포넌트가 모든 경우에 값을 반환하도록 null을 추가했습니다.
    return null;
}

export default function Page() {
    return (
        <Suspense fallback={<LoadingSpinner />}>
            <EscapeIntroPageInner />
        </Suspense>
    );
}

// Lite 강제 분기 구현은 제거되었습니다.
