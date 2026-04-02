# 소셜 로그인 설정 가이드

DoNa 앱의 인증 방식: **이메일/비밀번호**, **카카오 네이티브 SDK**, **Apple (iOS 전용)**

> Google OAuth는 현재 미사용.

---

## 1. 카카오 로그인 (네이티브 SDK)

### 1.1 동작 방식

Android/iOS 모두 `@react-native-kakao/user`의 `login()` 네이티브 SDK 사용.
웹 OAuth(WebBrowser) 방식은 Android에서 딥링크 캡처 실패 문제로 제거됨.

```
앱 → @react-native-kakao/user.login() → accessToken 획득
→ POST /api/auth/kakao/native { accessToken }
→ 서버에서 카카오 API로 사용자 조회 → JWT 반환
```

### 1.2 Kakao Developers 설정

1. [Kakao Developers](https://developers.kakao.com/) → 앱 선택
2. **플랫폼** → Android/iOS 플랫폼 추가
   - Android: 패키지명 `kr.io.dona.dona`, 키 해시 등록
   - iOS: 번들 ID `kr.io.dona.dona`
3. **카카오 로그인** → 활성화
4. **동의항목**: 닉네임, 프로필 사진, 이메일 활성화
5. **앱 키 확인**: Native App Key → `app.json`의 `@react-native-kakao/core` 설정에 사용

### 1.3 app.json 설정

```json
{
  "plugins": [
    ["@react-native-kakao/core", {
      "nativeAppKey": "YOUR_KAKAO_NATIVE_APP_KEY",
      "android": { "authCodeHandlerActivity": true },
      "ios": { "handleKakaoOpenUrl": true }
    }]
  ]
}
```

### 1.4 서버 엔드포인트

- `POST /api/auth/kakao/native`
- Body: `{ accessToken: string }`
- Response: `{ token: string, user: { id, email, name } }`

---

## 2. Apple 로그인 (iOS 전용)

### 2.1 동작 방식

`expo-apple-authentication` 사용. Android에서는 렌더링 안 됨 (`Platform.OS === 'ios'` 조건).

```
앱 → AppleAuthentication.signInAsync() → identityToken 획득
→ POST /api/auth/apple { identityToken }
→ 서버에서 Apple JWT 검증 → JWT 반환
```

### 2.2 Apple Developer 설정

1. Apple Developer → Certificates, Identifiers & Profiles
2. Identifier `kr.io.dona.dona` → **Sign In with Apple** 활성화
3. App Store Connect → 앱 → **Sign In with Apple** Capability 추가

### 2.3 Expo 설정

`app.json`에 이미 설정됨:
```json
{
  "ios": {
    "usesAppleSignIn": true
  }
}
```

---

## 3. 이메일/비밀번호 로그인

- `POST /api/auth/login` — `{ email, password }` → `{ token, user }`
- `POST /api/auth/signup` — 회원가입
- 토큰은 MMKV에 저장 (`saveAuthToken(token)`)

---

## 4. 환경 변수

```env
# 카카오
KAKAO_CLIENT_ID=your_kakao_rest_api_key
KAKAO_CLIENT_SECRET=your_kakao_client_secret

# JWT
JWT_SECRET=32자_이상의_강력한_시크릿

# 앱 URL
NEXT_PUBLIC_APP_URL=https://dona.io.kr
```

---

## 5. 로그인 UI

- 카카오: 원형 아이콘 버튼 (`KakaoMark` SVG)
- Apple: 원형 아이콘 버튼 (`AppleMark` SVG), iOS 전용
- 이메일: 텍스트 입력 + 비밀번호 토글

---

## 6. 문제 해결

| 증상 | 원인 | 해결 |
|------|------|------|
| Android 카카오 로그인 실패 | 키 해시 미등록 | Kakao Developers에 키 해시 추가 |
| Apple 버튼 미표시 | Android에서 접근 | iOS 전용, 정상 동작 |
| `login is not a function` | 네이티브 빌드 미완료 | EAS dev build 재빌드 필요 |
| 토큰 만료 후 로그아웃 | JWT 만료 | 자동 처리됨 (401 → 로그인 화면) |
