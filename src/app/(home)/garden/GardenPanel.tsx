"use client";
import React from "react";
import type { ItemType } from "./GardenScene";

interface GardenPanelProps {
    selectedItem: ItemType;
    setSelectedItem: (item: ItemType) => void;
}

export default function GardenPanel({ selectedItem, setSelectedItem }: GardenPanelProps) {
    const items = [
        { id: "tree", name: "🌳 나무" },
        { id: "fence", name: "🪵 울타리" },
        { id: "path", name: "🛣 길" },
    ];

    return (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 bg-white shadow-xl rounded-2xl p-4 w-28 z-50 flex flex-col gap-2">
            {items.map((item) => (
                <button
                    key={item.id}
                    onClick={() => setSelectedItem(selectedItem === item.id ? null : (item.id as ItemType))}
                    className={`p-2 rounded-xl text-center font-semibold text-sm transition-all ${
                        selectedItem === item.id
                            ? "bg-green-500 text-white shadow-md"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                >
                    {item.name}
                </button>
            ))}
        </div>
    );
}
