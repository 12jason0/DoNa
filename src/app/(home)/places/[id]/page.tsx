// 장소 페이지 (SEO). 로그인 없이 서버에서 HTML로 렌더, 봇·사람 동일 내용.
// 공개 범위: 기본 정보(이름·카테고리·주소·영업시간·휴무·가격대·설명)는 공개 코스에 쓰인 장소면 공개.
// 팁 요약·코스 링크는 FREE 코스에 쓰인 경우에만, 그 FREE 코스 것만. 유료 코스와의 연결은 드러내지 않음.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/db";
import { parseTipsFromDb, type TipItem } from "@/types/tip";
import ko from "@/i18n/messages/ko/translation.json";

export const revalidate = 3600;

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://dona.io.kr").replace(/\/$/, "");
const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
const SCHEMA_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIP_SUMMARY_MAX = 4;

async function getPlaceData(id: number) {
    if (!Number.isInteger(id) || id <= 0) return null;
    const place = await prisma.place.findFirst({
        where: { id, status: "published" },
        select: {
            id: true,
            name: true,
            category: true,
            address: true,
            opening_hours: true,
            avg_cost_range: true,
            description: true,
            imageUrl: true,
            latitude: true,
            longitude: true,
            place_status: true,
            closed_days: { select: { day_of_week: true, specific_date: true, note: true } },
            coursePlaces: {
                select: {
                    tips: true,
                    course: { select: { id: true, title: true, grade: true, isPublic: true } },
                },
            },
        },
    });
    if (!place) return null;
    const publicUses = place.coursePlaces.filter((cp) => cp.course.isPublic);
    // 공개 코스에 쓰이지 않은 장소(초안·비공개 전용)는 페이지 없음
    if (publicUses.length === 0) return null;

    // FREE 코스 것만 남김 — 유료 코스 정보는 여기서 버려서 아래 렌더·JSON-LD에 절대 안 들어가게
    const freeUses = publicUses.filter((cp) => cp.course.grade === "FREE");
    const freeCourses = [...new Map(freeUses.map((cp) => [cp.course.id, cp.course])).values()].map((c) => ({
        id: c.id,
        title: c.title,
    }));
    const seen = new Set<string>();
    const tips: TipItem[] = [];
    for (const cp of freeUses) {
        for (const tip of parseTipsFromDb(cp.tips)) {
            if (tips.length >= TIP_SUMMARY_MAX || seen.has(tip.content)) continue;
            seen.add(tip.content);
            tips.push(tip);
        }
    }

    const { coursePlaces: _drop, ...basic } = place;
    return { place: basic, freeCourses, tips };
}

type PlaceData = NonNullable<Awaited<ReturnType<typeof getPlaceData>>>;

/** "10,000 -" → "10,000원 ~", "10,000 - 20,000" → "10,000원 ~ 20,000원" */
function formatPriceRange(raw: string | null): string | null {
    if (!raw?.trim()) return null;
    const m = raw.match(/^\s*([\d,]+)\s*-\s*([\d,]+)?\s*$/);
    if (!m) return raw.trim();
    return `${m[1]}원 ~${m[2] ? ` ${m[2]}원` : ""}`;
}

function closedDayLines(closed: PlaceData["place"]["closed_days"]): string[] {
    const weekly = [...new Set(closed.filter((d) => d.day_of_week != null).map((d) => d.day_of_week!))].sort();
    const today = new Date(new Date().toISOString().slice(0, 10));
    const dates = closed
        .filter((d) => d.specific_date && d.specific_date >= today)
        .map((d) => d.specific_date!.toISOString().slice(0, 10))
        .sort()
        .slice(0, 5);
    return [
        ...(weekly.length ? [`매주 ${weekly.map((d) => DAY_NAMES[d]).join("·")}요일`] : []),
        ...dates.map((d) => `${d} 휴무`),
    ];
}

function schemaType(category: string | null): string {
    if (!category) return "LocalBusiness";
    if (/카페|디저트|베이커리/.test(category)) return "CafeOrCoffeeShop";
    if (/음식|식당|맛집|레스토랑/.test(category)) return "Restaurant";
    if (/술|바|펍|포차/.test(category)) return "BarOrPub";
    return "LocalBusiness";
}

