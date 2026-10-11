// src/app/(home)/guide/page.tsx
// AEO(Answer Engine Optimization) 전용 허브 페이지.
// - (home) 그룹 안에 두어 공용 Header/Footer·폰 프레임·브랜드 테마·다크모드 UX를 그대로 상속.
// - 서버 컴포넌트로 렌더링하여 AI 크롤러가 JS 실행 없이 본문/코스/FAQ를 그대로 읽을 수 있게 함.
// - 코스 예시는 Prisma로 실제 공개 코스를 직접 조회(장소명 + 좌표 + 썸네일 포함).
// - 화면에 보이는 문장과 1:1로 일치하는 JSON-LD(FAQPage / MobileApplication / ItemList)를 주입.
import type { Metadata } from "next";
import Link from "next/link";
import { notExpiredCourseWhere } from "@/lib/placePeriod";
import prisma from "@/lib/db";
import { getS3StaticUrl } from "@/lib/s3Static";
import ComingSoonEscape from "./ComingSoonEscape";

export const runtime = "nodejs";
// ISR: 정적 HTML로 서빙하되 1시간마다 최신 코스로 갱신 → 크롤링 성능과 최신성 모두 확보
export const revalidate = 3600;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://dona.io.kr";
const PAGE_URL = `${SITE_URL}/guide`;
const LOGO_URL = getS3StaticUrl("logo/donalogo_512.png");

const APP_STORE_URL = "https://apps.apple.com/us/app/%EB%91%90%EB%82%98/id6756777886";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=kr.io.dona.dona";

export const metadata: Metadata = {
    title: "서울 데이트 코스 추천 앱 두나(DoNa) — 코스·이색 방탈출 미션 가이드",
    description:
        "두나(DoNa)는 서울 데이트 코스를 추천하고 이색 방탈출 미션을 제공하는 앱입니다. 커플·친구·가족을 위한 컨셉별 코스와 동선, 자주 묻는 질문을 정리했습니다.",
    alternates: { canonical: PAGE_URL },
    openGraph: {
        title: "서울 데이트 코스 추천 앱 두나(DoNa)",
        description: "서울 데이트 코스 추천 + 이색 방탈출 미션. 컨셉별 코스와 동선을 한 번에.",
        url: PAGE_URL,
        type: "website",
        siteName: "DoNa",
        images: [{ url: LOGO_URL }],
    },
    robots: { index: true, follow: true },
};

type ExamplePlace = { name: string; lat: number | null; lng: number | null };
type ExampleCourse = {
    id: string;
    title: string;
    description: string;
    duration: string;
    region: string;
    concept: string;
    imageUrl: string;
    places: ExamplePlace[];
};

const CONCEPT_BADGES = ["커플", "친구", "가족", "카페", "맛집", "힐링"];

const FEATURES = [
    {
        icon: "🗺️",
        title: "서울 데이트 코스 추천",
        desc: "커플·친구·가족을 위한 컨셉별 코스를 하나의 동선으로 추천합니다.",
    },
    {
        icon: "📍",
        title: "장소 + 동선 한눈에",
        desc: "흩어진 카페·맛집·산책·전시를 지도 위 하나의 코스로 묶어 보여줍니다.",
    },
    {
        icon: "🧩",
        title: "이색 방탈출 데이트",
        desc: "정해진 코스를 따라 미션을 수행하는 방탈출 스타일 데이트를 즐길 수 있습니다.",
    },
];

