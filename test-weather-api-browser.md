# 브라우저 콘솔에서 테스트하기

## 방법 1: 브라우저 콘솔에서 직접 실행

1. 개발 서버 실행: `npm run dev`
2. 브라우저에서 `http://localhost:3000` 접속
3. 개발자 도구 열기 (F12)
4. Console 탭에서 아래 코드 실행:

```javascript
// 날씨 API 테스트
async function testWeatherAPI() {
    const region = "서울 강남구"; // 테스트할 지역
    const url = `/api/recommendations?region_today=${encodeURIComponent(region)}&limit=3`;

    console.log(`🧪 테스트 시작: ${region}`);

    try {
        const response = await fetch(url);
        const data = await response.json();

        console.log("✅ API 응답:", data);
        console.log("📊 추천 코스 개수:", data.recommendations?.length);
        console.log("💡 서버 콘솔을 확인하여 날씨 API 로그를 보세요!");
    } catch (error) {
        console.error("❌ 오류:", error);
    }
}

testWeatherAPI();
```

## 방법 2: 직접 URL 접속

브라우저 주소창에 입력:

```
http://localhost:3000/api/recommendations?region_today=서울 강남구&limit=3
```

## 확인 사항

1. **서버 터미널 콘솔**에서 다음 로그 확인:

    - ✅ 날씨 API 호출 준비
    - 🌤️ 날씨/미세먼지 API 호출 시작
    - 📊 날씨 API 결과

2. **브라우저 응답**에서 확인:
    - JSON 응답이 정상적으로 오는지
    - `recommendations` 배열이 있는지

## 환경 변수 확인

`.env.local` 파일에 다음이 설정되어 있어야 합니다:

```
KMA_API_KEY=your_kma_api_key
AIRKOREA_API_KEY=your_airkorea_api_key
```
