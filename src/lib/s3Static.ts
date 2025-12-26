/**
 * 정적 S3 이미지 URL 생성 헬퍼
 *
 * 클라이언트/서버 양쪽에서 사용 가능하도록 환경 변수 기반으로 설정
 * CloudFront 도메인이 설정되어 있으면 자동으로 사용합니다.
 */

/**
 * S3 정적 이미지의 공개 URL을 생성합니다.
 *
 * @param path - S3 내 상대 경로 (예: "logo/donalogo_512.png", "escape/jongro/jongroMap.png")
 * @returns 공개 접근 가능한 URL
 */
export function getS3StaticUrl(path: string): string {
    // path 앞의 / 제거
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;

    // 서버 사이드: 환경 변수 직접 사용
    if (typeof window === "undefined") {
        const customBase = process.env.S3_PUBLIC_BASE_URL || process.env.CLOUDFRONT_DOMAIN;
        if (customBase) {
            const baseUrl = customBase.startsWith("http") ? customBase : `https://${customBase}`;
            return `${baseUrl.replace(/\/$/, "")}/${cleanPath}`;
        }
        // Fallback: CloudFront 도메인 (환경 변수가 없는 경우에도 CloudFront 사용)
        console.warn(`[getS3StaticUrl] CloudFront domain not set. Using default CloudFront domain for: ${path}`);
        return `https://d13xx6k6chk2in.cloudfront.net/${cleanPath}`;
    }

    // 클라이언트 사이드: NEXT_PUBLIC_ 환경 변수 사용
    const publicBase = process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN;
    if (publicBase) {
        const baseUrl = publicBase.startsWith("http") ? publicBase : `https://${publicBase}`;
        return `${baseUrl.replace(/\/$/, "")}/${cleanPath}`;
    }

    // Fallback: CloudFront 도메인 (환경 변수가 없는 경우에도 CloudFront 사용)
    console.warn(`[getS3StaticUrl] CloudFront domain not set. Using default CloudFront domain for: ${path}`);
    return `https://d13xx6k6chk2in.cloudfront.net/${cleanPath}`;
}

/**
 * 다른 S3 버킷(예: stylemap-images)의 정적 이미지 URL 생성
 *
 * @param path - S3 내 상대 경로
 * @param bucket - 버킷 이름 (기본값: "stylemap-images")
 * @param region - 리전 (기본값: "ap-southeast-2")
 * @returns 공개 접근 가능한 URL
 */
export function getOtherS3StaticUrl(
    path: string,
    bucket: string = "stylemap-images",
    region: string = "ap-southeast-2"
): string {
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;

    // CloudFront가 설정되어 있으면 우선 사용
    const staticUrl = getS3StaticUrl(path);

    // 만약 기본 버킷(stylemap-seoul)의 CloudFront를 사용 중이라면
    // 다른 버킷은 별도 CloudFront가 필요할 수 있음
    // 일단 기본 S3 URL 반환 (필요시 별도 CloudFront 설정)
    return `https://${bucket}.s3.${region}.amazonaws.com/${cleanPath}`;
}
