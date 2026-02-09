"use client";

import { type TipItem } from "@/types/tip";

const iconClass = "w-5 h-5 shrink-0 text-current";

const TipCategoryIcons: Record<string, React.ReactNode> = {
    PARKING: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={iconClass}>
            <path d="M6 3H13C16.3137 3 19 5.68629 19 9C19 12.3137 16.3137 15 13 15H8V21H6V3ZM8 5V13H13C15.2091 13 17 11.2091 17 9C17 6.79086 15.2091 5 13 5H8Z" />
        </svg>
    ),
    SIGNATURE_MENU: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={iconClass}>
            <path d="M14.2683 12.1466L13.4147 13.0002L20.4858 20.0712L19.0716 21.4854L12.0005 14.4144L4.92946 21.4854L3.51525 20.0712L12.854 10.7324C12.2664 9.27549 12.8738 7.17715 14.4754 5.57554C16.428 3.62292 19.119 3.14805 20.4858 4.51488C21.8526 5.88172 21.3778 8.57267 19.4251 10.5253C17.8235 12.1269 15.7252 12.7343 14.2683 12.1466ZM4.22235 3.80777L10.9399 10.5253L8.11144 13.3537L4.22235 9.46463C2.66026 7.90253 2.66026 5.36987 4.22235 3.80777ZM18.0109 9.11107C19.2682 7.85386 19.5274 6.38488 19.0716 5.92909C18.6158 5.47331 17.1468 5.73254 15.8896 6.98975C14.6324 8.24697 14.3732 9.71595 14.829 10.1717C15.2847 10.6275 16.7537 10.3683 18.0109 9.11107Z" />
        </svg>
    ),
    RESTROOM: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" className={iconClass}>
            <path d="M64,112V40a8,8,0,0,1,8-8H184a8,8,0,0,1,8,8v72" />
            <line x1="96" y1="64" x2="112" y2="64" />
            <path d="M216,112a88,88,0,0,1-176,0Z" />
            <path d="M92.42,192.51l-4.34,30.36A8,8,0,0,0,96,232h64a8,8,0,0,0,7.92-9.13l-4.34-30.36" />
        </svg>
    ),
    WAITING: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" className={iconClass}>
            <path d="M128,128,67.2,82.4A8,8,0,0,1,64,76V40a8,8,0,0,1,8-8H184a8,8,0,0,1,8,8V75.64A8,8,0,0,1,188.82,82L128,128h0" />
            <path d="M128,128,67.2,173.6A8,8,0,0,0,64,180v36a8,8,0,0,0,8,8H184a8,8,0,0,0,8-8V180.36a8,8,0,0,0-3.18-6.38L128,128h0" />
            <line x1="128" y1="168" x2="128" y2="128" />
            <line x1="74.67" y1="88" x2="180.92" y2="88" />
        </svg>
    ),
    PHOTO_ZONE: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" className={iconClass}>
            <path d="M208,56H180.28L166.65,35.56A8,8,0,0,0,160,32H96a8,8,0,0,0-6.65,3.56L75.71,56H48A24,24,0,0,0,24,80V192a24,24,0,0,0,24,24H208a24,24,0,0,0,24-24V80A24,24,0,0,0,208,56Zm8,136a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V80a8,8,0,0,1,8-8H80a8,8,0,0,0,6.66-3.56L100.28,48h55.43l13.63,20.44A8,8,0,0,0,176,72h32a8,8,0,0,1,8,8ZM128,88a44,44,0,1,0,44,44A44.05,44.05,0,0,0,128,88Zm0,72a28,28,0,1,1,28-28A28,28,0,0,1,128,160Z" />
        </svg>
    ),
    BEST_SPOT: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" className={iconClass}>
            <path d="M239.18,97.26A16.38,16.38,0,0,0,224.92,86l-59-4.76L143.14,26.15a16.36,16.36,0,0,0-30.27,0L90.11,81.23,31.08,86a16.46,16.46,0,0,0-9.37,28.86l45,38.83L53,211.75a16.38,16.38,0,0,0,24.5,17.82L128,198.49l50.53,31.08A16.4,16.4,0,0,0,203,211.75l-13.76-58.07,45-38.83A16.43,16.43,0,0,0,239.18,97.26Zm-15.34,5.47-48.7,42a8,8,0,0,0-2.56,7.91l14.88,62.8a.37.37,0,0,1-.17.48c-.18.14-.23.11-.38,0l-54.72-33.65a8,8,0,0,0-8.38,0L69.09,215.94c-.15.09-.19.12-.38,0a.37.37,0,0,1-.17-.48l14.88-62.8a8,8,0,0,0-2.56-7.91l-48.7-42c-.12-.1-.23-.19-.13-.5s.18-.27.33-.29l63.92-5.16A8,8,0,0,0,103,91.86l24.62-59.61c.08-.17.11-.25.35-.25s.27.08.35.25L153,91.86a8,8,0,0,0,6.75,4.92l63.92,5.16c.15,0,.24,0,.33.29S224,102.63,223.84,102.73Z" />
        </svg>
    ),
    ROUTE: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" className={iconClass}>
            <path d="M200,168a32.06,32.06,0,0,0-31,24H72a32,32,0,0,1,0-64h96a40,40,0,0,0,0-80H72a8,8,0,0,0,0,16h96a24,24,0,0,1,0,48H72a48,48,0,0,0,0,96h97a32,32,0,1,0,31-40Zm0,48a16,16,0,1,1,16-16A16,16,0,0,1,200,216Z" />
        </svg>
    ),
    ATTIRE: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" className={iconClass}>
            <path d="M241.57,171.2,141.33,96l23.46-17.6A8,8,0,0,0,168,72a40,40,0,1,0-80,0,8,8,0,0,0,16,0,24,24,0,0,1,47.69-3.78L123.34,89.49l-.28.21L14.43,171.2A16,16,0,0,0,24,200H232a16,16,0,0,0,9.6-28.8ZM232,184H24l104-78,104,78Z" />
        </svg>
    ),
    GOOD_TO_KNOW: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" className={iconClass}>
            <path d="M176,232a8,8,0,0,1-8,8H88a8,8,0,0,1,0-16h80A8,8,0,0,1,176,232Zm40-128a87.55,87.55,0,0,1-33.64,69.21A16.24,16.24,0,0,0,176,186v6a16,16,0,0,1-16,16H96a16,16,0,0,1-16-16v-6a16,16,0,0,0-6.23-12.66A87.59,87.59,0,0,1,40,104.49C39.74,56.83,78.26,17.14,125.88,16A88,88,0,0,1,216,104Zm-16,0a72,72,0,0,0-73.74-72c-39,.92-70.47,33.39-70.26,72.39a71.65,71.65,0,0,0,27.64,56.3A32,32,0,0,1,96,186v6h64v-6a32.15,32.15,0,0,1,12.47-25.35A71.65,71.65,0,0,0,200,104Zm-16.11-9.34a57.6,57.6,0,0,0-46.56-46.55,8,8,0,0,0-2.66,15.78c16.57,2.79,30.63,16.85,33.44,33.45A8,8,0,0,0,176,104a9,9,0,0,0,1.35-.11A8,8,0,0,0,183.89,94.66Z" />
        </svg>
    ),
    CAUTION: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" className={iconClass}>
            <path d="M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM222.93,203.8a8.5,8.5,0,0,1-7.48,4.2H40.55a8.5,8.5,0,0,1-7.48-4.2,7.59,7.59,0,0,1,0-7.72L120.52,44.21a8.75,8.75,0,0,1,15,0l87.45,151.87A7.59,7.59,0,0,1,222.93,203.8ZM120,144V104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,180Z" />
        </svg>
    ),
    VIBE_CHECK: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" className={iconClass}>
            <path d="M56,96v64a8,8,0,0,1-16,0V96a8,8,0,0,1,16,0ZM88,24a8,8,0,0,0-8,8V224a8,8,0,0,0,16,0V32A8,8,0,0,0,88,24Zm40,32a8,8,0,0,0-8,8V192a8,8,0,0,0,16,0V64A8,8,0,0,0,128,56Zm40,32a8,8,0,0,0-8,8v64a8,8,0,0,0,16,0V96A8,8,0,0,0,168,88Zm40-16a8,8,0,0,0-8,8v96a8,8,0,0,0,16,0V80A8,8,0,0,0,208,72Z" />
        </svg>
    ),
    ETC: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" className={iconClass}>
            <path d="M176,232a8,8,0,0,1-8,8H88a8,8,0,0,1,0-16h80A8,8,0,0,1,176,232Zm40-128a87.55,87.55,0,0,1-33.64,69.21A16.24,16.24,0,0,0,176,186v6a16,16,0,0,1-16,16H96a16,16,0,0,1-16-16v-6a16,16,0,0,0-6.23-12.66A87.59,87.59,0,0,1,40,104.49C39.74,56.83,78.26,17.14,125.88,16A88,88,0,0,1,216,104Zm-16,0a72,72,0,0,0-73.74-72c-39,.92-70.47,33.39-70.26,72.39a71.65,71.65,0,0,0,27.64,56.3A32,32,0,0,1,96,186v6h64v-6a32.15,32.15,0,0,1,12.47-25.35A71.65,71.65,0,0,0,200,104Zm-16.11-9.34a57.6,57.6,0,0,0-46.56-46.55,8,8,0,0,0-2.66,15.78c16.57,2.79,30.63,16.85,33.44,33.45A8,8,0,0,0,176,104a9,9,0,0,0,1.35-.11A8,8,0,0,0,183.89,94.66Z" />
        </svg>
    ),
};

