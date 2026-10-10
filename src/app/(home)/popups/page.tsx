// src/app/(home)/popups/page.tsx
// 팝업·전시 모음: 기간(start_date/end_date)이 있고 위치가 있는 장소 중 아직 안 끝난 것.
// 서버 컴포넌트 + ISR(1시간)로 크롤러가 JS 없이 읽을 수 있게. 목록은 앱(/api/popups)과 같은 listPopups 사용.
import type { Metadata } from "next";
import Link from "next/link";
import { listPopups, type PopupItem } from "@/lib/popups";

export const runtime = "nodejs";
export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://dona.io.kr";
const PAGE_URL = `${SITE_URL}/popups`;

export const metadata: Metadata = {
    title: "서울 팝업스토어·전시 모음 — 지금 진행 중, 곧 시작", // 뒤에 " | 두나 DoNa"는 레이아웃이 붙임
    description:
        "지금 서울에서 진행 중인 팝업스토어와 전시, 2주 안에 시작하는 곳을 기간과 함께 모았어요. 종료가 임박한 곳은 D-day로 표시하고, 함께 가기 좋은 데이트 코스도 연결해 드려요.",
    alternates: { canonical: PAGE_URL },
    openGraph: {
        title: "서울 팝업·전시 모음 | 두나(DoNa)",
        description: "진행 중인 팝업·전시와 곧 시작하는 곳, 종료 임박 D-day까지 한눈에.",
        url: PAGE_URL,
        type: "website",
        siteName: "DoNa",
    },
    robots: { index: true, follow: true },
};

function PopupCard({ p }: { p: PopupItem }) {
    return (
        <li className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1a241b] shadow-sm overflow-hidden">
            <Link href={`/places/${p.id}`} className="flex gap-3 p-3">
                {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.name} loading="lazy" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
                ) : (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-[#7FCC9F]/15 text-3xl">🎪</div>
                )}
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {p.badge && (
                            <span className="rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-[11px] font-bold text-red-600 dark:text-red-300">{p.badge}</span>
                        )}
                        <h3 className="text-sm font-semibold truncate">{p.name}</h3>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{p.region}</p>
                    <p className="mt-0.5 text-xs font-medium text-[#5f8d57] dark:text-[#99c08e]">{p.period}</p>
                </div>
            </Link>
            {p.courses.length > 0 && (
                <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-2">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">이 장소가 들어간 코스</p>
                    <ul className="flex flex-wrap gap-1.5">
                        {p.courses.map((c) => (
                            <li key={c.id}>
                                <Link href={`/courses/${c.id}`} className="inline-block rounded-full bg-gray-100 dark:bg-white/10 px-2.5 py-1 text-xs text-gray-700 dark:text-gray-200">
                                    {c.title}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </li>
    );
}

export default async function PopupsPage() {
    const { ongoing, upcoming } = await listPopups().catch((e) => {
        console.error("[popups] 조회 실패:", e);
        return { ongoing: [] as PopupItem[], upcoming: [] as PopupItem[] };
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
            <article className="mx-auto max-w-[500px] px-4 py-8">
                <header className="mb-8 rounded-3xl bg-gradient-to-br from-[#e9f6ee] to-[#f6f0e6] dark:from-[#16241a] dark:to-[#0f1710] px-6 py-7 text-center">
                    <h1 className="text-2xl font-bold mb-2">팝업·전시 모음</h1>
                    <p className="text-sm text-gray-600 dark:text-gray-300">지금 진행 중인 곳과 2주 안에 시작하는 곳이에요.</p>
                </header>

                <section className="mb-10">
                    <h2 className="text-lg font-bold mb-3">진행 중 ({ongoing.length})</h2>
                    {ongoing.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">지금 진행 중인 팝업이 없어요</p>
                    ) : (
                        <ul className="space-y-3">
                            {ongoing.map((p) => (
                                <PopupCard key={p.id} p={p} />
                            ))}
                        </ul>
                    )}
                </section>

                <section className="mb-10">
                    <h2 className="text-lg font-bold mb-3">곧 시작 ({upcoming.length})</h2>
                    {upcoming.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">2주 안에 시작하는 팝업이 없어요</p>
                    ) : (
                        <ul className="space-y-3">
                            {upcoming.map((p) => (
                                <PopupCard key={p.id} p={p} />
                            ))}
                        </ul>
                    )}
                </section>
            </article>
        </div>
    );
}
