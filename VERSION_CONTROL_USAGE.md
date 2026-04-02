# 버전 관리 가이드

DoNa 앱은 **EAS Build** (네이티브) + **EAS Update** (OTA) 구조.
WebView 기반의 userAgent 버전 분기 방식은 제거됨 (WebScreen.tsx, VersionProvider.tsx 삭제).

---

## 버전 구조

```
app.json
├── version: "1.2.2"          # 스토어 표시 버전
├── runtimeVersion: "1.2.2"   # OTA 호환 그룹
├── android.versionCode: ...  # Google Play 빌드 번호
└── ios.buildNumber: "37"     # App Store 빌드 번호
```

---

## 배포 흐름

### 네이티브 코드 변경 시 (EAS Build 필요)
- 새 패키지 추가, 네이티브 모듈 변경, app.json 변경
```bash
eas build --profile production --platform all
```
스토어 심사 후 배포.

### JS/UI만 변경 시 (OTA Update)
- 화면 수정, API 변경, 텍스트/스타일 수정
```bash
eas update --branch production --message "변경 내용 설명"
```
앱 재시작 시 자동 적용. 심사 불필요.

---

## 버전 히스토리

| 버전 | iOS buildNumber | 주요 변경 |
|------|----------------|-----------|
| 1.2.2 | 37 | Android 카카오 네이티브 SDK, 지도 모달 수정, lazy 탭, JS 스플래시 |
| 1.2.1 | 36 | App Store 최초 승인 버전 |

---

## 주의사항

- iOS는 같은 버전/빌드번호로 App Store Connect 업로드 불가 → 반드시 `buildNumber` 증가
- `runtimeVersion`이 다르면 OTA 업데이트 적용 안 됨 → 네이티브 빌드와 OTA의 `runtimeVersion` 일치 필요
- Android `versionCode`는 단조 증가해야 함 (감소 불가)
