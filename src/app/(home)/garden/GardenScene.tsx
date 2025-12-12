"use client";

import React, { useState } from "react";
import { ArrowLeft, Edit3 } from "lucide-react";
import { useRouter } from "next/navigation";
import GardenCanvas from "./GardenCanvas";
import GardenPanel from "./GardenPanel";

export type ItemType = "tree" | "fence" | "path" | null;

export default function GardenScene() {
    const router = useRouter();
    const [mode, setMode] = useState<"view" | "edit">("view");  
    const [selectedItem, setSelectedItem] = useState<ItemType>(null);

    // 12x12 정원 grid
    const GRID_SIZE = 12;
    const [grid, setGrid] = useState<(ItemType | null)[][]>(
        Array(GRID_SIZE)
            .fill(null)
            .map(() => Array(GRID_SIZE).fill(null))
    );

    return (
        <div className="relative w-full h-screen bg-gray-100">
            {/* 🔹 상단 UI */}
            <div className="absolute top-4 right-4 flex items-center gap-3 z-50">
                <button
                    onClick={() => router.back()}
                    className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-gray-100"
                >
                    <ArrowLeft size={20} className="text-gray-700" />
                </button>

                <button
                    onClick={() => setMode(mode === "view" ? "edit" : "view")}
                    className={`w-10 h-10 rounded-full shadow-md flex items-center justify-center transition ${
                        mode === "edit" ? "bg-green-500 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
                    }`}
                >
                    <Edit3 size={18} />
                </button>
            </div>

            {/* ✅ 수정 모드일 때만 아이템 선택 패널 표시 */}
            {mode === "edit" && <GardenPanel selectedItem={selectedItem} setSelectedItem={setSelectedItem} />}

            {/* 🔹 3D 정원 */}
            <GardenCanvas mode={mode} grid={grid} setGrid={setGrid} selectedItem={selectedItem} gridSize={GRID_SIZE} />
        </div>
    );
}
