import { getS3StaticUrlForMetadata } from "@/lib/s3StaticUrl";

export default function Head() {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://dona.local";
    const title = "DoNa - 당신만의 여행 코스";
    const description = "취향에 맞는 데이트/여행 코스를 발견하세요. 지역별 인기 코스와 맞춤 추천을 제공합니다.";
    const image = getS3StaticUrlForMetadata("logo/donalogo_512.png");
    const cloudfrontDomain = process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN || process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL?.replace(/^https?:\/\//, "") || "d13xx6k6chk2in.cloudfront.net";
    return (
        <>
            <title>{title}</title>
            <meta name="description" content={description} />
            {/* Image CDN preconnect for faster LCP */}
            <link rel="preconnect" href={`https://${cloudfrontDomain}`} />
            <link rel="dns-prefetch" href={`https://${cloudfrontDomain}`} />

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