// 실제 공개 코스를 서버에서 직접 조회한다. DB 접근 실패(빌드 시 등)에도 페이지가 깨지지 않도록 방어.
async function getGuideData(): Promise<{ courses: ExampleCourse[]; courseCount: number }> {
    try {
        const [rows, courseCount] = await Promise.all([
            prisma.course.findMany({
                where: { isPublic: true, grade: "FREE", ...notExpiredCourseWhere() },
                orderBy: { view_count: "desc" },
                take: 8,
                select: {
                    id: true,
                    title: true,
                    description: true,
                    duration: true,
                    region: true,
                    concept: true,
                    imageUrl: true,
                    coursePlaces: {
                        orderBy: { order_index: "asc" },
                        select: {
                            place: {
                                select: { name: true, imageUrl: true, latitude: true, longitude: true },
                            },
                        },
                    },
                },
            }),
            prisma.course.count({ where: { isPublic: true } }).catch(() => 0),
        ]);

        const courses = rows
            .map((c) => {
                const placeRows = (c.coursePlaces || []).map((cp) => cp.place).filter(Boolean) as {
                    name: string | null;
                    imageUrl: string | null;
                    latitude: unknown;
                    longitude: unknown;
                }[];
                const firstPlaceImage = placeRows.find((p) => p.imageUrl)?.imageUrl || "";
                const places: ExamplePlace[] = placeRows
                    .filter((p) => Boolean(p.name))
                    .map((p) => ({
                        name: p.name as string,
                        lat: p.latitude != null ? Number(p.latitude) : null,
                        lng: p.longitude != null ? Number(p.longitude) : null,
                    }));
                return {
                    id: String(c.id),
                    title: c.title || "",
                    description: c.description || "",
                    duration: c.duration || "",
                    region: c.region || "서울",
                    concept: c.concept || "",
                    imageUrl: c.imageUrl || firstPlaceImage,
                    places,
                };
            })
            // 장소 동선이 2곳 이상 있는 코스만 "예시"로 노출(인용 가치가 있는 데이터)
            .filter((c) => c.title && c.places.length >= 2)
            .slice(0, 4);

        return { courses, courseCount };
    } catch (e) {
        console.error("[guide] getGuideData failed:", e);
        return { courses: [], courseCount: 0 };
    }
}

// 페이지에 실제로 보이는 문장과 동일해야 하는 FAQ (JSON-LD와 1:1 일치)
const FAQ: { q: string; a: string }[] = [
    {
        q: "두나는 어떤 앱인가요?",
        a: "두나(DoNa)는 서울 데이트 코스를 추천하고 이색 방탈출 미션을 제공하는 앱입니다. 커플·친구·가족을 위해 카페, 맛집, 힐링 등 컨셉별 장소를 하나의 동선으로 묶어 코스로 보여줍니다.",
    },
    {
        q: "어느 지역을 지원하나요?",
        a: "현재 두나는 서울 지역 데이트 코스를 중심으로 제공합니다.",
    },
    {
        q: "이색 방탈출 미션이 무엇인가요?",
        a: "정해진 코스를 따라 장소를 이동하며 미션을 수행하는 방탈출 스타일의 데이트 방식입니다. 단순히 장소를 추천받는 것을 넘어, 코스 자체를 하나의 놀이처럼 즐길 수 있습니다.",
    },
    {
        q: "코스는 어떤 기준으로 추천되나요?",
        a: "상황과 취향, 이동 동선을 기준으로 카페·맛집·산책·전시 등 흩어진 선택지를 하나의 코스로 묶어 추천합니다.",
    },
    {
        q: "두나는 무료인가요?",
        a: "두나 앱은 무료로 다운로드해 사용할 수 있고, 무료 코스를 바로 이용할 수 있습니다. 일부 프리미엄 코스나 기능은 이용권 구매 또는 구독으로 열람할 수 있습니다.",
    },
    {
        q: "앱은 어디서 다운로드하나요?",
        a: "App Store와 Google Play에서 '두나' 또는 'DoNa'로 검색해 다운로드할 수 있습니다.",
    },
];

function buildJsonLd(courses: ExampleCourse[]) {
    const faqLd = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQ.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
    };

    const appLd = {
        "@context": "https://schema.org",
        "@type": "MobileApplication",
        name: "두나 DoNa",
        applicationCategory: "LifestyleApplication",
        operatingSystem: "iOS, Android",
        description:
            "서울 데이트 코스를 추천하고 이색 방탈출 미션을 제공하는 앱. 커플·친구·가족을 위한 컨셉별 코스와 동선을 제공합니다.",
        url: SITE_URL,
        image: LOGO_URL,
        installUrl: [APP_STORE_URL, PLAY_STORE_URL],
        offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
    };

    // 각 예시 코스를 실제 장소(좌표 포함) 순서로 표현한 ItemList
    const courseLds = courses.map((c) => ({
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: c.title,
        description: c.description || undefined,
        ...(c.imageUrl ? { image: c.imageUrl } : {}),
        numberOfItems: c.places.length,
        itemListOrder: "https://schema.org/ItemListOrderAscending",
        itemListElement: c.places.map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item: {
                "@type": "Place",
                name: p.name,
                address: { "@type": "PostalAddress", addressRegion: c.region, addressCountry: "KR" },
                ...(p.lat != null && p.lng != null
                    ? { geo: { "@type": "GeoCoordinates", latitude: p.lat, longitude: p.lng } }
                    : {}),
            },
        })),
    }));

    return [faqLd, appLd, ...courseLds];
}