function buildJsonLd({ place }: PlaceData, url: string) {
    const hours = place.opening_hours?.match(/^\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*$/);
    const hhmm = (t: string) => (t === "24:00" ? "23:59" : t.padStart(5, "0"));
    const closedWeekly = new Set(place.closed_days.map((d) => d.day_of_week).filter((d) => d != null));
    return {
        "@context": "https://schema.org",
        "@type": schemaType(place.category),
        name: place.name,
        url,
        ...(place.description && { description: place.description }),
        ...(place.imageUrl && { image: place.imageUrl }),
        ...(place.address && {
            address: { "@type": "PostalAddress", streetAddress: place.address, addressCountry: "KR" },
        }),
        ...(place.latitude != null &&
            place.longitude != null && {
                geo: { "@type": "GeoCoordinates", latitude: place.latitude, longitude: place.longitude },
            }),
        ...(formatPriceRange(place.avg_cost_range) && { priceRange: formatPriceRange(place.avg_cost_range) }),
        ...(hours && {
            openingHoursSpecification: {
                "@type": "OpeningHoursSpecification",
                dayOfWeek: SCHEMA_DAYS.filter((_, i) => !closedWeekly.has(i)),
                opens: hhmm(hours[1]),
                closes: hhmm(hours[2]),
            },
        }),
    };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const data = await getPlaceData(Number((await params).id));
    if (!data) return { title: "장소를 찾을 수 없어요", robots: { index: false } };
    const { place } = data;
    const title = `${place.name}${place.category ? ` - ${place.category}` : ""} | 두나`;
    const description = [place.address, place.opening_hours && `영업 ${place.opening_hours}`, place.description]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 150);
    const path = `/places/${place.id}`;
    return {
        title: { absolute: title },
        description,
        alternates: { canonical: path },
        // 영구 폐업한 장소는 검색 결과에서 빼기
        ...(place.place_status === "CLOSED_PERMANENTLY" && { robots: { index: false, follow: true } }),
        openGraph: {
            title,
            description,
            url: path,
            type: "website",
            siteName: "DoNa",
            ...(place.imageUrl && { images: [place.imageUrl] }),
        },
    };
}

export default async function PlacePage({ params }: { params: Promise<{ id: string }> }) {
    const data = await getPlaceData(Number((await params).id));
    if (!data) notFound();
    const { place, freeCourses, tips } = data;
    const url = `${SITE_URL}/places/${place.id}`;
    const price = formatPriceRange(place.avg_cost_range);
    const closedLines = closedDayLines(place.closed_days);
    const tipLabels = ko.tipCategory as Record<string, string>;

    const rows: [string, string | null][] = [
        ["카테고리", place.category],
        ["주소", place.address],
        ["영업시간", place.opening_hours || "정보 없음"],
        ["휴무", closedLines.length ? closedLines.join(", ") : null],
        ["가격대", price || "정보 없음"],
    ];

    return (
        <div className="bg-white dark:bg-[#0f1710] text-gray-900 dark:text-white leading-relaxed min-h-screen">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(data, url)).replace(/</g, "\\u003c") }}
            />
            <article className="mx-auto max-w-[500px] px-4 py-8">
                {place.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={place.imageUrl}
                        alt={`${place.name}${place.category ? ` ${place.category}` : ""} 사진`}
                        className="mb-5 w-full aspect-[4/3] rounded-2xl object-cover bg-gray-100"
                    />
                )}
                <header className="mb-6">
                    <h1 className="text-2xl font-bold mb-1">{place.name}</h1>
                    {place.place_status === "CLOSED_PERMANENTLY" && (
                        <p className="text-sm font-semibold text-red-600 dark:text-red-400">영업을 종료한 장소예요</p>
                    )}
                </header>

                <section className="mb-8">
                    <h2 className="sr-only">기본 정보</h2>
                    <dl className="divide-y divide-gray-100 dark:divide-gray-800 rounded-2xl border border-gray-100 dark:border-gray-800">
                        {rows
                            .filter(([, v]) => v)
                            .map(([k, v]) => (
                                <div key={k} className="flex gap-4 px-4 py-3 text-sm">
                                    <dt className="w-16 shrink-0 font-semibold text-gray-500 dark:text-gray-400">{k}</dt>
                                    <dd className="min-w-0 flex-1">{v}</dd>
                                </div>
                            ))}
                    </dl>
                    {place.description && (
                        <p className="mt-4 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                            {place.description}
                        </p>
                    )}
                </section>

                {tips.length > 0 && (
                    <section className="mb-8">
                        <h2 className="text-lg font-bold mb-3">두나 꿀팁</h2>
                        <ul className="space-y-2">
                            {tips.map((tip) => (
                                <li
                                    key={tip.content}
                                    className="rounded-xl bg-[#E8F5E9] dark:bg-emerald-950/40 px-4 py-3 text-sm"
                                >
                                    <span className="mr-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                        {tipLabels[tip.category] ?? tipLabels.ETC}
                                    </span>
                                    {tip.content}
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {freeCourses.length > 0 && (
                    <section className="mb-8">
                        <h2 className="text-lg font-bold mb-3">이 장소가 들어간 코스</h2>
                        <ul className="space-y-2">
                            {freeCourses.map((c) => (
                                <li key={c.id}>
                                    <Link
                                        href={`/courses/${c.id}`}
                                        className="block rounded-xl border border-gray-100 dark:border-gray-800 px-4 py-3 text-sm font-medium"
                                    >
                                        {c.title}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </article>
        </div>
    );
}
