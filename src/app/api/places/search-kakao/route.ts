import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------
// 1. 유틸리티 함수 (좌표 변환 및 거리 계산)
// ---------------------------------------------------------
function toRad(v: number) {
    return (v * Math.PI) / 180;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371000; // meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// ---------------------------------------------------------
// 2. 지역 매핑 테이블 (사용자 입력 -> DB region)
// ---------------------------------------------------------
const REGION_MAPPING: Record<string, string> = {
    // 1. 홍대/연남
    마포: "홍대/연남",
    마포구: "홍대/연남",
    홍대: "홍대/연남",
    연남: "홍대/연남",
    연남동: "홍대/연남",
    서교동: "홍대/연남",
    합정: "홍대/연남",
    망원: "홍대/연남",

    // 2. 성수
    성수: "성수",
    성수동: "성수",
    성동구: "성수",
    뚝섬: "성수",
    서울숲: "성수",

    // 3. 종로/북촌
    종로: "종로/북촌",
    종로구: "종로/북촌",
    북촌: "종로/북촌",
    삼청동: "종로/북촌",
    익선동: "종로/북촌",
    서촌: "종로/북촌",
    인사동: "종로/북촌",
    광화문: "종로/북촌",

    // 4. 을지로
    을지로: "을지로",
    을지로3가: "을지로",
    을지로4가: "을지로",
    중구: "을지로",
    명동: "을지로",
    충무로: "을지로",
    힙지로: "을지로",

    // 5. 용산
    용산: "용산",
    용산구: "용산",
    이태원: "용산",
    한남: "용산",
    한남동: "용산",
    해방촌: "용산",
    경리단길: "용산",
    신용산: "용산",
};

// ---------------------------------------------------------
// 3. 카카오 API 호출 함수
// ---------------------------------------------------------
async function kakaoLocalSearch(query: string, lat?: number, lng?: number, radius?: number) {
    const apiKey = process.env.KAKAO_REST_API_KEY;
    if (!apiKey) throw new Error("서버 설정 오류: KAKAO_REST_API_KEY 누락");

    // 카카오 로컬 검색 API URL
    // query: 검색어
    // x: 경도(lng), y: 위도(lat) - 거리순 정렬이나 반경 검색 시 필요
    // radius: 반경(미터), sort: distance(거리순) 또는 accuracy(정확도순)
    let url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`;

    if (lat && lng) {
        url += `&y=${lat}&x=${lng}`;
        if (radius) {
            url += `&radius=${radius}&sort=distance`;
        } else {
            // 좌표는 있지만 반경이 없으면 정확도순이 기본이나, 가까운 곳 위주로 보려면 distance 추천
            // 여기서는 기본적으로 정확도순 유지하되 좌표 힌트 제공
        }
    }

    const res = await fetch(url, {
        headers: { Authorization: `KakaoAK ${apiKey}` },
        cache: "no-store",
    });

    if (!res.ok) throw new Error(`카카오 로컬 검색 실패: ${res.status}`);
    return await res.json();
}

// ---------------------------------------------------------
// 3. 메인 핸들러
// ---------------------------------------------------------
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const latStr = searchParams.get("lat");
    const lngStr = searchParams.get("lng");
    const keyword = (searchParams.get("keyword") || "").trim();
    const radiusStr = searchParams.get("radius");

    // 키워드가 없으면 "맛집" 같은 기본 키워드라도 넣어서 검색할지, 아니면 에러를 줄지 결정
    // 지도 중심 기반 주변 장소 검색(카테고리 검색)이 아니라 '키워드 검색'이므로 키워드 필수
    const effectiveKeyword = keyword || "맛집"; // 키워드 없으면 주변 맛집 검색

    const lat = latStr ? parseFloat(latStr) : undefined;
    const lng = lngStr ? parseFloat(lngStr) : undefined;
    const radius = radiusStr ? parseFloat(radiusStr) : 2000; // 기본 2km

    try {
        // [A] 카카오 검색 수행
        const kakaoRes = await kakaoLocalSearch(effectiveKeyword, lat, lng, radius);
        const documents = kakaoRes.documents || [];

        const enrichedPlaces: any[] = [];
        const relatedCourseIds = new Set<number>();

        // [B] 검색 결과 처리
        for (const doc of documents) {
            // 카카오 데이터 필드 매핑
            const title = doc.place_name;
            const address = doc.road_address_name || doc.address_name;
            const category = doc.category_group_name || doc.category_name;
            const placeLat = parseFloat(doc.y);
            const placeLng = parseFloat(doc.x);
            const phone = doc.phone;
            const placeUrl = doc.place_url;
            const id = doc.id;

            // 거리 계산 (API가 distance를 주기도 하지만 미터 단위 문자열일 수 있음)
            let distStr = "";
            if (doc.distance) {
                const dist = parseInt(doc.distance);
                distStr = dist < 1000 ? `${dist}m` : `${(dist / 1000).toFixed(1)}km`;
            } else if (lat && lng) {
                const dist = haversine(lat, lng, placeLat, placeLng);
                distStr = dist < 1000 ? `${Math.round(dist)}m` : `${(dist / 1000).toFixed(1)}km`;
            }

            // 2. 우리 DB 매칭 (주소 앞부분 or 이름)
            // 주소 매칭: "서울 마포구 어울마당로" -> "서울 마포구" 정도만 일치해도 후보로?
            // 정확도를 위해 이름이 포함되는지 확인하는 것이 좋음
            const dbPlace = await prisma.place.findFirst({
                where: {
                    OR: [{ address: { contains: address.split(" ").slice(0, 2).join(" ") } }, { name: title }],
                },
                select: {
                    id: true,
                    name: true,
                    coursePlaces: {
                        include: { course: true },
                    },
                },
            });

            // 이름이 너무 다르면 매칭 취소 (안전장치)
            let matchedDbId = null;
            if (dbPlace) {
                // DB 이름과 카카오 이름이 유사한지 체크 (간단히 포함 여부)
                if (title.includes(dbPlace.name) || dbPlace.name.includes(title)) {
                    matchedDbId = dbPlace.id;
                    // 연관 코스 수집
                    dbPlace.coursePlaces.forEach((cp) => {
                        if (cp.course) relatedCourseIds.add(cp.course.id);
                    });
                }
            }

            enrichedPlaces.push({
                id: id, // 카카오 Place ID
                dbId: matchedDbId,
                name: title,
                category: category,
                address: address,
                description: category,
                phone: phone,
                website: placeUrl,
                latitude: placeLat,
                longitude: placeLng,
                distance: distStr,
                imageUrl: "",
                isDbMatched: !!matchedDbId,
            });
        }

        // [C] 연관된 코스 정보 조회
        let relatedCourses: any[] = [];
        const relatedCourseIdsArray = Array.from(relatedCourseIds);

        // 1. 장소 기반 연관 코스 조회 (기존 로직)
        if (relatedCourseIdsArray.length > 0) {
            const coursesByPlace = await prisma.course.findMany({
                where: { id: { in: relatedCourseIdsArray } },
                select: {
                    id: true,
                    title: true,
                    description: true,
                    imageUrl: true,
                    region: true,
                    concept: true,
                    rating: true,
                },
            });
            relatedCourses.push(...coursesByPlace);
        }

        // 2. [추가] 지역명 기반 코스 조회 (매핑된 지역명이 있으면 해당 지역 코스 추가)
        // 예: "홍대 맛집" -> "홍대/연남" 코스 검색
        const tokens = effectiveKeyword.split(/\s+/);
        const targetRegions = new Set<string>();

        tokens.forEach((token) => {
            const mapped = REGION_MAPPING[token] || REGION_MAPPING[token.replace("구", "").replace("동", "")];
            if (mapped) targetRegions.add(mapped);
        });

        if (targetRegions.size > 0) {
            const regionCourses = await prisma.course.findMany({
                where: {
                    region: { in: Array.from(targetRegions) },
                    id: { notIn: relatedCourseIdsArray }, // 이미 장소로 찾은 코스는 중복 제외
                },
                take: 5, // 지역 기반 추천은 최대 5개만 (너무 많아질 수 있음)
                orderBy: { view_count: "desc" }, // 인기순
                select: {
                    id: true,
                    title: true,
                    description: true,
                    imageUrl: true,
                    region: true,
                    concept: true,
                    rating: true,
                },
            });
            relatedCourses.push(...regionCourses);
        }

        return NextResponse.json({
            success: true,
            places: enrichedPlaces,
            relatedCourses: relatedCourses,
        });
    } catch (error) {
        console.error("KAKAO 장소 검색 API 오류:", error);
        return NextResponse.json({ error: "장소 검색 중 오류 발생" }, { status: 500 });
    }
}
