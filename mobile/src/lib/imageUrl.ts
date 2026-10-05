import { BASE_URL } from './api';

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

// 웹(next.config images.remotePatterns)이 허용하는 우리 이미지 호스트만 리사이즈
const RESIZABLE_HOSTS = ['d13xx6k6chk2in.cloudfront.net', 'stylemap-seoul.s3.ap-northeast-2.amazonaws.com'];

/**
 * 목록 카드용 축소 이미지 URL. 원본(최대 10MB)을 그대로 받지 않도록 웹의 Next 이미지 최적화(/_next/image)를 거친다.
 * width는 next.config deviceSizes(640, 750, 828, 1080, 1200) 중 하나여야 한다.
 */
export function resolveResizedImageUrl(url?: string | null, width: 640 | 750 | 828 | 1080 | 1200 = 640): string | undefined {
    const full = resolveImageUrl(url);
    if (!full) return undefined;
    try {
        if (!RESIZABLE_HOSTS.includes(new URL(full).hostname)) return full;
    } catch {
        return full;
    }
    return `${BASE_URL}/_next/image?url=${encodeURIComponent(full)}&w=${width}&q=75`;
}
