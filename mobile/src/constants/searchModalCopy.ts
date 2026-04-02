/** CDN + 테마 id (라벨은 `search.*` i18n 키로 조회) */

export const CDN_CONCEPT_ICONS = "https://d13xx6k6chk2in.cloudfront.net/concept-Icon";

export type SearchThemeTagId = "COST_EFFECTIVE" | "EMOTIONAL" | "PHOTO" | "HEALING";

const TAG_LABEL_KEY: Record<SearchThemeTagId, string> = {
    COST_EFFECTIVE: "search.tagCostEffective",
    EMOTIONAL: "search.tagEmotional",
    PHOTO: "search.tagPhoto",
    HEALING: "search.tagHealing",
};

export const SEARCH_THEME_TAGS: { id: SearchThemeTagId; iconFile: string; labelKey: string }[] = [
    { id: "COST_EFFECTIVE", iconFile: "COST_EFFECTIVE.png", labelKey: TAG_LABEL_KEY.COST_EFFECTIVE },
    { id: "EMOTIONAL", iconFile: "EMOTIONAL.png", labelKey: TAG_LABEL_KEY.EMOTIONAL },
    { id: "PHOTO", iconFile: "PHOTO.png", labelKey: TAG_LABEL_KEY.PHOTO },
    { id: "HEALING", iconFile: "HEALING.png", labelKey: TAG_LABEL_KEY.HEALING },
];

export const POPULAR_KEYWORD_COUNT = 5;
