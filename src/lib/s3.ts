import { S3Client } from "@aws-sdk/client-s3";

let _s3: S3Client | null = null;

function getS3Config() {
    // --- 디버깅 로그 시작 ---
    console.log("--- [S3 설정 확인] 환경 변수를 읽는 중입니다 ---");
    const regionFromAws = process.env.AWS_REGION;
    const regionFromAwsDefault = process.env.AWS_DEFAULT_REGION;
    const regionFromS3 = process.env.S3_REGION;
    const regionFromAwsS3 = process.env.AWS_S3_REGION;
    const bucket = process.env.S3_BUCKET_NAME;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const endpoint = process.env.S3_ENDPOINT; // e.g. https://s3.ap-southeast-2.amazonaws.com or R2/MinIO endpoint
    const forcePathStyle = (process.env.S3_FORCE_PATH_STYLE || "").toLowerCase() === "true";

    // 각 변수가 제대로 로드되었는지 터미널에 출력합니다.
    const resolvedRegion =
        regionFromAws || regionFromAwsDefault || regionFromS3 || regionFromAwsS3 || (endpoint ? "us-east-1" : "");
    console.log(
        `AWS_REGION candidates => AWS_REGION: ${regionFromAws ? "✅" : "❌"}, AWS_DEFAULT_REGION: ${
            regionFromAwsDefault ? "✅" : "❌"
        }, S3_REGION: ${regionFromS3 ? "✅" : "❌"}, AWS_S3_REGION: ${regionFromAwsS3 ? "✅" : "❌"}`
    );
    console.log(`Resolved region: ${resolvedRegion ? resolvedRegion : "(empty)"}`);
    console.log(`S3_BUCKET_NAME: ${bucket ? "✅ 로드됨" : "❌ 누락됨"}`);
    console.log(`AWS_ACCESS_KEY_ID: ${accessKeyId ? `✅ 로드됨 (...${accessKeyId.slice(-4)})` : "❌ 누락됨"}`);
    console.log(`AWS_SECRET_ACCESS_KEY: ${secretAccessKey ? "✅ 로드됨" : "❌ 누락됨"}`);
    console.log("-------------------------------------------------");
    // --- 디버깅 로그 끝 ---

    if (!resolvedRegion || !bucket || !accessKeyId || !secretAccessKey) {
        // 이 오류 메시지가 표시된다면, 위의 로그에서 '누락됨' 부분을 확인하세요.
        throw new Error(
            "S3 is not configured. Set one of [AWS_REGION, AWS_DEFAULT_REGION, S3_REGION, AWS_S3_REGION], and ensure S3_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY are set."
        );
    }

    return {
        region: resolvedRegion,
        bucket,
        credentials: { accessKeyId, secretAccessKey },
        endpoint,
        forcePathStyle,
    } as const;
}

export function getS3Client(): S3Client {
    if (_s3) return _s3;
    const { region, credentials, endpoint, forcePathStyle } = getS3Config();
    const base = { region, credentials } as any;
    if (endpoint) base.endpoint = endpoint;
    if (forcePathStyle) base.forcePathStyle = true;
    _s3 = new S3Client(base);
    return _s3;
}

export function getS3Bucket(): string {
    return getS3Config().bucket;
}

/**
 * S3 객체의 공개 URL을 생성합니다.
 * 
 * CloudFront + OAC 설정 시:
 * - S3_PUBLIC_BASE_URL 환경 변수에 CloudFront 도메인 설정
 * - 예: S3_PUBLIC_BASE_URL=https://d1234567890abc.cloudfront.net
 * 
 * 이렇게 설정하면:
 * 1. S3 버킷은 Private으로 유지 (보안)
 * 2. CloudFront를 통해서만 접근 가능 (OAC)
 * 3. CDN을 통한 빠른 이미지 로딩 (성능)
 * 
 * @param key - S3 객체 키 (경로)
 * @returns 공개 접근 가능한 URL
 */
export function getS3PublicUrl(key: string): string {
    const { region, bucket } = getS3Config();
    
    // CloudFront URL 우선 사용 (보안 및 성능 최적화)
    const customBase = process.env.S3_PUBLIC_BASE_URL || process.env.CLOUDFRONT_DOMAIN;
    if (customBase) {
        // 도메인만 있는 경우 https:// 추가
        const baseUrl = customBase.startsWith("http") 
            ? customBase 
            : `https://${customBase}`;
        return `${baseUrl.replace(/\/$/, "")}/${key}`;
    }
    
    // Fallback: S3 직접 URL (Private 버킷이면 접근 불가)
    // ⚠️ 경고: CloudFront 설정 후에는 이 경로로 접근할 수 없습니다.
    console.warn(
        "[S3] S3_PUBLIC_BASE_URL이 설정되지 않았습니다. " +
        "CloudFront URL을 사용하려면 환경 변수를 설정하세요."
    );
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

// 동일한 자격증명/엔드포인트를 유지하면서 리전만 바꾼 클라이언트를 생성합니다.
export function buildS3Client(regionOverride?: string): S3Client {
    const { region, credentials, endpoint, forcePathStyle } = getS3Config();
    const effectiveRegion = regionOverride || region;
    const base = { region: effectiveRegion, credentials } as any;
    if (endpoint) base.endpoint = endpoint;
    if (forcePathStyle) base.forcePathStyle = true;
    return new S3Client(base);
}
