"use client";

import React, { useState } from "react";

type StoreKind = "apple" | "google";

export default function AppInstallQR({
    appleUrl = "https://apps.apple.com/kr/app",
    googleUrl = "https://play.google.com/store/apps",
    onClose,
}: {
    appleUrl?: string;
    googleUrl?: string;
    onClose?: () => void;
}) {
    const [selected, setSelected] = useState<StoreKind>("apple");

    const qrSrc = (url: string) =>
        `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;

    const isApple = selected === "apple";
    const currentUrl = isApple ? appleUrl : googleUrl;

    return (
        <div className="bg-white rounded-xl border border-gray-100 p-6 w-full max-w-md">
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 tracking-tight">앱 설치 QR 코드</h3>

                {/* 탭 버튼 */}
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => setSelected("apple")}
                        className={`py-2.5 rounded-lg text-sm font-medium hover:cursor-pointer border ${
                            isApple
                                ? "bg-gray-900 text-white border-gray-900"
                                : "bg-white text-gray-900 border-gray-300"
                        }`}
                    >
                        App Store
                    </button>
                    <button
                        type="button"
                        onClick={() => setSelected("google")}
                        className={`py-2.5 rounded-lg text-sm font-medium hover:cursor-pointer border ${
                            !isApple
                                ? "bg-gray-900 text-white border-gray-900"
                                : "bg-white text-gray-900 border-gray-300"
                        }`}
                    >
                        Google Play
                    </button>
                </div>

                {/* 선택된 QR만 표시 */}
                <div className="flex flex-col items-center gap-2">
                    <div className="w-full max-w-[220px] aspect-square bg-gray-200 rounded overflow-hidden flex items-center justify-center">
                        <img
                            alt={isApple ? "App Store QR" : "Google Play QR"}
                            className="w-full h-full object-contain"
                            src={qrSrc(currentUrl)}
                            onError={(e) => {
                                e.currentTarget.style.display = "none";
                            }}
                        />
                    </div>
                    <span className="text-xs text-gray-600">{isApple ? "App Store" : "Google Play"}</span>
                </div>

                <button
                    type="button"
                    className=" mt-2 w-full py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 hover:cursor-pointer tracking-tight"
                    onClick={() => onClose?.()}
                >
                    닫기
                </button>
            </div>
        </div>
    );
}
