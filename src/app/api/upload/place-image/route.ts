import { NextRequest, NextResponse } from "next/server";
import { verifyAdminJwt } from "@/lib/auth";
import { getS3Client, getS3Bucket, getS3PublicUrl } from "@/lib/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomBytes } from "crypto";
import sharp from "sharp";
import { captureApiError } from "@/lib/sentry";

export const runtime = "nodejs";

const MAX_BYTES = 20 * 1024 * 1024; // 20MB

export async function POST(request: NextRequest) {
    if (!verifyAdminJwt(request)) {
        return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        if (!file) {
            return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
        }

        if (file.size > MAX_BYTES) {
            return NextResponse.json({ error: "파일이 너무 큽니다. 최대 20MB." }, { status: 413 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const originalName = file.name.toLowerCase();
        const isHeic = originalName.endsWith(".heic") || originalName.endsWith(".heif");

        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const uniqueName = `${Date.now()}-${randomBytes(6).toString("hex")}`;

        let converted: Buffer;
        let contentType: string;
        let ext: string;

        if (isHeic) {
            // HEIC → JPEG 변환
            converted = await sharp(buffer).rotate().jpeg({ quality: 85 }).toBuffer();
            contentType = "image/jpeg";
            ext = "jpg";
        } else {
            // jpg/png는 EXIF 방향만 보정 후 원본 포맷 유지
            const img = sharp(buffer).rotate();
            if (originalName.endsWith(".png")) {
                converted = await img.png().toBuffer();
                contentType = "image/png";
                ext = "png";
            } else {
                converted = await img.jpeg({ quality: 95 }).toBuffer();
                contentType = "image/jpeg";
                ext = "jpg";
            }
        }

        const key = `places/${dateStr}/${uniqueName}.${ext}`;

        const s3 = getS3Client();
        const bucket = getS3Bucket();
        await s3.send(
            new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: converted,
                ContentType: contentType,
            })
        );

        const publicUrl = getS3PublicUrl(key);
        return NextResponse.json({ success: true, url: publicUrl, converted: isHeic });
    } catch (error) {
        captureApiError(error);
        console.error("[place-image upload]", error);
        return NextResponse.json({ error: "업로드 실패" }, { status: 500 });
    }
}
