export default function Head() {
    const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://dona.local") + "/map";
    const title = "지도 검색 - DoNa";
    const description = "지도에서 주변 장소와 추천 코스를 찾아보세요. 현재 위치 기반 가까운 맛집·카페·명소 탐색.";
    const image = "https://stylemap-seoul.s3.ap-northeast-2.amazonaws.com/logo/donalogo_512.png";
    return (
        <>
            <title>{title}</title>
            <meta name="description" content={description} />

            {/* Open Graph */}
            <meta property="og:type" content="website" />
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={image} />
            <meta property="og:url" content={baseUrl} />

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={image} />
        </>
    );
}
