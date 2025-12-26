import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const coords = searchParams.get("coords");
        const points = coords?.split(";").filter((p) => p.trim()) || [];

        if (points.length < 2) return NextResponse.json({ error: "좌표 부족" }, { status: 400 });

        // 🟢 네이버 제한 대응: 좌표가 너무 많으면 7개까지만 끊어서 처리 (안정성 확보)
        // 네이버 Driving API는 출발지 + 도착지 + 경유지 5개 = 총 7개까지만 지원
        const limitedPoints = points.length > 7 ? points.slice(0, 7) : points;

        const start = limitedPoints[0];
        const goal = limitedPoints[limitedPoints.length - 1];
        const waypoints = limitedPoints.length > 2 ? limitedPoints.slice(1, -1).slice(0, 5).join("|") : undefined;

        const headers = {
            "X-NCP-APIGW-API-KEY-ID": process.env.NAVER_MAP_API_KEY_ID || "",
            "X-NCP-APIGW-API-KEY": process.env.NAVER_MAP_API_KEY || "",
        };

        // API 키 확인
        if (!headers["X-NCP-APIGW-API-KEY-ID"] || !headers["X-NCP-APIGW-API-KEY"]) {
            console.error("❌ API 키 설정 오류");
            return NextResponse.json({ error: "API 키 설정 오류" }, { status: 500 });
        }

        // 🟢 1단계: Directions 15 시도 (정교한 경로, 월 3,000회 한도)
        const url15 = `https://maps.apigw.ntruss.com/map-direction-15/v1/driving?start=${start}&goal=${goal}${
            waypoints ? `&waypoints=${waypoints}` : ""
        }&option=traoptimal`;

        console.log("🌐 Directions 15 시도:", url15);
        let response = await fetch(url15, { headers, cache: "no-store" });
            let data = await response.json().catch(() => ({}));

        // 🟢 서버 터미널에서 네이버의 진짜 응답을 확인하기 위한 로그
        console.log("📍 네이버 API 최종 응답 코드:", data.code);
        console.log("📍 네이버 API 메시지:", data.message);

        // 🟢 2단계: 15가 실패하거나(404, 429 등) 응답 코드가 0이 아니면 Directions 5 시도
        if (!response.ok || data.code !== 0) {
            console.log("🔄 Directions 15 실패 → Directions 5로 전환", {
                status: response.status,
                code: data.code,
                message: data.message,
            });
            const url5 = `https://maps.apigw.ntruss.com/map-direction/v1/driving?start=${start}&goal=${goal}${
                waypoints ? `&waypoints=${waypoints}` : ""
            }&option=traoptimal`;

            console.log("🌐 Directions 5 시도:", url5);
            response = await fetch(url5, { headers, cache: "no-store" });
                    data = await response.json().catch(() => ({}));

            // 🟢 Directions 5 응답도 로깅
            console.log("📍 네이버 API 최종 응답 코드 (Directions 5):", data.code);
            console.log("📍 네이버 API 메시지 (Directions 5):", data.message);
            }

        // 🟢 최종 결과 반환
        if (data.code === 0 && data.route?.traoptimal?.[0]) {
            const source = response.url?.includes("direction-15") ? "Directions 15" : "Directions 5";
            console.log(`✅ 경로 추출 성공 (${source}):`, data.route.traoptimal[0].path.length, "개 포인트");
                return NextResponse.json({
                coordinates: data.route.traoptimal[0].path,
                summary: data.route.traoptimal[0].summary,
                source, // 사용된 API 표시
                });
            }

        // trafast 백업 시도 (Directions 5에서 traoptimal이 없을 경우)
        if (data.code === 0 && data.route?.trafast?.[0]) {
            const source = "Directions 5 (trafast)";
            console.log(`✅ 경로 추출 성공 (${source}):`, data.route.trafast[0].path.length, "개 포인트");
            return NextResponse.json({
                coordinates: data.route.trafast[0].path,
                summary: data.route.trafast[0].summary,
                source,
            });
        }

        // 🔴 여기서 에러 코드가 무엇인지 서버 터미널에서 확인하세요.
        // 예: 2001(출발지/도착지 동일), 2002(도로 주변 아님) 등
        console.error("❌ 경로 검색 실패 상세:", data);
        return NextResponse.json({ coordinates: [], fallback: true, error: data.message || "NO_ROUTE" });
    } catch (error: any) {
        console.error("❌ API Error:", error.message);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