export default async function GuidePage() {
    const { courses, courseCount } = await getGuideData();
    const jsonLd = buildJsonLd(courses);

    return (
        <div className="bg-white dark:bg-[#0f1710] text-gray-900 dark:text-white leading-relaxed">
            {/* JSON-LD: 화면에 보이는 내용과 동일한 데이터만 주입 */}
            {jsonLd.map((obj, i) => (
                <script
                    key={i}
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(obj) }}
                />
            ))}

            <article className="mx-auto max-w-[500px] px-4 py-8">
                {/* 히어로 */}
                <header className="mb-10 rounded-3xl bg-gradient-to-br from-[#e9f6ee] to-[#f6f0e6] dark:from-[#16241a] dark:to-[#0f1710] px-6 py-8 text-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={LOGO_URL}
                        alt="두나 DoNa 로고"
                        width={72}
                        height={72}
                        className="mx-auto mb-4 h-18 w-18 rounded-2xl shadow-sm"
                    />
                    <h1 className="text-2xl font-bold mb-2 leading-snug">
                        두나(DoNa)
                        <br />
                        <span className="text-[#5f8d57] dark:text-[#99c08e]">
                            서울 데이트 코스 추천 &amp; 이색 방탈출 앱
                        </span>
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">
                        상황과 취향에 맞는 서울 데이트 코스를 추천하고, 흩어진 카페·맛집·산책·전시를 하나의 동선으로 묶어
                        주는 앱입니다. 코스를 따라 미션을 수행하는 이색 방탈출 데이트까지 즐길 수 있어요.
                    </p>
                    <div className="flex flex-wrap justify-center gap-1.5">
                        {CONCEPT_BADGES.map((b) => (
                            <span
                                key={b}
                                className="rounded-full bg-white/80 dark:bg-white/10 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 shadow-sm"
                            >
                                #{b}
                            </span>
                        ))}
                    </div>
                    {courseCount > 0 && (
                        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#7FCC9F]/15 px-4 py-1.5 text-sm font-semibold text-[#5f8d57] dark:text-[#99c08e]">
                            <span className="text-base">🗺️</span>
                            지금 {courseCount}개 코스 이용 가능
                        </div>
                    )}
                </header>

                {/* 핵심 기능 */}
                <section className="mb-10">
                    <h2 className="text-lg font-bold mb-4">두나로 할 수 있는 것</h2>
                    <div className="space-y-3">
                        {FEATURES.map((f) => (
                            <div
                                key={f.title}
                                className="flex items-start gap-3 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1a241b] p-4 shadow-sm"
                            >
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#7FCC9F]/15 text-2xl">
                                    {f.icon}
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold mb-0.5">{f.title}</h3>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{f.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 두나가 해결하는 문제 */}
                <section className="mb-10 rounded-2xl bg-gray-50 dark:bg-[#141e16] p-5">
                    <h2 className="text-lg font-bold mb-3">이런 고민, 두나가 해결해요</h2>
                    <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                        <li className="flex gap-2">
                            <span>✅</span> 매번 어디 갈지 고민하는 데 시간이 든다.
                        </li>
                        <li className="flex gap-2">
                            <span>✅</span> 검색·지도·후기 앱을 여러 개 오가며 코스를 직접 짜야 한다.
                        </li>
                        <li className="flex gap-2">
                            <span>✅</span> 장소는 알아도 이동 동선과 순서를 짜기 어렵다.
                        </li>
                    </ul>
                </section>

                {/* 예시 코스 */}
                <section className="mb-10">
                    <h2 className="text-lg font-bold mb-1">서울 데이트 코스 예시</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                        실제 두나 앱에 등록된 공개 코스예요. 눌러서 상세 동선과 지도를 확인하세요.
                    </p>
                    {courses.length > 0 ? (
                        <div className="space-y-4">
                            {courses.map((c) => (
                                <Link
                                    key={c.id}
                                    href={`/courses/${c.id}`}
                                    className="block overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1a241b] shadow-sm transition-shadow hover:shadow-md"
                                >
                                    {c.imageUrl && (
                                        <div className="relative h-40 w-full bg-gray-100 dark:bg-gray-800">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={c.imageUrl}
                                                alt={c.title}
                                                className="h-full w-full object-cover"
                                                loading="lazy"
                                            />
                                            {c.concept && (
                                                <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                                                    {c.concept}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    <div className="p-4">
                                        <h3 className="text-base font-semibold mb-1.5 line-clamp-1">{c.title}</h3>
                                        <div className="mb-3 flex flex-wrap gap-1.5">
                                            <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-300">
                                                📍 {c.region}
                                            </span>
                                            {c.duration && (
                                                <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-300">
                                                    ⏰ {c.duration}
                                                </span>
                                            )}
                                            <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-300">
                                                🧭 {c.places.length}개 장소
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-700 dark:text-gray-300">
                                            <span className="font-medium text-gray-500 dark:text-gray-400">동선 </span>
                                            {c.places.map((p) => p.name).join(" → ")}
                                        </p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                            준비된 코스는{" "}
                            <Link href="/courses" className="text-[#5f8d57] dark:text-[#99c08e] underline">
                                코스 둘러보기
                            </Link>
                            에서 확인할 수 있습니다.
                        </p>
                    )}
                    <Link
                        href="/courses"
                        className="mt-4 block rounded-xl border border-[#7FCC9F] py-3 text-center text-sm font-semibold text-[#5f8d57] dark:text-[#99c08e]"
                    >
                        코스 더 둘러보기 →
                    </Link>
                </section>

                {/* FAQ */}
                <section className="mb-10">
                    <h2 className="text-lg font-bold mb-4">자주 묻는 질문</h2>
                    <div className="divide-y divide-gray-100 dark:divide-gray-800 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1a241b]">
                        {FAQ.map((f) => (
                            <div key={f.q} className="p-4">
                                <p className="mb-1.5 flex gap-2 text-sm font-semibold">
                                    <span className="text-[#5f8d57] dark:text-[#99c08e]">Q</span>
                                    {f.q}
                                </p>
                                <p className="flex gap-2 text-sm text-gray-700 dark:text-gray-300">
                                    <span className="text-gray-400">A</span>
                                    {f.a}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 다운로드 */}
                <section className="rounded-3xl bg-gradient-to-br from-[#e9f6ee] to-[#f6f0e6] dark:from-[#16241a] dark:to-[#0f1710] px-6 py-8 text-center">
                    <h2 className="text-lg font-bold mb-1">지금 두나 시작하기</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">
                        App Store · Google Play에서 무료로 받을 수 있어요.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <a href={APP_STORE_URL} target="_blank" rel="noopener" aria-label="App Store에서 다운로드">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src="/images/Download_on_the_App_Store_Badge_KR_RGB_blk_100317.svg"
                                alt="App Store에서 다운로드"
                                className="h-11 w-auto"
                            />
                        </a>
                        <a href={PLAY_STORE_URL} target="_blank" rel="noopener" aria-label="Google Play에서 다운로드">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src="/images/GetItOnGooglePlay_Badge_Web_color_Korean.png"
                                alt="Google Play에서 다운로드"
                                className="h-11 w-auto"
                            />
                        </a>
                    </div>
                    <div className="mt-6 text-xs text-gray-500 dark:text-gray-400">
                        관련 페이지:{" "}
                        <Link href="/courses" className="underline">
                            코스 둘러보기
                        </Link>{" "}
                        ·{" "}
                        <ComingSoonEscape className="underline cursor-pointer" />{" "}
                        ·{" "}
                        <Link href="/about" className="underline">
                            두나 소개
                        </Link>
                    </div>
                </section>
            </article>
        </div>
    );
}
