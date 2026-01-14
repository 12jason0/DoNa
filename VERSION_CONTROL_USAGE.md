# 버전 분기 처리 사용 가이드

## 개요

v1.2.1 심사용 빌드와 기존 v1.0.x 빌드를 구분하여 다른 기능을 제공할 수 있도록 버전 관리 시스템이 구현되었습니다.

## 구현 내용

### 1. WebScreen.tsx - UserAgent 버전 식별자 추가
- 위치: `mobile/src/components/WebScreen.tsx`
- 변경: WebView의 userAgent에 `DoNa_App_v1.2.1_Review_Android` 또는 `DoNa_App_v1.2.1_Review_iOS` 추가
- 목적: 웹 서버에서 심사용 빌드인지 감지 가능

### 2. VersionProvider - 전역 버전 상태 관리
- 위치: `src/providers/VersionProvider.tsx`
- 기능: `useVersion()` 훅을 통해 `isReview` 상태 제공
- 통합: `src/components/Providers.tsx`에 추가됨

## 사용 방법

### 기본 사용법

```tsx
import { useVersion } from "@/providers/VersionProvider";

function MyComponent() {
    const { isReview } = useVersion();

    // 심사용 빌드일 때와 기존 빌드일 때 다른 로직 적용
    if (isReview) {
        // v1.2.1 심사용 빌드: 프리미엄 기능 표시
        return <PremiumFeatures />;
    } else {
        // v1.0.x 기존 빌드: 기존 기능 유지
        return <BasicFeatures />;
    }
}
```

### 예시: 코스 목록 분기 처리

```tsx
import { useVersion } from "@/providers/VersionProvider";

function CourseList() {
    const { isReview } = useVersion();
    
    // 심사 버전일 때는 등급별 필터링 로직 적용, 구버전은 기존 로직 유지
    const courses = isReview ? getTieredCourses(user.tier) : getAllCourses();
    
    return (
        <div>
            {courses.map(course => (
                <CourseCard key={course.id} course={course} />
            ))}
        </div>
    );
}
```

### 예시: 팁 섹션 분기 처리

```tsx
import { useVersion } from "@/providers/VersionProvider";

function TipsSection() {
    const { isReview } = useVersion();
    
    // 신버전 심사관에게는 '유료 팁' 기능을 보여주고, 기존 유저는 '무료 팁' 유지
    return isReview ? <PremiumTips /> : <BasicTips />;
}
```

### 예시: 등급 시스템 분기 처리

```tsx
import { useVersion } from "@/providers/VersionProvider";

function SubscriptionModal() {
    const { isReview } = useVersion();
    
    // 심사용 빌드에서는 등급별 세분화된 기능 표시
    if (isReview) {
        return <TieredSubscriptionPlans />;
    }
    
    // 기존 빌드에서는 기본 구독 플랜만 표시
    return <BasicSubscriptionPlans />;
}
```

## 동작 원리

1. **앱 빌드 시**: WebScreen.tsx에서 userAgent에 버전 식별자 추가
2. **웹 로드 시**: VersionProvider가 userAgent를 확인하여 `isReview` 상태 설정
3. **컴포넌트 사용**: `useVersion()` 훅으로 `isReview` 값 확인하여 분기 처리

## 주의사항

- **기존 사용자 영향 없음**: v1.0.x 빌드의 userAgent에는 식별자가 없으므로 `isReview`는 `false`로 유지됨
- **무중단 배포**: 웹 서버 코드 업데이트가 있어도 기존 앱 사용자는 기존 기능을 그대로 사용
- **심사 최적화**: 심사관은 v1.2.1 빌드로 접속하므로 최신 기능을 확인 가능

## 버전 변경 시

새로운 버전을 추가하려면:
1. `mobile/src/components/WebScreen.tsx`의 userAgent 식별자 변경
2. `src/providers/VersionProvider.tsx`의 감지 로직 업데이트 (필요시)
3. 관련 컴포넌트에서 버전별 로직 추가
