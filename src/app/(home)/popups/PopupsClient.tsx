"use client";

// 팝업 목록 화면 (언어 설정에 따라 문구·장소명·코스 제목 전환). 첫 렌더는 ko → 서버 HTML(SEO)과 같음
import Link from "next/link";
import { useLocale } from "@/context/LocaleContext";
import { popupBadge, popupCourseTitle, popupName, popupPeriod, popupRegion, type PopupItem } from "@/lib/popupFormat";

function PopupCard({ p, todayYear }: { p: PopupItem; todayYear: number }) {
    const { t, locale } = useLocale();
    const name = popupName(p, locale);
    const badge = popupBadge(p, t);
    return (
        <li className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1a241b] shadow-sm overflow-hidden">
            <Link href={`/places/${p.id}`} className="flex gap-3 p-3">
                {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={name} loading="lazy" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
                ) : (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-[#7FCC9F]/15 text-3xl">🎪</div>
                )}
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {badge && (
                            <span className="rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-[11px] font-bold text-red-600 dark:text-red-300">{badge}</span>
                        )}
                        <h3 className="text-sm font-semibold truncate">{name}</h3>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{popupRegion(p, locale)}</p>
                    <p className="mt-0.5 text-xs font-medium text-[#5f8d57] dark:text-[#99c08e]">{popupPeriod(p, t, todayYear)}</p>
                </div>
            </Link>
            {p.courses.length > 0 && (
                <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-2">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">{t("popups.coursesWithPlace")}</p>
                    <ul className="flex flex-wrap gap-1.5">
                        {p.courses.map((c) => (
                            <li key={c.id}>
                                <Link href={`/courses/${c.id}`} className="inline-block rounded-full bg-gray-100 dark:bg-white/10 px-2.5 py-1 text-xs text-gray-700 dark:text-gray-200">
                                    {popupCourseTitle(c, locale)}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </li>
    );
}

export default function PopupsClient({ ongoing, upcoming, todayYear }: { ongoing: PopupItem[]; upcoming: PopupItem[]; todayYear: number }) {
    const { t } = useLocale();
    const section = (title: string, items: PopupItem[], empty: string) => (
        <section className="mb-10">
            <h2 className="text-lg font-bold mb-3">
                {title} ({items.length})
            </h2>
            {items.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{empty}</p>
            ) : (
                <ul className="space-y-3">
                    {items.map((p) => (
                        <PopupCard key={p.id} p={p} todayYear={todayYear} />
                    ))}
                </ul>
            )}
        </section>
    );
    return (
        <article className="mx-auto max-w-[500px] px-4 py-8">
            <header className="mb-8 rounded-3xl bg-gradient-to-br from-[#e9f6ee] to-[#f6f0e6] dark:from-[#16241a] dark:to-[#0f1710] px-6 py-7 text-center">
                <h1 className="text-2xl font-bold mb-2">{t("popups.heroTitle")}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-300">{t("popups.heroSub")}</p>
            </header>
            {section(t("popups.ongoing"), ongoing, t("popups.emptyOngoing"))}
            {section(t("popups.upcoming"), upcoming, t("popups.emptyUpcoming"))}
        </article>
    );
}