/** 리스트용: 카테고리 아이콘만 표시 (내용 없음). 모달에서는 TipSection 사용 */
export function TipCategoryIcon({ category, className }: { category: string; className?: string }) {
    return (
        <span className={`shrink-0 flex items-center justify-center text-inherit ${className ?? ""}`}>
            {TipCategoryIcons[category] ?? TipCategoryIcons["ETC"]}
        </span>
    );
}

const Icons = {
    Bulb: ({ className }: { className?: string }) => (
        <svg
            className={className || "w-4 h-4 text-emerald-500 shrink-0"}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
        </svg>
    ),
    Crown: ({ className }: { className?: string }) => (
        <svg className={className || "w-3.5 h-3.5 text-amber-600 shrink-0"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2 17h20" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 17V8l5-4 5 4v9" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 17l3-6 3 4 3-6 3 4 3-6" />
        </svg>
    ),
};

type Variant = "free" | "paid";

interface TipSectionProps {
    tips: TipItem[];
    variant: Variant;
    className?: string;
    /** 목록 뷰에서는 3줄 clamp, 모달에서는 전체 표시 */
    compact?: boolean;
}

export function TipSection({ tips, variant, className = "", compact = false }: TipSectionProps) {
    if (!tips || tips.length === 0) return null;

    const isFree = variant === "free";
    const wrapperClass = isFree
        ? "rounded-xl px-5 py-4 bg-[#F0F4F8] dark:bg-gray-800"
        : "rounded-xl p-3 bg-[#FFFBEB] dark:bg-[#1c1917] dark:border dark:border-amber-800/50";

    return (
        <div className={`${wrapperClass} ${className}`}>
            <div className="flex items-center gap-1.5 mb-1.5">
                {isFree ? (
                    <>
                        <Icons.Bulb className="w-4 h-4 text-emerald-600 dark:text-emerald-500 shrink-0" />
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                            Dona&apos;s Pick
                        </span>
                    </>
                ) : (
                    <>
                        <Icons.Crown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300 shrink-0" />
                        <span className="text-[9px] font-bold tracking-wide text-amber-700 dark:text-amber-300 uppercase">
                            PREMIUM TIP
                        </span>
                    </>
                )}
            </div>
            <div className="flex flex-col gap-2">
                {tips.map((t, i) => (
                    <div key={i} className="flex gap-2 items-start">
                        <TipCategoryIcon category={t.category} />
                        <p
                            className={`text-xs text-gray-700 dark:text-gray-100 leading-relaxed min-w-0 flex-1 ${
                                compact ? "" : "whitespace-pre-wrap"
                            }`}
                        >
                            {t.content}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}
