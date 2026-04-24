/**
 * Draft 장소들 주소/카테고리/설명 재생성 스크립트
 * 이름은 절대 건드리지 않음
 * 실행: node scripts/reautofill-draft-places.mjs
 */

import { PrismaClient } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";
import * as dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const NAVER_ID = process.env.NAVER_SEARCH_CLIENT_ID;
const NAVER_SECRET = process.env.NAVER_SEARCH_CLIENT_SECRET;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

// [이름, 동네, 카테고리]
const TARGET_NAMES = [
    ["레브두", "잠실", "카페"],
    ["고도식", "잠실", "음식점"],
    ["청계 도깨비", "혜화", "음식점"],
    ["캑치 가차", "종각", "이색데이트"],
    ["너구리 소굴", "종각", "주점"],
    ["안암", "북촌", "음식점"],
    ["베스킨라빈스", "종로", "카페"],
    ["테라로사 국립현대미술관서울점", "삼청", "카페"],
    ["오설록티하우스 북촌점", "삼청", "카페"],
    ["서울시립미술관", "덕수궁", "실내명소"],
    ["BBM 야구장", "잠실", "야외명소"],
    ["자루야키용산로", "신용산", "음식점"],
    ["코우민칸", "신용산", "주점"],
    ["오치교반", "종로", "음식점"],
    ["데이비", "인사동", "쇼핑"],
    ["카페레이어드 안국점", "안국", "카페"],
    ["룻 안국", "안국", "음식점"],
    ["낭만 종각점", "종로", "주점"],
    ["통인시장", "서촌", "시장"],
    ["소브티하우스", "성수", "소품샵"],
    ["미뇽맨션", "성수", "소품샵"],
    ["르브리에", "송파", "카페"],
    ["스탠다드브레드", "성수", "카페"],
    ["잊힐리야", "문래", "주점"],
    ["저녁한잔", "화곡", "주점"],
    ["맛거리", "화곡", "주점"],
    ["마젠타", "강서", "카페"],
    ["타치가와텐", "마곡", "음식점"],
    ["오호리준", "마곡", "주점"],
    ["정밀제빵", "문래", "카페"],
    ["베르데 문래", "문래", "음식점"],
    ["공중제비", "망원", "주점"],
    ["아우라픽 망원점", "망원", "사진관"],
    ["멘야산다이메 홍대점", "홍대", "음식점"],
    ["퐁포네뜨", "홍대", "카페"],
    ["올라이트", "서촌", "소품샵"],
    ["오레노라멘 합정본점", "합정", "음식점"],
    ["비터솔트", "송파", "카페"],
    ["입분식 가정집", "송파", "음식점"],
    ["토나리우동", "송파", "음식점"],
];

function isNameMatch(input, result) {
    const norm = (s) => s.replace(/\s/g, "").toLowerCase();
    const a = norm(input);
    const b = norm(result);
    return a.includes(b) || b.includes(a);
}

const SEOUL_X = "126.9784";
const SEOUL_Y = "37.5665";
const SEOUL_RADIUS = 20000;

