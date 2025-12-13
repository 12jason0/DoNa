// src/constants/recommendations.ts

export type UserTagType = "healing" | "photo" | "food" | "cost" | "activity" | "default" | "guest";

export const RECOMMENDATION_MESSAGES = {
    // 1. 조용한/힐링 (#조용한, #힐링)
    healing: {
        title: (name: string) => `${name}님, 기 빨리는 핫플은 지치시죠? 🌿`,
        subtitle: "마음이 차분해지는 힐링 코스를 준비했어요.",
        badge: "🌿 조용한 힐링",
    },
    // 2. 인스타/사진 (#사진, #인생샷)
    photo: {
        title: (name: string) => `남는 건 사진뿐인 ${name}님! 📸`,
        subtitle: "셔터만 누르면 화보가 되는 포토존 코스예요.",
        badge: "📸 인생샷 보장",
    },
    // 3. 맛집/먹방 (#맛집, #먹방)
    food: {
        title: (name: string) => `${name}님, 데이트도 식후경이죠! 🍽️`,
        subtitle: "웨이팅할 가치가 충분한 찐맛집 코스입니다.",
        badge: "🍽️ 찐맛집",
    },
    // 4. 가성비 (#가성비, #저렴한)
    cost: {
        title: (name: string) => `지갑은 가볍게, 추억은 무겁게! 💸`,
        subtitle: "3만원으로 즐기는 알뜰살뜰 풀코스예요.",
        badge: "💸 가성비 甲",
    },
    // 5. 액티비티 (#활동적인)
    activity: {
        title: (name: string) => `가만히 앉아있는 건 노잼! ${name}님 🏃`,
        subtitle: "도파민 터지는 이색 체험 코스 어때요?",
        badge: "🏃 도파민 뿜뿜",
    },
    // 기본값 (태그 없을 때)
    default: {
        title: (name: string) => `${name}님의 취향을 저격할, 숨겨진 보석 같은 곳들`,
        subtitle: "당신이 좋아할 만한 분위기를 찾아냈어요.",
        badge: "✨ AI 맞춤 추천",
    },
    // 비로그인 (추가됨)
    guest: {
        title: (_name: string) => `로그인하면 더 완벽한 취향 저격!`,
        subtitle: "지금은 인기 코스를 보여드려요. AI에게 내 취향을 알려주세요.",
        badge: "🔥 인기 코스",
    },
};
