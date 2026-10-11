// 지역별 데이트 코스 페이지 (SEO). 로그인 없이 서버에서 HTML로 렌더, 봇·사람 동일 내용.
// 공개 범위: FREE 코스는 장소 이름까지, 유료(BASIC·PREMIUM) 코스는 제목·서브타이틀·등급만.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { notExpiredCourseWhere } from "@/lib/placePeriod";
import prisma from "@/lib/db";
import { courseInRegion, regionIntro } from "@/lib/regionIntro";

export const revalidate = 3600;

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://dona.io.kr").replace(/\/$/, "");

const GRADE_LABEL: Record<string, string> = { FREE: "무료", BASIC: "베이직", PREMIUM: "프리미엄" };

type RegionCourse = {
    id: number;
    title: string;
    sub_title: string | null;
    grade: string;
    imageUrl: string | null;
    duration: string | null;
    /** FREE 코스만 채움 */
    placeNames: string[];
};

function decodeRegion(raw: string): string {
    try {
        return decodeURIComponent(raw).trim();
    } catch {
        return raw.trim();
    }
}

async function getRegionData(region: string) {
    const known = await prisma.region.findUnique({ where: { name: region }, select: { name: true } });
    if (!known) return null;

    const rows = await prisma.course.findMany({
        where: { isPublic: true, region: { contains: region }, ...notExpiredCourseWhere() },
        orderBy: [{ isPopular: "desc" }, { createdAt: "desc" }],
        select: {
            id: true,
            title: true,
            sub_title: true,
            grade: true,
            imageUrl: true,
            duration: true,
            region: true,
            coursePlaces: { orderBy: { order_index: "asc" }, select: { place: { select: { name: true } } } },
        },
    });
    const courses: RegionCourse[] = rows
        .filter((c) => courseInRegion(c.region, region))
        .map((c) => {
            const isFree = c.grade === "FREE";
            return {
                id: c.id,
                title: c.title,
                sub_title: c.sub_title,
                grade: c.grade,
                // 유료 코스는 장소가 드러날 수 있는 정보(사진·소요시간 포함)를 빼고 제목·서브타이틀·등급만
                imageUrl: isFree ? c.imageUrl : null,
                duration: isFree ? c.duration : null,
                placeNames: isFree ? c.coursePlaces.map((cp) => cp.place?.name).filter((n): n is string => !!n) : [],
            };
        });
    if (courses.length === 0) return null;

    // 다른 지역 내부 링크: 공개 코스가 있는 지역만
    const [regions, publicRegions] = await Promise.all([
        prisma.region.findMany({ orderBy: { display_order: "asc" }, select: { name: true } }),
        prisma.course.findMany({ where: { isPublic: true }, select: { region: true } }),
    ]);
    const otherRegions = regions
        .map((r) => r.name)
        .filter((name) => name !== region && publicRegions.some((c) => courseInRegion(c.region, name)));

    return { courses, otherRegions };
}

const regionPath = (region: string) => `/regions/${encodeURIComponent(region)}`;

export async function generateMetadata({ params }: { params: Promise<{ region: string }> }): Promise<Metadata> {
    const region = decodeRegion((await params).region);
    const data = await getRegionData(region);
    if (!data) return { title: "지역을 찾을 수 없어요", robots: { index: false } };
    const title = `${region} 데이트 코스 추천 | 두나`;
    const description = regionIntro(region, data.courses.length).join(" ").slice(0, 150);
    return {
        title: { absolute: title },
        description,
        alternates: { canonical: regionPath(region) },
        openGraph: { title, description, url: regionPath(region), type: "website", siteName: "DoNa" },
    };
}

export default async function RegionPage({ params }: { params: Promise<{ region: string }> }) {
    const region = decodeRegion((await params).region);
    const data = await getRegionData(region);
    if (!data) notFound();
    const { courses, otherRegions } = data;
    const intro = regionIntro(region, courses.length);

    // 화면과 같은 범위만: 코스 이름·URL (유료 코스도 이름만)
    const jsonLd = [
        {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `${region} 데이트 코스 추천`,
            description: intro.join(" "),
            url: `${SITE_URL}${regionPath(region)}`,
            mainEntity: {
                "@type": "ItemList",
                itemListElement: courses.map((c, i) => ({
                    "@type": "ListItem",
                    position: i + 1,
                    url: `${SITE_URL}/courses/${c.id}`,
                    name: c.title,
                })),
            },
        },
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
                { "@type": "ListItem", position: 1, name: "두나", item: SITE_URL },
                { "@type": "ListItem", position: 2, name: `${region} 데이트 코스`, item: `${SITE_URL}${regionPath(region)}` },
            ],
        },
    ];

    return (
        <div className="bg-white dark:bg-[#0f1710] text-gray-900 dark:text-white leading-relaxed min-h-screen">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
            />
            <article className="mx-auto max-w-[500px] px-4 py-8">
                <header className="mb-8">
                    <h1 className="text-2xl font-bold mb-3">{region} 데이트 코스 추천</h1>
                    {intro.map((line) => (
                        <p key={line} className="text-sm text-gray-600 dark:text-gray-300">
                            {line}
                        </p>
                    ))}
                </header>

                <section className="mb-10">
                    <h2 className="text-lg font-bold mb-4">{region} 코스 {courses.length}개</h2>
                    <ul className="space-y-3">
                        {courses.map((c) => (
                            <li key={c.id}>
                                <Link
                                    href={`/courses/${c.id}`}
                                    className="flex gap-3 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1a241b] p-3 shadow-sm"
                                >
                                    {c.imageUrl && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={c.imageUrl}
                                            alt={`${c.title} 대표 사진`}
                                            loading="lazy"
                                            className="h-20 w-20 shrink-0 rounded-xl object-cover bg-gray-100"
                                        />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <span
                                            className={`inline-block mb-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                                                c.grade === "FREE"
                                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                                    : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                            }`}
                                        >
                                            {GRADE_LABEL[c.grade] ?? c.grade}
                                        </span>
                                        <h3 className="text-sm font-semibold leading-snug">{c.title}</h3>
                                        {c.sub_title && (
                                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{c.sub_title}</p>
                                        )}
                                        {c.placeNames.length > 0 && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                {c.placeNames.join(" → ")}
                                                {c.duration && ` · ${c.duration}`}
                                            </p>
                                        )}
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>

                {otherRegions.length > 0 && (
                    <nav aria-label="다른 지역 데이트 코스" className="mb-6">
                        <h2 className="text-lg font-bold mb-3">다른 지역 데이트 코스</h2>
                        <ul className="flex flex-wrap gap-2">
                            {otherRegions.map((name) => (
                                <li key={name}>
                                    <Link
                                        href={regionPath(name)}
                                        className="inline-block rounded-full bg-gray-100 dark:bg-white/10 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-200"
                                    >
                                        {name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </nav>
                )}
            </article>
        </div>
    );
}
