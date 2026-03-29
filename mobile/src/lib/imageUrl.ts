const CLOUDFRONT = 'https://d13xx6k6chk2in.cloudfront.net';

/**
 * 상대 경로 이미지 URL을 CloudFront 절대 URL로 변환.
 * 이미 절대 URL이면 그대로 반환.
 */
export function resolveImageUrl(url?: string | null): string | undefined {
    if (!url) return undefined;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${CLOUDFRONT}${url.startsWith('/') ? '' : '/'}${url}`;
}
