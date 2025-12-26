/**
 * 정적 S3 이미지 URL 생성 (서버 사이드 전용)
 * 메타데이터 등 정적 컨텍스트에서 사용
 */

export function getS3StaticUrlForMetadata(path: string): string {
    const customBase = process.env.S3_PUBLIC_BASE_URL || process.env.CLOUDFRONT_DOMAIN;
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;

    if (customBase) {
        const baseUrl = customBase.startsWith("http") ? customBase : `https://${customBase}`;
        return `${baseUrl.replace(/\/$/, "")}/${cleanPath}`;
    }

    // Fallback: CloudFront 도메인 (환경 변수가 없는 경우에도 CloudFront 사용)
    console.warn(`[getS3StaticUrlForMetadata] CloudFront domain not set. Using default CloudFront domain for: ${path}`);
    return `https://d13xx6k6chk2in.cloudfront.net/${cleanPath}`;
}
