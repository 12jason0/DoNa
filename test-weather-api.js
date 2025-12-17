// 날씨 API 테스트 스크립트
// 사용법: node test-weather-api.js

const testWeatherAPI = async () => {
    const baseUrl = "http://localhost:3000"; // 또는 실제 배포 URL
    const regionToday = "서울 강남구"; // 테스트할 지역

    console.log(`\n🧪 날씨 API 테스트 시작...`);
    console.log(`📍 테스트 지역: ${regionToday}\n`);

    try {
        // 추천 API 호출 (region_today 파라미터 포함)
        const url = `${baseUrl}/api/recommendations?region_today=${encodeURIComponent(regionToday)}&limit=3`;
        console.log(`📡 API 호출: ${url}\n`);

        const response = await fetch(url, {
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            console.error(`❌ HTTP 오류: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error(`응답 내용: ${text}`);
            return;
        }

        const data = await response.json();

        console.log(`✅ API 호출 성공!\n`);
        console.log(`📊 응답 데이터:`);
        console.log(`   - 추천 코스 개수: ${data.recommendations?.length || 0}`);
        console.log(`   - 첫 번째 코스: ${data.recommendations?.[0]?.title || "없음"}`);

        // 서버 콘솔을 확인하세요 (날씨 API 호출 로그가 있을 것입니다)
        console.log(`\n💡 서버 콘솔을 확인하여 날씨 API 호출 로그를 확인하세요!`);
        console.log(`   예: ✅ 날씨 API 호출 준비, 🌤️ 날씨/미세먼지 API 호출 시작, 📊 날씨 API 결과\n`);
    } catch (error) {
        console.error(`❌ 오류 발생:`, error.message);
        console.error(`\n💡 개발 서버가 실행 중인지 확인하세요: npm run dev`);
    }
};

testWeatherAPI();
