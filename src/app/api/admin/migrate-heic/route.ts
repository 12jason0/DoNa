import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import sharp from "sharp";
import { getPresignedPutUrl, getS3PublicUrl } from "@/lib/s3";
import { verifyAdminJwt } from "@/lib/auth";
import { captureApiError } from "@/lib/sentry";

export const runtime = "nodejs";
export const maxDuration = 300;

function getKeyFromUrl(url: string): string | null {
    const base = (process.env.S3_PUBLIC_BASE_URL || process.env.CLOUDFRONT_DOMAIN || "")
        .replace(/\/$/, "");
    if (base && url.startsWith(base.startsWith("http") ? base : `https://${base}`)) {
        const fullBase = (base.startsWith("http") ? base : `https://${base}`).replace(/\/$/, "");
        return url.slice(fullBase.length + 1);
    }
    const bucket = process.env.S3_BUCKET_NAME || "";
    const region = process.env.AWS_REGION || process.env.S3_REGION || "ap-northeast-2";
    const s3Base = `https://${bucket}.s3.${region}.amazonaws.com`;
    if (url.startsWith(s3Base)) return url.slice(s3Base.length + 1);
    return null;
}

export async function POST(request: NextRequest) {
    try {
        if (!verifyAdminJwt(request)) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const reviews = await (prisma as any).review.findMany({
            select: { id: true, imageUrls: true },
        });

        const heicReviews = reviews.filter((r: any) =>
            r.imageUrls.some((url: string) => /\.heic$/i.test(url))
        );

        const result = { total: heicReviews.length, converted: 0, failed: 0, errors: [] as string[] };

        for (const review of heicReviews) {
            const newUrls: string[] = [];
            let changed = false;

            for (const url of review.imageUrls as string[]) {
                if (!/\.heic$/i.test(url)) {
                    newUrls.push(url);
                    continue;
                }

                try {
                    const res = await fetch(url);
                    if (!res.ok) throw new Error(`fetch ${res.status}`);
                    const buffer = Buffer.from(await res.arrayBuffer());

                    const jpegBuffer = await sharp(buffer).jpeg({ quality: 85 }).toBuffer();

                    const oldKey = getKeyFromUrl(url);
                    if (!oldKey) throw new Error(`key 추출 실패: ${url}`);
                    const newKey = oldKey.replace(/\.heic$/i, ".jpg");

                    const putUrl = await getPresignedPutUrl(newKey, "image/jpeg");
                    const putRes = await fetch(putUrl, {
                        method: "PUT",
                        body: jpegBuffer,
                        headers: { "Content-Type": "image/jpeg" },
                    });
                    if (!putRes.ok) throw new Error(`S3 PUT ${putRes.status}`);

                    newUrls.push(getS3PublicUrl(newKey));
                    changed = true;
                } catch (e: any) {
                    result.failed++;
                    result.errors.push(`review ${review.id}: ${e.message}`);
                    newUrls.push(url);
                }
            }

            if (changed) {
                await (prisma as any).review.update({
                    where: { id: review.id },
                    data: { imageUrls: newUrls },
                });
                result.converted++;
            }
        }

        return NextResponse.json(result);
    } catch (error) {
        captureApiError(error);
        return NextResponse.json({ error: "migration failed" }, { status: 500 });
    }
}
