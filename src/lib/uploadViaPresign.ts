/**
 * Presigned URL 방식 업로드: 서버는 URL만 발급하고, 파일은 클라이언트에서 S3로 직접 전송.
 * Vercel 4.5MB 요청 제한을 피해 대용량(최대 50MB/파일) 업로드 가능.
 */

export type PresignUploadType = "review" | "memory" | "escape";

export interface PresignUploadOptions {
    type?: PresignUploadType | null;
    courseId?: string | number;
    escapeId?: string | number;
    userId?: string | number;
}

/**
 * 파일 배열을 Presigned URL로 S3에 직접 업로드하고, 공개 URL 배열을 반환합니다.
 */
export async function uploadViaPresign(
    files: File[],
    options: PresignUploadOptions,
    fetchOptions?: RequestInit
): Promise<string[]> {
    if (files.length === 0) return [];

    const body = {
        type: options.type,
        userId: options.userId != null ? String(options.userId) : undefined,
        courseId: options.courseId != null ? String(options.courseId) : undefined,
        escapeId: options.escapeId != null ? String(options.escapeId) : undefined,
        files: files.map((f) => ({
            filename: f.name,
            contentType: f.type || "image/jpeg",
            size: f.size,
        })),
    };

    const res = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
        ...fetchOptions,
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || "Presign 요청에 실패했습니다.");
    }
    if (!data.success || !Array.isArray(data.uploads) || data.uploads.length !== files.length) {
        throw new Error(data.message || "업로드 URL을 받지 못했습니다.");
    }

    const publicUrls: string[] = [];
    for (let i = 0; i < files.length; i++) {
        const { uploadUrl, publicUrl } = data.uploads[i];
        const file = files[i];
        const contentType = file.type || "image/jpeg";

        const putRes = await fetch(uploadUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": contentType },
        });
        if (!putRes.ok) {
            throw new Error(`파일 업로드 실패: ${file.name}`);
        }
        publicUrls.push(publicUrl);
    }
    return publicUrls;
}
