// types/tag.ts

/**
 * ------------------------------------------------------------------
 * 🏷️ DoNa Course Tags Schema
 * * Prisma의 'tags' JSON 컬럼에 들어갈 데이터 구조입니다.
 * * 요청하신 순서: Concept -> Mood -> Target -> Budget
 * ------------------------------------------------------------------
 */

// 1. Concept (컨셉) - 10개 통합 + 조건/상황
export type ConceptTag =
    // 10개 통합 컨셉
    | "이색데이트"
    | "감성데이트"
    | "야경"
    | "힐링"
    | "가성비"
    | "인생샷"
    | "맛집탐방"
    | "카페투어"
    | "술자리"
    | "실내데이트"
    | "공연·전시"
    // 조건/상황
    | "실내"
    | "야외"
    | "기념일"
    | "소개팅";

// 2. Mood (무드) - 트렌디한→힙한, 편안한→조용한 흡수 / 신비로운·전통적인 제거
export type MoodTag =
    | "로맨틱"
    | "힙한"
    | "활기찬"
    | "레트로"
    | "고급스러운"
    | "감성"
    | "조용한"
    | "이국적인";

// 3. Target (타겟)
export type TargetTag = "연인" | "썸" | "친구" | "가족" | "혼자";

// 4. Budget (예산)
// 1인당 예상 비용입니다. (필수, 단일 선택 권장)
export type BudgetTag =
    | "3만원 이하" // 가성비
    | "3~6만원" // 국룰
    | "6~10만원" // 분위기
    | "10~20만원" // 스페셜
    | "20만원 이상"; // 플렉스

/**
 * ✅ 최종 DB 저장용 인터페이스
 * 순서: Concept -> Mood -> Target -> Budget
 */
export interface DoNaCourseTags {
    concept: ConceptTag[]; // 예: ["실내", "카페", "힐링"]
    mood: MoodTag[]; // 예: ["감성", "조용한"]
    target: TargetTag[]; // 예: ["연인"] (사람만)
    budget: BudgetTag; // 예: "3~6만원"
}
