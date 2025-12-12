"use client";

import React, { useEffect } from "react";
import GardenScene from "./GardenScene";

export default function GardenPage() {
    // 가로(landscape) 잠깐 전환 시도: 일부 모바일 브라우저는 완전 지원 안 함
    useEffect(() => {
        const applyLandscape = async () => {
            try {
                const anyScreen: any = screen as any;
                if (anyScreen.orientation?.lock) {
                    await anyScreen.orientation.lock("landscape");
                }
            } catch {}
        };
        applyLandscape();
        return () => {
            try {
                const anyScreen: any = screen as any;
                if (anyScreen.orientation?.unlock) {
                    anyScreen.orientation.unlock();
                }
            } catch {}
        };
    }, []);
    return <GardenScene />;
}
