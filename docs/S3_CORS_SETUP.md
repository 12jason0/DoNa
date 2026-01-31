# S3 버킷 CORS 설정 (Presigned URL 업로드용)

브라우저에서 Presigned URL로 S3에 **직접 PUT** 업로드할 때 CORS 오류가 나면, **S3 버킷에 CORS 설정**을 추가해야 합니다.

## 오류 예시

```
Access to fetch at 'https://stylemap-seoul.s3.ap-northeast-2.amazonaws.com/...' from origin 'http://localhost:3000' 
has been blocked by CORS policy: Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## 원인

- Presigned URL 업로드는 **브라우저 → S3** 직접 요청(Cross-Origin)입니다.
- 브라우저가 OPTIONS(preflight)를 보내면, S3가 `Access-Control-Allow-Origin` 등 CORS 헤더를 돌려줘야 합니다.
- S3 버킷에 CORS 설정이 없으면 이 헤더가 없어서 요청이 차단됩니다.

## 해결: S3 버킷에 CORS 추가

### 1. AWS 콘솔 접속

1. **AWS Console** → **S3**
2. 버킷 **`stylemap-seoul`** 선택 (또는 사용 중인 S3 버킷 이름)

### 2. CORS 설정 열기

1. 상단 **권한(Permissions)** 탭 클릭
2. 아래로 스크롤하여 **CORS(Cross-origin resource sharing)** 섹션 찾기
3. **편집(Edit)** 클릭

### 3. 아래 JSON 붙여넣기

**CORS configuration** 입력란에 아래 JSON을 **그대로** 붙여넣고 저장합니다.

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://dona.io.kr",
      "https://www.dona.io.kr"
    ],
    "ExposeHeaders": ["ETag"]
  }
]
```

### 4. 주의사항

- **AllowedOrigins**: 실제 사용하는 웹 주소만 포함하세요.
  - 로컬 개발: `http://localhost:3000`
  - 운영 도메인: `https://dona.io.kr`, `https://www.dona.io.kr` 등
- **AllowedMethods**: Presigned URL로 **PUT** 업로드하므로 `PUT`이 반드시 포함되어 있어야 합니다.
- 저장 후 브라우저에서 다시 업로드 시도하면 CORS 오류가 사라집니다.

---

## 요약

| 항목 | 내용 |
|------|------|
| 수정 위치 | AWS S3 → 버킷 `stylemap-seoul` → 권한 → CORS |
| 수정 내용 | 위 JSON으로 CORS 규칙 추가 |
| 코드 변경 | 없음 (Presigned URL 로직은 그대로 사용) |