async function kakaoSearch(name) {
    if (!KAKAO_KEY) return null;
    try {
        const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(name)}&x=${SEOUL_X}&y=${SEOUL_Y}&radius=${SEOUL_RADIUS}&sort=distance&size=5`;
        const res = await fetch(url, { headers: { Authorization: "KakaoAK " + KAKAO_KEY } });
        const data = await res.json();
        const seoulResult = data.documents?.find(d =>
            (d.road_address_name || d.address_name || "").startsWith("서울")
        );
        return seoulResult ?? null;
    } catch { return null; }
}

async function naverSearch(name) {
    if (!NAVER_ID || !NAVER_SECRET) return null;
    try {
        const res = await fetch(
            "https://openapi.naver.com/v1/search/local.json?query=" + encodeURIComponent(name + " 서울") + "&display=3",
            { headers: { "X-Naver-Client-Id": NAVER_ID, "X-Naver-Client-Secret": NAVER_SECRET } }
        );
        const data = await res.json();
        const seoulResult = data.items?.find(d =>
            (d.roadAddress || d.address || "").startsWith("서울")
        );
        return seoulResult ?? null;
    } catch { return null; }
}

async function generateAiData(name, address, category, naverDescription) {
    if (!ANTHROPIC_KEY) return {};
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });
    const prompt = [
        "당신은 20-30대 커플 데이트 앱 'DoNa'의 장소 큐레이터입니다.",
        "",
        "장소명: " + name,
        "주소(한국어): " + (address || "정보 없음"),
        "카테고리: " + (category || "정보 없음"),
        ...(naverDescription ? ["네이버 장소 정보: " + naverDescription, ""] : []),
        "",
        "다음 JSON 형식으로만 응답하세요 (다른 텍스트 없이):",
        "{",
        '  "name_en": "장소명 영어 번역 (한국어 고유명사는 로마자 발음 그대로)",',
        '  "name_ja": "장소명 일본어 번역 (한국어 고유명사는 가타카나 음역)",',
        '  "name_zh": "장소명 중국어 번역 (한국어 고유명사는 한자 음역 또는 병음)",',
        '  "description": "커플 데이트 관점에서 이 장소의 매력을 1문장으로. 카테고리에 맞게: 카페면 분위기/음료, 음식점이면 메뉴/공간, 주점이면 분위기/안주, 소품샵이면 구경하는 재미, 명소면 볼거리/동선 중심으로.",',
        '  "description_en": "Same concept, 1 sentence in English for couples",',
        '  "description_ja": "同じコンセプト、カップル向けに日本語で1文",',
        '  "description_zh": "相同概念，面向情侣用中文写一句话",',
        '  "address_en": "주어진 한국어 주소를 영문으로 변환",',
        '  "address_ja": "주어진 한국어 주소를 일본어로 번역",',
        '  "address_zh": "주어진 한국어 주소를 중국어로 번역",',
        '  "avg_cost_range": "1인 기준 최소~최대 가격대 (예: 10,000 - 20,000). 카테고리 기반 추정",',
        '  "reservation_required": false',
        "}",
        "",
        "reservation_required는 파인다이닝/오마카세/고급 레스토랑이면 true, 아니면 false",
    ].join("\n");

    try {
        const message = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 2000,
            messages: [{ role: "user", content: prompt }],
        });
        const text = message.content[0].type === "text" ? message.content[0].text : "";
        const match = text.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
    } catch (e) {
        console.error("  Claude 실패:", e.message);
    }
    return {};
}

async function processPlace(name, neighborhood, forcedCategory) {
    const searchQuery = neighborhood ? `${name} ${neighborhood}` : name;

    // DB에서 이름으로 찾기
    const place = await prisma.place.findFirst({
        where: { name: { contains: name.replace(/\s+/g, ""), mode: "insensitive" } },
        orderBy: [{ status: "asc" }, { id: "desc" }],
    }) ?? await prisma.place.findFirst({
        where: { name: { contains: name.split(" ")[0], mode: "insensitive" } },
        orderBy: [{ status: "asc" }, { id: "desc" }],
    });

    if (!place) {
        console.log(`  ❌ DB에서 못 찾음: "${name}"`);
        return;
    }

    console.log(`  📍 찾음: "${place.name}" (ID: ${place.id}, status: ${place.status})`);

    const [kakao, naver] = await Promise.all([kakaoSearch(searchQuery), naverSearch(searchQuery)]);
    const kakaoName = kakao?.place_name || "";
    const naverName = naver?.title?.replace(/<[^>]+>/g, "") || "";

    const firstName = name.split(" ")[0];
    const kakaoMatches = kakaoName ? (isNameMatch(name, kakaoName) || isNameMatch(firstName, kakaoName)) : false;
    const naverMatches = naverName ? (isNameMatch(name, naverName) || isNameMatch(firstName, naverName)) : false;

    const address = kakaoMatches
        ? kakao?.road_address_name || kakao?.address_name || place.address || ""
        : naverMatches
          ? naver?.roadAddress || naver?.address || place.address || ""
          : place.address || "";

    const latitude = kakaoMatches && kakao?.y ? parseFloat(parseFloat(kakao.y).toFixed(6)) : place.latitude ? Number(place.latitude) : null;
    const longitude = kakaoMatches && kakao?.x ? parseFloat(parseFloat(kakao.x).toFixed(6)) : place.longitude ? Number(place.longitude) : null;
    const phone = (kakaoMatches || naverMatches) ? (naver?.telephone || kakao?.phone || place.phone || "") : (place.phone || "");

    if (!kakaoMatches && !naverMatches) {
        console.log(`  ⚠️  카카오/네이버 매칭 안됨 → 주소 유지, 설명만 재생성`);
    } else {
        console.log(`  ✅ 주소: ${address}`);
    }

    const naverDescription = naverMatches
        ? naver?.description?.replace(/<[^>]+>/g, "").trim() || ""
        : "";
    if (naverDescription) console.log(`  📝 네이버 설명: ${naverDescription}`);

    // AI 설명/번역 재생성 — 강제 카테고리 사용
    const ai = await generateAiData(name, address, forcedCategory, naverDescription);

    await prisma.place.update({
        where: { id: place.id },
        data: {
            address: address || place.address,
            address_en: ai.address_en || place.address_en,
            address_ja: ai.address_ja || place.address_ja,
            address_zh: ai.address_zh || place.address_zh,
            name_en: ai.name_en || place.name_en,
            name_ja: ai.name_ja || place.name_ja,
            name_zh: ai.name_zh || place.name_zh,
            description: ai.description || place.description,
            description_en: ai.description_en || place.description_en,
            description_ja: ai.description_ja || place.description_ja,
            description_zh: ai.description_zh || place.description_zh,
            category: forcedCategory,
            avg_cost_range: ai.avg_cost_range || place.avg_cost_range,
            reservation_required: ai.reservation_required !== undefined ? ai.reservation_required : place.reservation_required,
            phone: phone || place.phone,
            ...(latitude !== null ? { latitude } : {}),
            ...(longitude !== null ? { longitude } : {}),
        },
    });

    console.log(`  ✅ 업데이트 완료 (카테고리: ${forcedCategory})\n`);
}

async function main() {
    console.log(`\n총 ${TARGET_NAMES.length}개 장소 재처리 시작\n`);
    for (const [name, neighborhood, category] of TARGET_NAMES) {
        console.log(`처리 중: "${name}" (${neighborhood}) → ${category}`);
        try {
            await processPlace(name, neighborhood, category);
        } catch (e) {
            console.error(`  ❌ 오류: ${e.message}\n`);
        }
        await new Promise(r => setTimeout(r, 1000));
    }
    console.log("모두 완료!");
    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
