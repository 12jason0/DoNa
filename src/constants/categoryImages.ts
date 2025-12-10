// src/constants/categoryImages.ts

// S3 버킷 기본 경로
const BASE_URL = "https://stylemap-seoul.s3.ap-northeast-2.amazonaws.com/concept-Icon";

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
