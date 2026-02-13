// src/constants/recommendations.ts

export type UserTagType = "healing" | "photo" | "food" | "cost" | "activity" | "default" | "guest";

export const RECOMMENDATION_MESSAGES = {
    // 1. 조용한/힐링 (#조용한, #힐링)
    healing: {
        sectionTitle: "오늘의 추천",
        title: (name: string) => `${name}님을 위한 힐링 코스`,
        subtitle: "시끄러운 데이트는 여기선 없습니다. 대화가 편해지는 코스예요",
        badge: "조용한 힐링",
    },
    // 2. 인스타/사진 (#사진, #인생샷)
    photo: {
        sectionTitle: "오늘의 추천",
        title: (name: string) => `${name}님을 위한 포토존 코스`,
        subtitle: "여기서 찍으면 실패 확률 거의 없습니다. 포토존 위치가 핵심이에요",
        badge: "인생샷 보장",
    },
    // 3. 맛집/먹방 (#맛집, #먹방)
    food: {
        sectionTitle: "오늘의 추천",
        title: (name: string) => `${name}님을 위한 찐맛집 코스`,
        subtitle: "실패 없는 선택만 모았습니다. 여기선 메뉴 선택이 중요해요",
        badge: "찐맛집",
    },
    // 4. 가성비 (#가성비, #저렴한)
    cost: {
        sectionTitle: "오늘의 추천",
        title: (name: string) => `${name}님을 위한 가성비 코스`,
        subtitle: "지갑은 가볍게, 추억은 무겁게. 3만원대로 즐기는 풀코스예요",
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
        title: (_name: string) => "지금 가장 많이 선택된 데이트 코스",
        subtitle: "로그인하면 당신에게 더 잘 맞는 코스를 바로 추천해드려요",
        badge: "인기",
    },
};
