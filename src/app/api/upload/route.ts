import { NextResponse, NextRequest } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getS3Bucket, getS3Client, getS3PublicUrl } from "@/lib/s3";
import { resolveUserId } from "@/lib/auth";
import { randomBytes } from "crypto";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    console.log("[/api/upload] Received a request."); // 로그 추가

    try {
        const form = await request.formData();
        const formFiles = form.getAll("photos");
        const files: File[] = [];

        for (const item of formFiles) {
            if (item instanceof File) {
                files.push(item);
            }
        }

        if (!files || files.length === 0) {
            console.log("[/api/upload] No files found in the request."); // 로그 추가
            return NextResponse.json({ message: "업로드할 파일이 없습니다." }, { status: 400 });
        }

        // 타입, userId, courseId/escapeId 파라미터 가져오기
        const typeValue = (form as any).get("type") as FormDataEntryValue | null;
        const type = typeValue instanceof File ? null : typeValue?.toString() || null; // "review" or "escape"
        const userIdValue = (form as any).get("userId") as FormDataEntryValue | null;
        const userId = resolveUserId(request) || (userIdValue instanceof File ? null : userIdValue?.toString() || null);
        const courseIdValue = (form as any).get("courseId") as FormDataEntryValue | null;
        const courseId = courseIdValue instanceof File ? null : courseIdValue?.toString() || null;
        const escapeIdValue = (form as any).get("escapeId") as FormDataEntryValue | null;
        const escapeId = escapeIdValue instanceof File ? null : escapeIdValue?.toString() || null;

        // 타입이 지정된 경우 필수 파라미터 검증
        if (type === "review") {
            if (!userId || !courseId) {
                return NextResponse.json(
                    { message: "리뷰 업로드에는 userId와 courseId가 필요합니다." },
                    { status: 400 }
                );
            }
        } else if (type === "escape") {
            if (!userId || !escapeId) {
                return NextResponse.json(
                    { message: "탈출방 업로드에는 userId와 escapeId가 필요합니다." },
                    { status: 400 }
                );
            }
        }

        console.log(`[/api/upload] Found ${files.length} file(s) to process.`); // 로그 추가
        console.log(`[/api/upload] Type: ${type}, UserId: ${userId}, CourseId: ${courseId}, EscapeId: ${escapeId}`);

        const s3 = getS3Client();
        const bucket = getS3Bucket();

        console.log(`[/api/upload] Attempting to upload to S3 bucket: ${bucket}`); // 로그 추가

        const uploadedUrls: string[] = [];
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD 형식

        for (const file of files) {
            const buffer = Buffer.from(await file.arrayBuffer());

            // --- ✨ 추가적으로 강화된 파일 이름 생성 로직 ---
            const originalExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
            // S3가 허용하는 안전한 문자만 남깁니다: a-z, A-Z, 0-9, !, -, _, ., *, ', (, )
            // 마침표(.)는 확장자 앞에만 있도록 처리합니다.
            const safeExt = originalExt.replace(/[^a-z0-9]/g, "").slice(0, 10);

            const uniqueFileName = `${Date.now()}-${randomBytes(8).toString("hex")}.${safeExt}`;

            // 경로 생성: 타입에 따라 다른 경로 사용
            let key: string;
            if (type === "review" && userId && courseId) {
                key = `reviews/user_${userId}/course_${courseId}/${dateStr}_${uniqueFileName}`;
            } else if (type === "escape" && userId && escapeId) {
                key = `escape/user_${userId}/escape_${escapeId}/${dateStr}_${uniqueFileName}`;
            } else {
                // 타입이 지정되지 않은 경우 기존 형식 유지 (하위 호환성)
                key = `uploads/${dateStr}/${uniqueFileName}`;
            }

            console.log(`[/api/upload] Generated S3 Key: ${key}`);
            console.log(`[/api/upload] File MIME type: ${file.type}`);

            await s3.send(
                new PutObjectCommand({
                    Bucket: bucket,
                    Key: key,
                    Body: buffer,
                    ContentType: file.type || "image/jpeg",
                })
            );

            const publicUrl = getS3PublicUrl(key);
            console.log(`[/api/upload] Successfully uploaded. Public URL: ${publicUrl}`); // 로그 추가
            uploadedUrls.push(publicUrl);
        }

        return NextResponse.json({ success: true, photo_urls: uploadedUrls });
    } catch (error: any) {
        console.error("[/api/upload] CRITICAL ERROR:", error);
        console.error("[/api/upload] Error Name:", error.name);
        console.error("[/api/upload] Error Message:", error.message);
        console.error("[/api/upload] Error Stack:", error.stack);

        return NextResponse.json({ message: error?.message || "업로드 처리 중 오류가 발생했습니다." }, { status: 500 });
    }
}
