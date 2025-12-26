import { NextResponse } from "next/server";
import { getS3PublicUrl } from "@/lib/s3";

/**
 * 디버깅용 API: S3 URL 생성 테스트
 * GET /api/debug/s3-url?key=test/image.jpg
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const testKey = searchParams.get("key") || "test/image.jpg";

    const envCheck = {
        S3_PUBLIC_BASE_URL: process.env.S3_PUBLIC_BASE_URL || "❌ 설정되지 않음",
        CLOUDFRONT_DOMAIN: process.env.CLOUDFRONT_DOMAIN || "❌ 설정되지 않음",
        NEXT_PUBLIC_S3_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL || "❌ 설정되지 않음",
        NEXT_PUBLIC_CLOUDFRONT_DOMAIN: process.env.NEXT_PUBLIC_CLOUDFRONT_DOMAIN || "❌ 설정되지 않음",
    };

    try {
        const generatedUrl = getS3PublicUrl(testKey);
        
        return NextResponse.json({
            success: true,
            testKey,
            generatedUrl,
            environmentVariables: envCheck,
            isCloudFront: generatedUrl.includes("cloudfront.net"),
            isS3Direct: generatedUrl.includes("s3.ap-northeast-2.amazonaws.com"),
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
            environmentVariables: envCheck,
        }, { status: 500 });
    }
}

