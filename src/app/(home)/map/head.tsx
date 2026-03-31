import { getS3StaticUrlForMetadata } from "@/lib/s3StaticUrl";
import koMessages from "@/i18n/messages/ko/translation.json";

export default function Head() {
    const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://dona.local") + "/map";
    const mapMeta = (koMessages as { map?: { metaTitle?: string; metaDescription?: string } }).map;
    const title = mapMeta?.metaTitle ?? "Map search - DoNa";
    const description =
        mapMeta?.metaDescription ??
        "Find nearby places and recommended courses on the map.";
    const image = getS3StaticUrlForMetadata("logo/donalogo_512.png");
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
