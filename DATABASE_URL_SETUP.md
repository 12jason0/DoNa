# 데이터베이스 URL 설정 가이드 (Neon PostgreSQL)

## 중요 사항

Neon 등의 클라우드 PostgreSQL 서비스를 사용할 때는 `DATABASE_URL`과 `DIRECT_URL`을 올바르게 설정해야 합니다.

## 올바른 설정 방법

### 1. Neon 대시보드에서 주소 확인

Neon 대시보드의 Connection Details에서 두 가지 주소를 확인할 수 있습니다:

1. **Pooled Connection** (연결 풀링 사용)
   - 주소 중간에 `-pooler`가 포함되어 있음
   - 예: `ep-xxx-pooler.ap-southeast-1.aws.neon.tech`

2. **Direct Connection** (직접 연결)
   - 주소 중간에 `-pooler`가 없음
   - 예: `ep-xxx.ap-southeast-1.aws.neon.tech`

### 2. `.env.local` 파일 설정

```env
# ✅ 앱 실행용 (연결 풀링 사용)
# - 주소에 -pooler 포함
# - pgbouncer=true 파라미터 추가 (권장)
DATABASE_URL="postgresql://user:password@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true"

# ✅ 마이그레이션용 (직접 연결)
# - 주소에 -pooler 없음
# - pgbouncer=true 파라미터 추가하면 안 됨!
DIRECT_URL="postgresql://user:password@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
```

## 왜 이렇게 해야 하나요?

### DATABASE_URL에 `pgbouncer=true`를 붙이는 이유

- **연결 풀링**: 여러 애플리케이션 연결을 효율적으로 관리
- **리소스 절약**: 실제 DB 연결 수를 줄여 비용 절감
- **동시 연결 증가**: DB 연결 제한보다 많은 클라이언트 연결 처리 가능

### DIRECT_URL에 `pgbouncer=true`를 붙이면 안 되는 이유

- **마이그레이션 실패**: Prisma 마이그레이션(`prisma migrate`)은 복잡한 DDL 작업을 수행
- **Prepared Statement 제한**: PgBouncer는 트랜잭션 모드에서 Prepared Statement를 제한할 수 있음
- **직접 연결 필요**: 스키마 변경 작업은 풀러를 거치지 않고 직접 연결해야 안전함

### DIRECT_URL에 `-pooler`가 있으면 안 되는 이유

- **풀러 주소**: `-pooler`가 포함된 주소는 연결 풀링을 위한 주소
- **직접 연결 필요**: 마이그레이션은 직접 연결이 필요하므로 `-pooler`가 없는 Direct Connection 주소를 사용해야 함

## 설정 확인 방법

### 1. 현재 설정 확인

```bash
# .env.local 파일 확인
cat .env.local | grep -E "DATABASE_URL|DIRECT_URL"
```

### 2. 마이그레이션 테스트

```bash
# 마이그레이션이 정상 작동하는지 확인
npx prisma migrate dev --name test
```

### 3. 앱 실행 테스트

```bash
# 앱이 정상 작동하는지 확인
npm run dev
```

## 문제 해결

### 문제: 마이그레이션이 실패합니다

**원인**: `DIRECT_URL`에 `-pooler`가 포함되어 있거나 `pgbouncer=true`가 추가되어 있을 수 있습니다.

**해결**:
1. Neon 대시보드에서 "Pooled connection" 체크를 **해제**
2. 나타나는 Direct Connection 주소를 복사
3. `DIRECT_URL`에 붙여넣기 (pgbouncer 파라미터 없이)

### 문제: 연결 오류가 발생합니다

**원인**: 주소 형식이 잘못되었을 수 있습니다.

**해결**:
1. Neon 대시보드에서 Connection Details 확인
2. 주소가 정확한지 확인
3. 사용자명, 비밀번호, 데이터베이스명이 올바른지 확인

## 참고

- Prisma 공식 문서: [Connection Pooling](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
- Neon 공식 문서: [Connection Pooling](https://neon.tech/docs/connect/connection-pooling)

