// ------------------------------------------------------
// 1. DB 태그와 100% 일치하는 상수 (Single Source of Truth)
// ------------------------------------------------------

// ✅ CloudFront를 통한 개념 아이콘 URL 생성
import { getS3StaticUrl } from "@/lib/s3Static";

export const CONCEPTS = {
    COST_EFFECTIVE: "가성비",
    EMOTIONAL: "감성데이트",
    ALLEY: "골목투어",
    EXHIBITION: "공연·전시",
    FOOD_TOUR: "맛집탐방",
    ART: "문화예술",
    SHOPPING: "쇼핑",
    DRINKING: "술자리",
    INDOOR: "실내데이트",
    NIGHT_VIEW: "야경",
    UNIQUE: "이색데이트",
    PHOTO: "인생샷",
    TRADITION: "전통문화",
    ETC: "기타",
    EXPERIENCE: "체험",
    CAFE: "카페투어",
    THEME_PARK: "테마파크",
    HOT_PLACE: "핫플레이스",
    HEALING: "힐링",
    HIPSTER: "힙스터",
} as const;

export const MOODS = {
    QUIET: "조용한",
    EMOTIONAL: "감성적",
    TRENDY: "트렌디한",
    LIVELY: "활기찬",
    PREMIUM: "프리미엄",
    VINTAGE: "빈티지",
    NEAT: "깔끔한",
    UNIQUE: "이색적인",
} as const;

// ------------------------------------------------------
// [핵심] 지역 그룹화 데이터 (UI Label -> DB Values 매핑)
// ------------------------------------------------------
export const REGION_GROUPS = [
    {
        id: "SEONGSU",
        label: "성수 · 건대",
        dbValues: ["성수", "건대", "뚝섬", "서울숲"],
    },
    {
        id: "HONGDAE",
        label: "홍대 · 연남 · 신촌",
        dbValues: ["홍대", "연남", "신촌", "망원", "합정", "상수"],
    },
    {
        id: "JONGNO",
        label: "종로 · 북촌 · 서촌",
        dbValues: ["종로", "북촌", "서촌", "인사", "안국", "혜화", "대학로", "익선", "광화문"],
    },
    {
        id: "EULJIRO",
        label: "을지로 (힙지로)",
        dbValues: ["을지로", "충무로", "명동", "종로3가"],
    },
    {
        id: "GANGNAM",
        label: "강남 · 압구정 · 신사",
        // ✅ 수정: "반포/서초" 처럼 묶인 걸 "반포", "서초"로 분리해야 함!
        dbValues: [
            "강남",
            "압구정",
            "신사",
            "가로수길",
            "논현",
            "청담",
            "반포",
            "서초",
            "역삼",
            "도곡",
            "양재",
            "잠원",
        ],
    },
    {
        id: "YONGSAN",
        label: "한남 · 이태원 · 용산",
        dbValues: ["용산", "이태원", "한남", "해방촌", "경리단", "삼각지", "신용산"],
    },
    {
        id: "JAMSIL",
        label: "잠실 · 송파",
        dbValues: ["잠실", "송파", "석촌", "방이", "문정"],
    },
    {
        id: "YEOUIDO",
        label: "여의도 · 영등포",
        dbValues: ["여의도", "영등포", "문래", "더현대"],
    },
] as const;
// ------------------------------------------------------
// 2. UI 표시용 데이터 (이미지 - 태그 매핑 로직)
// ------------------------------------------------------

export const VIBE_OPTIONS = [
    {
        id: "healing",
        // [교체] 따뜻한 우드톤 카페 & 햇살 느낌
        img: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=800&auto=format&fit=crop",
        title: "따스한 햇살 & 커피",
        concepts: [CONCEPTS.HEALING, CONCEPTS.CAFE, CONCEPTS.EMOTIONAL],
        moods: [MOODS.QUIET, MOODS.EMOTIONAL],
        desc: "여유로운 힐링",
    },
    {
        id: "hipster",
        // [교체] 을지로/이태원 감성의 네온사인 펍 (깨진 이미지 수정됨)
        img: "https://images.unsplash.com/photo-1566737236500-c8ac43014a67?q=80&w=800&auto=format&fit=crop",
        title: "힙한 네온사인 & 에너지",
        concepts: [CONCEPTS.HIPSTER, CONCEPTS.HOT_PLACE, CONCEPTS.DRINKING],
        moods: [MOODS.TRENDY, MOODS.LIVELY],
        desc: "트렌드 세터",
    },
    {
        id: "romantic",
        // [교체] 고급스러운 레스토랑 & 와인 (기존 칵테일보다 좀 더 차분하게)
        img: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?q=80&w=800&auto=format&fit=crop",
        title: "은은한 조명 & 와인",
        concepts: [CONCEPTS.FOOD_TOUR, CONCEPTS.NIGHT_VIEW, CONCEPTS.UNIQUE],
        moods: [MOODS.PREMIUM, MOODS.VINTAGE],
        desc: "로맨틱 무드",
    },
    {
        id: "activity",
        // [교체] 서울 도심 속 공원/산책로 느낌 (야자수 삭제됨)
        img: "https://images.unsplash.com/photo-1538485399081-7191377e8241?q=80&w=800&auto=format&fit=crop",
        title: "탁 트인 야외 & 산책",
        concepts: [CONCEPTS.EXPERIENCE, CONCEPTS.THEME_PARK, CONCEPTS.PHOTO],
        moods: [MOODS.NEAT, MOODS.UNIQUE],
        desc: "자연과 낭만",
    },
];

