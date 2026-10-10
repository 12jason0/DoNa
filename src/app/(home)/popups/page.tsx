// src/app/(home)/popups/page.tsx
// 팝업·전시 모음: 기간(start_date/end_date)이 있고 위치가 있는 장소 중 아직 안 끝난 것.
// 서버에서 목록을 읽어 HTML로 내려주고(크롤러용), 화면은 PopupsClient가 언어 설정에 맞게 표시.
// 언어별 메타태그는 기존 레이아웃처럼 Accept-Language 기준 (언어별 URL이 없어 hreflang은 안 씀)
import type { Metadata } from "next";
import { headers } from "next/headers";
import { listPopups } from "@/lib/popups";
import type { PopupItem } from "@/lib/popupFormat";
import ko from "@/i18n/messages/ko/translation.json";
import en from "@/i18n/messages/en/translation.json";
import ja from "@/i18n/messages/ja/translation.json";
import zh from "@/i18n/messages/zh/translation.json";
import PopupsClient from "./PopupsClient";

export const runtime = "nodejs";
export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://dona.io.kr";
const PAGE_URL = `${SITE_URL}/popups`;
const MESSAGES = { ko, en, ja, zh } as const;

export async function generateMetadata(): Promise<Metadata> {
    // (home)/layout.tsx 의 detectLocale 과 같은 규칙
    const langs = ((await headers()).get("accept-language") || "").split(",").map((l) => l.split(";")[0].trim().split("-")[0]);
    const locale = (langs.find((l) => l in MESSAGES) ?? "ko") as keyof typeof MESSAGES;
    const m = MESSAGES[locale].popups;
    return {
        title: m.metaTitle, // 뒤에 " | 두나 DoNa"는 레이아웃이 붙임
        description: m.metaDescription,
        alternates: { canonical: PAGE_URL },
        openGraph: { title: m.metaTitle, description: m.metaDescription, url: PAGE_URL, type: "website", siteName: "DoNa" },
        robots: { index: true, follow: true },
    };
}

export default async function PopupsPage() {
    const { ongoing, upcoming, todayYear } = await listPopups().catch((e) => {
        console.error("[popups] 조회 실패:", e);
        return { ongoing: [] as PopupItem[], upcoming: [] as PopupItem[], todayYear: new Date().getFullYear() };
    });

    // 화면에 보이는 목록과 같은 내용의 Event 목록 (검색 엔진용)
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "서울 팝업스토어·전시 모음",
        itemListElement: [...ongoing, ...upcoming].map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item: {
                "@type": "Event",
                name: p.name,
                ...(p.name_en && p.name_en !== p.name ? { alternateName: p.name_en } : {}),
                url: `${SITE_URL}/places/${p.id}`,
                ...(p.startDate ? { startDate: p.startDate } : {}),
                ...(p.endDate ? { endDate: p.endDate } : {}),
                ...(p.imageUrl ? { image: p.imageUrl } : {}),
                eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
                location: { "@type": "Place", name: p.name, address: p.address ?? undefined },
            },
        })),
    };

    return (
        <div className="bg-white dark:bg-[#0f1710] text-gray-900 dark:text-white leading-relaxed min-h-screen">
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <PopupsClient ongoing={ongoing} upcoming={upcoming} todayYear={todayYear} />
        </div>
    );
}
