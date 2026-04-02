# 코스 상세 트러블슈팅 가이드

`mobile/app/courses/[id]/index.tsx` 기준 (네이티브 앱).

---

## 자주 발생하는 문제

### 1. 지도가 검은 화면으로 표시됨 (Android)

**증상**: 코스 상세의 CourseMapModal에서 지도가 까맣게 보임

**원인**: `<Modal transparent>` 안에 NaverMapView를 넣으면 Android에서 렌더링 실패

**해결**: Android에서는 `transparent={false}` + 루트 View에 배경색 설정
```tsx
<Modal
  transparent={Platform.OS !== 'android'}
  ...
>
  <View style={{ 
    flex: 1, 
    backgroundColor: Platform.OS === 'android' ? 'rgba(0,0,0,0.6)' : 'transparent' 
  }}>
    <NaverMapView ... />
  </View>
</Modal>
```

---

### 2. 코스 데이터가 로딩되지 않음

**확인 순서**:

1. 네트워크 확인: Metro 콘솔에서 API 호출 로그 확인
2. 엔드포인트 확인: `GET /api/courses/{id}` 응답 확인
3. 인증 확인: MMKV에 `authToken`이 저장되어 있는지 확인

```bash
# API 직접 테스트
curl https://dona.io.kr/api/courses/1 -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 3. 장소 이미지가 표시되지 않음 (403 에러)

**원인**: S3 직접 URL 사용 (버킷이 Private)

**해결**: `resolveImageUrl()` 함수를 통해 CloudFront URL로 변환
```tsx
import { resolveImageUrl } from '../../src/lib/imageUrl';

<Image source={{ uri: resolveImageUrl(place.imageUrl) }} />
```

---

### 4. 찜하기/저장이 안 됨

**확인 순서**:
1. 로그인 상태 확인 (`useAuth().user` 가 null이면 LoginModal 노출)
2. API 응답 확인: `POST /api/courses/{id}/favorites`
3. TanStack Query 캐시 무효화가 되는지 확인

---

### 5. 리뷰 중복 제출

**동작**: 같은 코스에 리뷰 재작성 시 자동으로 **업데이트** 처리됨 (새 row 생성 아님).
서버에서 중복 체크 후 upsert 처리.

---

### 6. 공유 기능이 안 됨

**동작**: `Share.share()` 네이티브 API 사용.
`courses/[id]/view.tsx`가 Universal Link 진입점 — `dona.io.kr/courses/{id}` 링크를 앱에서 열면 해당 화면으로 리다이렉트.

---

## API 엔드포인트 목록

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/courses/{id}` | 코스 상세 |
| GET | `/api/courses/{id}/places` | 코스 장소 목록 |
| GET | `/api/courses/{id}/reviews` | 리뷰 목록 |
| POST | `/api/reviews` | 리뷰 작성/수정 |
| POST | `/api/courses/{id}/favorites` | 찜하기 토글 |
| POST | `/api/saved-courses` | AI 추천 코스 저장 |
| GET | `/api/users/active-course` | 현재 진행 중인 코스 |
