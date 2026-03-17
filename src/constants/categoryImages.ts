// src/constants/categoryImages.ts

import { getS3StaticUrl } from "@/lib/s3Static";

// CloudFront를 통한 개념 아이콘 URL 생성 (11개 컨셉)
const BASE_URL = getS3StaticUrl("concept-Icon");

export const S3_CONCEPT_IMAGES: Record<string, string> = {
    // [1] 가성비
    COST_EFFECTIVE: `${BASE_URL}/COST_EFFECTIVE.png`,
    가성비: `${BASE_URL}/COST_EFFECTIVE.png`,

    // [2] 감성데이트
    EMOTIONAL: `${BASE_URL}/EMOTIONAL.png`,
    감성데이트: `${BASE_URL}/EMOTIONAL.png`,

    // [3] 공연·전시
    EXHIBITION: `${BASE_URL}/EXHIBITION.png`,
    "공연·전시": `${BASE_URL}/EXHIBITION.png`,
    공연전시: `${BASE_URL}/EXHIBITION.png`,

    // [4] 맛집탐방
    FOOD_TOUR: `${BASE_URL}/FOOD_TOUR.png`,
    맛집탐방: `${BASE_URL}/FOOD_TOUR.png`,

    // [5] 카페투어
    CAFE: `${BASE_URL}/CAFE.png`,
    카페투어: `${BASE_URL}/CAFE.png`,

    // [6] 술자리
    DRINKING: `${BASE_URL}/DRINKING.png`,
    술자리: `${BASE_URL}/DRINKING.png`,

    // [7] 실내데이트
    INDOOR: `${BASE_URL}/INDOOR.png`,
    실내데이트: `${BASE_URL}/INDOOR.png`,

    // [7] 야경
    NIGHT_VIEW: `${BASE_URL}/NIGHT_VIEW.png`,
    야경: `${BASE_URL}/NIGHT_VIEW.png`,

    // [8] 이색데이트
    UNIQUE: `${BASE_URL}/UNIQUE.png`,
    이색데이트: `${BASE_URL}/UNIQUE.png`,

    // [9] 인생샷
    PHOTO: `${BASE_URL}/PHOTO.png`,
    인생샷: `${BASE_URL}/PHOTO.png`,

    // [10] 힐링
    HEALING: `${BASE_URL}/HEALING.png`,
    힐링: `${BASE_URL}/HEALING.png`,
};
