// src/constants/recommendations.ts

export type UserTagType = "healing" | "photo" | "food" | "cost" | "activity" | "default" | "guest";

export const RECOMMENDATION_MESSAGES = {
    // 1. 조용한/힐링 (#조용한, #힐링)
    healing: {
        sectionTitle: "오늘의 추천",
        title: (name: string) => `${name}님을 위한 힐링 코스`,
        subtitle: "기 빨리는 핫플 대신, 마음이 차분해지는 곳들을 골랐어요.",
        badge: "조용한 힐링",
    },
    // 2. 인스타/사진 (#사진, #인생샷)
    photo: {
        sectionTitle: "오늘의 추천",
        title: (name: string) => `${name}님을 위한 포토존 코스`,
        subtitle: "셔터만 누르면 화보가 되는 인생샷 포인트예요.",
        badge: "인생샷 보장",
    },
    // 3. 맛집/먹방 (#맛집, #먹방)
    food: {
        sectionTitle: "오늘의 추천",
        title: (name: string) => `${name}님을 위한 찐맛집 코스`,
        subtitle: "웨이팅할 가치가 충분한 맛집만 골랐어요.",
        badge: "찐맛집",
    },
    // 4. 가성비 (#가성비, #저렴한)
    cost: {
        sectionTitle: "오늘의 추천",
        title: (name: string) => `${name}님을 위한 가성비 코스`,
        subtitle: "지갑은 가볍게, 추억은 무겁게. 3만원대로 즐기는 풀코스예요.",
        badge: "가성비 甲",
    },
    // 5. 액티비티 (#활동적인)
    activity: {
        sectionTitle: "오늘의 추천",
        title: (name: string) => `${name}님을 위한 액티비티 코스`,
        subtitle: "도파민 터지는 이색 체험 코스 어때요?",
        badge: "도파민 뿜뿜",
    },
    // 기본값 (태그 없을 때)
    default: {
        sectionTitle: "오늘의 추천",
        title: (name: string) => `${name}님을 위한 취향 저격 코스`,
        subtitle: "당신이 좋아할 만한 숨은 보석 같은 곳들을 찾아봤어요.",
        badge: "AI 맞춤",
    },
    // 비로그인
    guest: {
        sectionTitle: "오늘의 인기 코스",
        title: (_name: string) => "당신의 취향을 알고 싶어요",
        subtitle: "로그인하면 AI가 딱 맞는 코스만 골라드릴게요.",
        badge: "인기",
    },
};
