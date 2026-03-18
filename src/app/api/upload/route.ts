import { NextResponse, NextRequest } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getS3Bucket, getS3Client, getS3PublicUrl } from "@/lib/s3";
import { resolveUserId } from "@/lib/auth";
import { randomBytes } from "crypto";
import prisma from "@/lib/db";
import { fileTypeFromBuffer } from "file-type";
import { checkRateLimit, getIdentifierFromRequest } from "@/lib/rateLimit";
import { captureApiError } from "@/lib/sentry";

export const runtime = "nodejs";

const ALLOWED_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
/** 리뷰/나만의 추억 업로드: 파일당 최대 10MB. 탈출방 등 기타는 50MB */
const MAX_BYTES_REVIEW_MEMORY = 10 * 1024 * 1024;
const MAX_BYTES_DEFAULT = 50 * 1024 * 1024;

export async function POST(request: NextRequest) {
    console.log("[/api/upload] Received a request."); // 로그 추가

    try {
        // 🟢 Rate limiting: 분당 30회 (IP 또는 userId 기준)
        const authUserId = resolveUserId(request);
        const identifier = authUserId ? String(authUserId) : getIdentifierFromRequest(request);
        const rl = await checkRateLimit("upload", identifier);
        if (!rl.success) {
            return NextResponse.json(
                { message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
                { status: 429, headers: { "Retry-After": String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
            );
        }

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
            if (!courseId) {
                return NextResponse.json(
                    { message: "리뷰 업로드에는 courseId가 필요합니다." },
                    { status: 400 }
                );
            }
        } else if (type === "memory") {
            if (!userId) {
                return NextResponse.json(
                    { message: "개인 추억 업로드에는 userId가 필요합니다." },
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

        // 🟢 memory 타입일 때 유저 이름 가져오기 (개인 추억용)
        let userName: string | null = null;
        if (type === "memory" && userId) {
            try {
                const user = await prisma.user.findUnique({
                    where: { id: Number(userId) },
                    select: { username: true },
                });
                if (user?.username) {
                    // 유저 이름에서 S3 경로에 안전한 문자만 사용 (특수문자는 언더스코어로 변환)
                    // S3가 허용하는 문자: a-z, A-Z, 0-9, !, -, _, ., *, ', (, )
                    userName = user.username.replace(/[^a-zA-Z0-9가-힣_!\-.*'()]/g, "_").trim() || `user_${userId}`;
                } else {
                    userName = `user_${userId}`;
                }
            } catch (err) {
                    captureApiError(err);
                console.error("[/api/upload] 유저 이름 조회 실패:", err);
                userName = `user_${userId}`;
            }
        }

        // 🟢 파일 용량 제한: 리뷰/나만의 추억 10MB, 기타 50MB
        const maxBytes = type === "review" || type === "memory" ? MAX_BYTES_REVIEW_MEMORY : MAX_BYTES_DEFAULT;
        for (const file of files) {
            if (file.size > maxBytes) {
                const maxMB = maxBytes === MAX_BYTES_REVIEW_MEMORY ? 10 : 50;
                return NextResponse.json(
                    { message: `파일 크기가 너무 큽니다. 최대 ${maxMB}MB까지 업로드 가능합니다. (${file.name})` },
                    { status: 413 }
                );
            }
            const buffer = Buffer.from(await file.arrayBuffer());

            // 🟢 [보안] 실제 바이너리(magic bytes)로 이미지 여부 검증 (파일명/Content-Type 위조 방지)
            const detected = await fileTypeFromBuffer(buffer);
            if (!detected || !ALLOWED_IMAGE_MIMES.includes(detected.mime)) {
                return NextResponse.json(
                    { message: `허용되지 않는 파일 형식입니다. 이미지 파일(jpg, png, webp, gif)만 업로드 가능합니다. (${file.name})` },
                    { status: 400 }
                );
            }

            // --- ✨ 추가적으로 강화된 파일 이름 생성 로직 ---
            const originalExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
            // S3가 허용하는 안전한 문자만 남깁니다: a-z, A-Z, 0-9, !, -, _, ., *, ', (, )
            // 마침표(.)는 확장자 앞에만 있도록 처리합니다.
            const safeExt = originalExt.replace(/[^a-z0-9]/g, "").slice(0, 10);

            const uniqueFileName = `${Date.now()}-${randomBytes(8).toString("hex")}.${safeExt}`;

            // Content-Type은 검증된 실제 타입 사용
            const contentType = detected.mime;

            // 경로 생성: 타입에 따라 다른 경로 사용
            let key: string;
            if (type === "memory" && userId && userName) {
                // 🟢 개인 추억: courses/{userName}/...
                key = `courses/${userName}/${dateStr}_${uniqueFileName}`;
            } else if (type === "review" && courseId) {
                // 🟢 일반 코스 리뷰: reviews/course_{courseId}/...
                key = `reviews/course_${courseId}/${dateStr}_${uniqueFileName}`;
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
                    ContentType: contentType,
                })
            );

            const publicUrl = getS3PublicUrl(key);
            console.log(`[/api/upload] Successfully uploaded. Public URL: ${publicUrl}`); // 로그 추가
            uploadedUrls.push(publicUrl);
        }

        return NextResponse.json({ success: true, photo_urls: uploadedUrls });
    } catch (error: any) {
            captureApiError(error);
        console.error("[/api/upload] CRITICAL ERROR:", error);
        console.error("[/api/upload] Error Name:", error.name);
        console.error("[/api/upload] Error Message:", error.message);
        console.error("[/api/upload] Error Stack:", error.stack);

        return NextResponse.json({ message: error?.message || "업로드 처리 중 오류가 발생했습니다." }, { status: 500 });
    }
}