export const VALUE_OPTIONS = [
    {
        id: "visual",
        icon: "✨",
        title: "맛은 평범해도\n분위기&뷰가 깡패",
        addMood: MOODS.EMOTIONAL,
        addConcept: CONCEPTS.PHOTO,
        typeLabel: "분위기파",
    },
    {
        id: "taste",
        icon: "🥘",
        title: "다 쓰러져가도\n맛이 기가 막힌 곳",
        addMood: MOODS.VINTAGE,
        addConcept: CONCEPTS.FOOD_TOUR,
        typeLabel: "실속파",
    },
];

export const CREW_OPTIONS = [
    { value: "연인", label: "💖 연인", sub: "사랑받는 센스쟁이" },
    { value: "친구", label: "😎 친구", sub: "수다 떨기 좋은 인싸" },
    { value: "혼자", label: "🧘 혼자", sub: "프로 독학러" },
    { value: "소개팅", label: "👋 소개팅", sub: "설레는 첫 만남" },
];

// ... (위쪽 기존 코드들: REGION_GROUPS, VIBE_OPTIONS 등은 그대로 둠) ...

// ------------------------------------------------------
// 3. 아이콘 매핑 (S3 이미지 연결) - 수정됨
// ------------------------------------------------------

const S3_BASE_URL = getS3StaticUrl("concept-Icon");

export const CATEGORY_ICONS: Record<string, string> = {
    // 파일명이 한글이 아니라, 영어 Key값(예: EMOTIONAL.png)으로 되어 있으므로 맞춰줍니다.
    [CONCEPTS.COST_EFFECTIVE]: `${S3_BASE_URL}/COST_EFFECTIVE.png`,
    [CONCEPTS.EMOTIONAL]: `${S3_BASE_URL}/EMOTIONAL.png`,
    [CONCEPTS.ALLEY]: `${S3_BASE_URL}/ALLEY.png`,
    [CONCEPTS.EXHIBITION]: `${S3_BASE_URL}/EXHIBITION.png`,
    [CONCEPTS.FOOD_TOUR]: `${S3_BASE_URL}/FOOD_TOUR.png`,
    [CONCEPTS.ART]: `${S3_BASE_URL}/ART.png`,
    [CONCEPTS.SHOPPING]: `${S3_BASE_URL}/SHOPPING.png`,
    [CONCEPTS.DRINKING]: `${S3_BASE_URL}/DRINKING.png`,
    [CONCEPTS.INDOOR]: `${S3_BASE_URL}/INDOOR.png`,
    [CONCEPTS.NIGHT_VIEW]: `${S3_BASE_URL}/NIGHT_VIEW.png`,
    [CONCEPTS.UNIQUE]: `${S3_BASE_URL}/UNIQUE.png`,
    [CONCEPTS.PHOTO]: `${S3_BASE_URL}/PHOTO.png`,
    [CONCEPTS.TRADITION]: `${S3_BASE_URL}/TRADITION.png`,
    [CONCEPTS.ETC]: `${S3_BASE_URL}/ETC.png`,
    [CONCEPTS.EXPERIENCE]: `${S3_BASE_URL}/EXPERIENCE.png`,
    [CONCEPTS.CAFE]: `${S3_BASE_URL}/CAFE.png`,
    [CONCEPTS.THEME_PARK]: `${S3_BASE_URL}/THEME_PARK.png`,
    [CONCEPTS.HOT_PLACE]: `${S3_BASE_URL}/HOT_PLACE.png`,
    [CONCEPTS.HEALING]: `${S3_BASE_URL}/HEALING.png`,
    [CONCEPTS.HIPSTER]: `${S3_BASE_URL}/HIPSTER.png`,
};
