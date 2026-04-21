import { NextRequest, NextResponse } from "next/server";
import { runPlaceAutofill } from "@/lib/placeAutofill";
import { getS3Client, getS3Bucket, getS3PublicUrl } from "@/lib/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const ALLOWED_IDS = (process.env.TELEGRAM_ADMIN_IDS || "").split(",").map((s) => Number(s.trim())).filter(Boolean);

async function sendMessage(chatId: number, text: string) {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
    });
}

async function downloadTelegramPhoto(fileId: string): Promise<Buffer> {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
    const data = await res.json();
    const filePath = data.result?.file_path;
    if (!filePath) throw new Error("파일 경로 없음");
    const imgRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`);
    return Buffer.from(await imgRes.arrayBuffer());
}

function toSlug(str: string): string {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "place";
}

async function uploadPhotoToS3(buffer: Buffer, nameEn: string): Promise<string> {
    const converted = await sharp(buffer).rotate().jpeg({ quality: 85 }).toBuffer();
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const slug = toSlug(nameEn);
    const key = `places/${dateStr}/${slug}.jpg`;
    const s3 = getS3Client();
    await s3.send(new PutObjectCommand({
        Bucket: getS3Bucket(),
        Key: key,
        Body: converted,
        ContentType: "image/jpeg",
    }));
    return getS3PublicUrl(key);
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const message = body?.message;
        if (!message) return NextResponse.json({ ok: true });

        const chatId: number = message.chat?.id;
        const text: string = message.text || "";
        const caption: string = message.caption || "";

        // 인증되지 않은 채팅 무시
        if (ALLOWED_IDS.length > 0 && !ALLOWED_IDS.includes(chatId)) {
            return NextResponse.json({ ok: true });
        }

        // /start 커맨드
        if (text === "/start") {
            await sendMessage(chatId, "안녕하세요! 사진과 함께 장소 이름을 캡션으로 입력하면 자동으로 저장됩니다.\n\n예시: 사진 첨부 후 캡션에 '봉땅' 입력");
            return NextResponse.json({ ok: true });
        }

        // 사진 메시지 처리
        if (message.photo) {
            const placeName = caption.trim();
            if (!placeName) {
                await sendMessage(chatId, "캡션에 장소 이름을 입력해주세요.\n예시: 사진 첨부 후 캡션에 '봉땅' 입력");
                return NextResponse.json({ ok: true });
            }

            await sendMessage(chatId, `📍 "${placeName}" 저장 중...`);

            const largestPhoto = message.photo[message.photo.length - 1];

            // autofill + 사진 다운로드 병렬 실행
            const [autofillData, photoBuffer] = await Promise.all([
                runPlaceAutofill(placeName).catch((e) => { console.error("autofill 실패:", e); return { name: placeName } as any; }),
                downloadTelegramPhoto(largestPhoto.file_id).catch((e) => { console.error("사진 다운로드 실패:", e); return null as any; }),
            ]);

            // 영문명으로 S3 업로드
            let imageUrl = "";
            if (photoBuffer) {
                try {
                    imageUrl = await uploadPhotoToS3(photoBuffer, autofillData.name_en || placeName);
                } catch (e) {
                    console.error("S3 업로드 실패:", e);
                }
            }

            // draft 로 DB 저장
            const saved = await (prisma as any).place.create({
                data: {
                    name: autofillData.name || placeName,
                    name_en: autofillData.name_en || null,
                    name_ja: autofillData.name_ja || null,
                    name_zh: autofillData.name_zh || null,
                    address: autofillData.address || null,
                    address_en: autofillData.address_en || null,
                    address_ja: autofillData.address_ja || null,
                    address_zh: autofillData.address_zh || null,
                    description: autofillData.description || null,
                    description_en: autofillData.description_en || null,
                    description_ja: autofillData.description_ja || null,
                    description_zh: autofillData.description_zh || null,
                    category: autofillData.category || null,
                    avg_cost_range: autofillData.avg_cost_range || null,
                    opening_hours: autofillData.opening_hours || null,
                    phone: autofillData.phone || null,
                    website: autofillData.website || null,
                    reservation_required: autofillData.reservation_required ?? false,
                    latitude: autofillData.latitude ?? null,
                    longitude: autofillData.longitude ?? null,
                    imageUrl: imageUrl || null,
                    status: "draft",
                },
                select: { id: true, name: true },
            });

            await sendMessage(chatId, `✅ "${saved.name}" 저장 완료!\n\nID: ${saved.id}\n집에서 admin 페이지에서 확인·수정 후 발행하세요.`);
            return NextResponse.json({ ok: true });
        }

        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error("텔레그램 webhook 오류:", e);
        return NextResponse.json({ ok: true }); // 텔레그램에 항상 200 반환
    }
}
