/**
 * 지역 페이지(/regions/[region]) 소개 문구. regions 테이블에 설명 컬럼이 없어 코드에 둠.
 * ponytail: 지역이 자주 늘면 regions 테이블에 description 컬럼으로 옮기기
 */
const REGION_INTROS: Record<string, string> = {
    성수: "수제화 공방과 붉은 벽돌 공장을 고친 카페·팝업스토어가 모인 동네예요. 서울숲이 가까워 산책과 카페 투어를 함께 하기 좋아요.",
    연남: "경의선숲길을 따라 작은 카페와 맛집이 이어지는 동네예요. 걷다가 마음에 드는 가게에 들르기 좋아요.",
    홍대: "거리 공연과 소품숍, 늦게까지 여는 가게가 많은 젊은 상권이에요. 저녁 데이트까지 이어가기 좋아요.",
    종로: "궁궐과 오래된 골목, 노포가 함께 있는 서울의 중심이에요. 역사 산책과 맛집 탐방을 같이 할 수 있어요.",
    을지로: "인쇄소와 공구상 골목 사이에 숨은 바와 카페가 생긴 동네예요. 오래된 가게와 새 가게를 함께 즐기기 좋아요.",
    강남: "큰 상권에 맛집과 문화 공간이 모여 있어요. 교통이 좋아 약속 잡기 편해요.",
    용산: "박물관과 공원, 새로 생긴 맛집 골목이 함께 있는 동네예요. 전시와 식사를 묶어 다니기 좋아요.",
    이태원: "세계 여러 나라 음식점과 바가 모인 이국적인 동네예요. 색다른 저녁 데이트에 잘 어울려요.",
    잠실: "석촌호수와 대형 쇼핑몰이 가까워 산책과 실내 데이트를 함께 하기 좋아요.",
    여의도: "한강공원과 대형 쇼핑몰이 있어 피크닉과 실내 데이트를 날씨에 맞춰 고를 수 있어요.",
    영등포: "대형 쇼핑몰과 오래된 골목이 가까이 있어 쇼핑과 골목 탐방을 같이 즐기기 좋아요.",
    한남: "편집숍과 갤러리, 레스토랑이 모인 감각적인 동네예요.",
    서촌: "경복궁 서쪽 한옥 골목에 작은 갤러리와 카페가 있는 조용한 동네예요.",
    안국: "궁궐 사이 한옥 골목에 카페와 공방이 모여 있어요. 천천히 걷는 데이트에 잘 맞아요.",
    합정: "한강과 가까운 카페 거리와 서점, 맛집이 있는 동네예요.",
    건대: "복합 문화 공간과 맛집 골목이 있는 활기찬 대학가 상권이에요.",
    신촌: "대학가 특유의 활기와 오래된 맛집이 함께 있는 동네예요.",
    부천: "서울과 가까워 가볍게 다녀오기 좋은 데이트 지역이에요.",
    망원: "망원시장과 한강공원이 가까워 시장 먹거리와 강변 산책을 함께 즐기기 좋아요.",
    익선: "한옥 골목에 카페와 레스토랑이 모여 있어 골목 구경하며 걷기 좋아요.",
    신사: "가로수길을 중심으로 카페와 브랜드 매장이 모인 동네예요.",
    압구정: "로데오거리를 중심으로 레스토랑과 카페가 모여 있어요.",
    문래: "철공소 골목 사이에 예술 공방과 카페가 들어선 동네예요. 독특한 골목 풍경이 매력이에요.",
    북촌: "한옥마을 골목을 따라 걸으며 전통 풍경과 카페를 함께 즐길 수 있어요.",
    연희: "조용한 주택가에 개성 있는 카페와 빵집이 자리한 동네예요.",
    동묘: "구제 시장과 오래된 골목 풍경으로 알려진 동네예요. 구경하는 재미가 있어요.",
    광명: "광명동굴과 대형 쇼핑몰이 모여 있는 서울 근교 지역이에요. 가까운 나들이 데이트로 좋아요.",
    천호: "서울 동쪽의 큰 상권으로 맛집과 쇼핑 공간이 모여 있어요.",
    덕수궁: "덕수궁 돌담길과 정동길을 따라 걷기 좋은 곳이에요.",
    해방촌: "남산 아래 언덕 동네로 루프탑과 이국적인 가게가 있어요.",
};

/** 화면·제목에 보일 동네 이름 (URL·DB는 regions.name 그대로) */
const AREA_DISPLAY: Record<string, string> = { 익선: "익선동" };
export const areaLabel = (area: string) => AREA_DISPLAY[area] ?? area;

/** 지역 소개 2~3줄: 손으로 쓴 소개 + 코스 수 */
export function regionIntro(region: string, courseCount: number): string[] {
    const label = areaLabel(region);
    return [
        REGION_INTROS[region] ?? `${label}에서 즐기기 좋은 데이트 코스를 모았어요.`,
        `두나에는 ${label} 데이트 코스가 ${courseCount}개 있어요. 코스를 누르면 장소 순서와 동선을 볼 수 있어요.`,
    ];
}

/** 코스 region 문자열("북촌/안국" 등)이 이 지역에 해당하는지 */
export function courseInRegion(courseRegion: string | null | undefined, region: string): boolean {
    if (!courseRegion) return false;
    return courseRegion
        .split(/[\/,·]/)
        .map((s) => s.trim())
        .includes(region);
}

/** 동네 페이지 주소 */
export const areaPath = (area: string) => `/area/${encodeURIComponent(area)}`;

/** 코스 region 문자열("북촌/안국")을 제목용으로: "북촌·안국" */
export const regionLabel = (courseRegion: string) =>
    courseRegion
        .split(/[\/,·]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map(areaLabel)
        .join("·");

/** 코스 region 문자열에 들어 있는 동네 중 regions 테이블에 있는 것들 */
export function areasOf(courseRegion: string | null | undefined, areaNames: string[]): string[] {
    return areaNames.filter((name) => courseInRegion(courseRegion, name));
}

/** 공개 코스가 있는 동네를 코스 많은 순으로: [{ name, count }] */
export function areasByCourseCount(areaNames: string[], courseRegions: (string | null)[]) {
    return areaNames
        .map((name) => ({ name, count: courseRegions.filter((r) => courseInRegion(r, name)).length }))
        .filter((a) => a.count > 0)
        .sort((a, b) => b.count - a.count);
}

/** 두 좌표 사이 거리(m) */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const rad = Math.PI / 180;
    const a =
        Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
        Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
    return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

/** 장소 설명에서 첫 문장만 (검색 결과 설명용): 끝 마침표 빼고, 길면 단어 단위로 잘라 "…" */
export function firstSentence(text: string | null | undefined, max = 40): string {
    const s = ((text ?? "").trim().split(/(?<=[.!?。])\s|\n/)[0] ?? "").trim().replace(/[.。]+$/, "");
    if (s.length <= max) return s;
    // max+1까지 보고 마지막 공백에서 자름 → 단어 중간에서 안 잘림
    const cut = s.slice(0, max + 1).replace(/\s+\S*$/, "").replace(/[\s,.]+$/, "");
    return `${cut || s.slice(0, max)}…`;
}
