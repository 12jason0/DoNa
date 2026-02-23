// src/constants/recommendations.ts

export type UserTagType = "healing" | "photo" | "food" | "cost" | "activity" | "default" | "guest";

export const RECOMMENDATION_MESSAGES = {
    // 1. 조용한/힐링 (#조용한, #힐링)
    healing: {
        sectionTitle: "",
        title: () => `힐링 코스`,
        badge: "조용한 힐링",
    },
    // 2. 인스타/사진 (#사진, #인생샷)z
    photo: {
        sectionTitle: "",
        title: () => `포토존 코스`,
        badge: "인생샷 보장",
    },
    // 3. 맛집/먹방 (#맛집, #먹방)
    food: {
        sectionTitle: "",
        title: () => `찐맛집 코스`,
        badge: "찐맛집",
    },
    // 4. 가성비 (#가성비, #저렴한)
    cost: {
        sectionTitle: "",
        title: () => `가성비 코스`,
        badge: "가성비 甲",
    },
    // 5. 액티비티 (#활동적인)
    activity: {
        sectionTitle: "",
        title: () => `액티비티 코스`,
        badge: "도파민 뿜뿜",
    },
    // 기본값 (태그 없을 때)
    default: {
        sectionTitle: "",
        title: () => `취향 저격 코스`,
        badge: "AI 맞춤",
    },
    // 비로그인
    guest: {
        sectionTitle: "",
        title: (_name: string) => "지금 가장 많이 선택된 데이트 코스",
        badge: "인기",
    },
};
