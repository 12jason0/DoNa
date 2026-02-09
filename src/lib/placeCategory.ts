/**
 * 장소 카테고리(DB Raw) → 4가지 타입 매핑
 * 맛집(DINING) / 카페(CAFE) / 술집(PUB) / 놀거리(PLAY)
 */

export type PlaceCategoryType = "DINING" | "CAFE" | "PUB" | "PLAY";

/** 타입별 DB에 저장된 raw 문자열 목록 (포함 여부로 매핑) */
const RAW_BY_TYPE: Record<PlaceCategoryType, string[]> = {
    DINING: ["음식", "음식점", "식당", "샌드위치"],
    CAFE: ["카페", "이색카페", "베이커리"],
    PUB: ["주점", "이자카야"],
    PLAY: ["야외명소", "실내명소", "향수", "전시장", "박물관", "공원", "복합문화공간", "셀프 사진관"],
};

/**
 * DB category 문자열 → 4가지 타입으로 정규화
 */
export function getPlaceCategoryType(category: string | null | undefined): PlaceCategoryType {
    if (!category || typeof category !== "string") return "DINING";
    const raw = category.trim();
    if (!raw) return "DINING";

    if (RAW_BY_TYPE.CAFE.some((r) => raw === r || raw.includes(r))) return "CAFE";
    if (RAW_BY_TYPE.PUB.some((r) => raw === r || raw.includes(r))) return "PUB";
    if (RAW_BY_TYPE.PLAY.some((r) => raw === r || raw.includes(r))) return "PLAY";
    if (RAW_BY_TYPE.DINING.some((r) => raw === r || raw.includes(r))) return "DINING";

    return "DINING";
}

export interface PremiumQuestion {
    /** TipCategory (TipCategoryIcon용). label 대신 아이콘으로 표시 */
    iconCategory: string;
    text: string;
}

export interface PremiumCopy {
    headline: string;
    questions: PremiumQuestion[];
}

/**
 * 카테고리별 "지갑을 여는" 잠금 멘트 + 질문 세트
 */
export function getPremiumQuestions(category: string | null | undefined): PremiumCopy {
    const type = getPlaceCategoryType(category);
    const raw = (category ?? "").trim();

    switch (type) {
        case "DINING":
            return {
                headline: "맛없는 거 먹고 살찌는 게 제일 싫죠?",
                questions: [
                    { iconCategory: "BEST_SPOT", text: "웨이팅 없이 들어가는 '히든 타임' & 예약 꿀팁?" },
                    { iconCategory: "SIGNATURE_MENU", text: '"이건 절대 시키지 마세요" 호불호 갈리는 비추 메뉴?' },
                    { iconCategory: "CAUTION", text: "소개팅/진지한 대화하기 좋은 '가장 조용한 자리'?" },
                ],
            };
        case "CAFE":
            return {
                headline: "자리 없어서 서성거리는 쪽팔림을 방지하세요",
                questions: [
                    { iconCategory: "BEST_SPOT", text: "콘센트 있고 의자 편한 '카공/작업 명당' 위치?" },
                    { iconCategory: "PHOTO_ZONE", text: "역광 피해서 여친 인생샷 건지는 '조명 명당'?" },
                    { iconCategory: "SIGNATURE_MENU", text: "늦게 가면 품절되는 '필수 주문 시그니처'?" },
                ],
            };
        case "PUB":
            return {
                headline: "화장실 때문에 썸 깨지는 일을 막아드립니다",
                questions: [
                    { iconCategory: "RESTROOM", text: '"여기 가지 마세요" 건물 밖 공용 화장실 피하는 법?' },
                    { iconCategory: "SIGNATURE_MENU", text: "술 못 마시는 상대방도 반하는 '작업주' 추천 리스트?" },
                    { iconCategory: "VIBE_CHECK", text: "조명 빨 제대로 받는 '셀카 & 썸 명당' 테이블?" },
                ],
            };
        case "PLAY":
            return {
                headline:
                    raw === "야외명소" || raw.includes("야외명소")
                        ? "무작정 걷다가 여자친구 다리 붓게 하지 마세요"
                        : "다리 아프고 사진 망치는 데이트는 이제 그만",
                questions: [
                    { iconCategory: "ATTIRE", text: '"치마 입고 가지 마세요" 후회하는 구간은?' },
                    { iconCategory: "ROUTE", text: "여자친구 다리 안 아픈 '최적의 관람/산책 코스'?" },
                    { iconCategory: "PHOTO_ZONE", text: "줄 안 서고 우리끼리 찍는 '비밀 포토존' 위치?" },
                ],
            };
        default:
            return {
                headline: "아메리카노 한 잔 값으로, 이번 달 데이트 준비 끝내기",
                questions: [],
            };
    }
}
