// src/constants/categoryImages.ts

// CloudFront 또는 S3 버킷 기본 경로
// 클라이언트/서버 양쪽에서 사용 가능하도록 환경 변수 기반으로 설정
function getBaseUrl(): string {
    // 서버 사이드: 환경 변수 직접 사용
    if (typeof window === "undefined") {
        const customBase = process.env.S3_PUBLIC_BASE_URL || process.env.CLOUDFRONT_DOMAIN;
        if (customBase) {
            const baseUrl = customBase.startsWith("http") ? customBase : `https://${customBase}`;
            return `${baseUrl.replace(/\/$/, "")}/concept-Icon`;
        }
        // Fallback: S3 직접 URL (Private 버킷이면 접근 불가)
        return "https://stylemap-seoul.s3.ap-northeast-2.amazonaws.com/concept-Icon";
    }

    // 클라이언트 사이드: NEXT_PUBLIC_ 환경 변수 사용
    const publicBase = process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN;
    if (publicBase) {
        const baseUrl = publicBase.startsWith("http") ? publicBase : `https://${publicBase}`;
        return `${baseUrl.replace(/\/$/, "")}/concept-Icon`;
    }

    // Fallback: CloudFront 도메인이 설정되지 않은 경우
    return "https://stylemap-seoul.s3.ap-northeast-2.amazonaws.com/concept-Icon";
}

const BASE_URL = getBaseUrl();

export const S3_CONCEPT_IMAGES: Record<string, string> = {
    // ----------------------------------------------------------------
    // [1] 가성비 (COST_EFFECTIVE)
    COST_EFFECTIVE: `${BASE_URL}/COST_EFFECTIVE.png`,
    가성비: `${BASE_URL}/COST_EFFECTIVE.png`,

    // [2] 감성데이트 (EMOTIONAL)
    EMOTIONAL: `${BASE_URL}/EMOTIONAL.png`,
    감성데이트: `${BASE_URL}/EMOTIONAL.png`,

    // [3] 골목투어 (ALLEY)
    ALLEY: `${BASE_URL}/ALLEY.png`,
    골목투어: `${BASE_URL}/ALLEY.png`,

    // [4] 공연·전시 (EXHIBITION)
    EXHIBITION: `${BASE_URL}/EXHIBITION.png`,
    "공연·전시": `${BASE_URL}/EXHIBITION.png`,
    공연전시: `${BASE_URL}/EXHIBITION.png`, // (혹시 특수문자 빠질 경우 대비)

    // [5] 맛집탐방 (FOOD_TOUR)
    FOOD_TOUR: `${BASE_URL}/FOOD_TOUR.png`,
    맛집탐방: `${BASE_URL}/FOOD_TOUR.png`,

    // [6] 문화예술 (ART)
    ART: `${BASE_URL}/ART.png`,
    문화예술: `${BASE_URL}/ART.png`,

    // [7] 쇼핑 (SHOPPING)
    SHOPPING: `${BASE_URL}/SHOPPING.png`,
    쇼핑: `${BASE_URL}/SHOPPING.png`,

    // [8] 술자리 (DRINKING)
    DRINKING: `${BASE_URL}/DRINKING.png`,
    술자리: `${BASE_URL}/DRINKING.png`,

    // [9] 실내데이트 (INDOOR)
    INDOOR: `${BASE_URL}/INDOOR.png`,
    실내데이트: `${BASE_URL}/INDOOR.png`,

    // [10] 야경 (NIGHT_VIEW)
    NIGHT_VIEW: `${BASE_URL}/NIGHT_VIEW.png`,
    야경: `${BASE_URL}/NIGHT_VIEW.png`,

    // [11] 이색데이트 (UNIQUE)
    UNIQUE: `${BASE_URL}/UNIQUE.png`,
    이색데이트: `${BASE_URL}/UNIQUE.png`,

    // [12] 인생샷 (PHOTO)
    PHOTO: `${BASE_URL}/PHOTO.png`,
    인생샷: `${BASE_URL}/PHOTO.png`,

    // [13] 전통문화 (TRADITION)
    TRADITION: `${BASE_URL}/TRADITION.png`,
    전통문화: `${BASE_URL}/TRADITION.png`,

    // [14] 기타 (ETC)
    ETC: `${BASE_URL}/ETC.png`,
    기타: `${BASE_URL}/ETC.png`,

    // [15] 체험 (EXPERIENCE)
    EXPERIENCE: `${BASE_URL}/EXPERIENCE.png`,
    체험: `${BASE_URL}/EXPERIENCE.png`,

    // [16] 카페투어 (CAFE)
    CAFE: `${BASE_URL}/CAFE.png`,
    카페투어: `${BASE_URL}/CAFE.png`,

    // [17] 테마파크 (THEME_PARK)
    THEME_PARK: `${BASE_URL}/THEME_PARK.png`,
    테마파크: `${BASE_URL}/THEME_PARK.png`,

    // [18] 핫플레이스 (HOT_PLACE)
    HOT_PLACE: `${BASE_URL}/HOT_PLACE.png`,
    핫플레이스: `${BASE_URL}/HOT_PLACE.png`,

    // [19] 힐링 (HEALING)
    HEALING: `${BASE_URL}/HEALING.png`,
    힐링: `${BASE_URL}/HEALING.png`,

    // [20] 힙스터 (HIPSTER)
    HIPSTER: `${BASE_URL}/HIPSTER.png`,
    힙스터: `${BASE_URL}/HIPSTER.png`,
};
