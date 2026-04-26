import { NextRequest, NextResponse } from "next/server";
import { runPlaceAutofill } from "@/lib/placeAutofill";
import { getS3Client, getS3Bucket, getS3PublicUrl } from "@/lib/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import prisma from "@/lib/db";
import exifr from "exifr";

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

function parseCaption(caption: string): { placeName: string; neighborhood: string | null; category: string | null } {
    const parts = caption.split("|").map((s) => s.trim());
    return {
        placeName: parts[0] || "",
        neighborhood: parts[1] || null,
        category: parts[2] || null,
    };
}

async function extractGpsFromBuffer(buffer: Buffer): Promise<{ latitude: number; longitude: number } | null> {
    try {
        const gps = await exifr.gps(buffer);
        if (gps?.latitude && gps?.longitude) {
            return { latitude: gps.latitude, longitude: gps.longitude };
        }
    } catch {}
    return null;
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
            await sendMessage(chatId, "안녕하세요!\n\n📎 사진을 파일로 보내면 GPS 자동 인식\n\n형식: 장소이름 | 지역 | 카테고리\n예시: 봉땅 | 홍대 | 카페\n\n카테고리: 카페 / 음식점 / 주점 / 소품샵 / 실내명소 / 야외명소 / 이색데이트 / 액티비티 / 사진관 / 인생네컷 / 향수 / 야경 / 식물원 / 시장 / 쇼핑");
            return NextResponse.json({ ok: true });
        }

        // 사진(압축) 또는 파일(원본) 둘 다 처리
        const isPhoto = !!message.photo;
        const isDocument = !!message.document && message.document.mime_type?.startsWith("image/");

        if (isPhoto || isDocument) {
            const rawCaption = caption.trim();
            if (!rawCaption) {
                await sendMessage(chatId, "캡션에 장소 이름을 입력해주세요.\n형식: 장소이름 | 카테고리\n예시: 봉땅 | 카페");
                return NextResponse.json({ ok: true });
            }

            const { placeName, neighborhood, category } = parseCaption(rawCaption);
            if (!placeName) {
                await sendMessage(chatId, "장소 이름을 확인해주세요.");
                return NextResponse.json({ ok: true });
            }

            const categoryMsg = category ? ` (${category})` : "";
            const neighborhoodMsg = neighborhood ? ` / ${neighborhood}` : "";
            await sendMessage(chatId, `📍 "${placeName}"${neighborhoodMsg}${categoryMsg} 저장 중...`);

            const fileId = isDocument
                ? message.document.file_id
                : message.photo[message.photo.length - 1].file_id;

            // 파일 다운로드
            const photoBuffer = await downloadTelegramPhoto(fileId).catch((e) => { console.error("사진 다운로드 실패:", e); return null as Buffer | null; });

            // 파일로 보낸 경우 GPS 추출
            let gpsCoords: { latitude: number; longitude: number } | null = null;
            if (isDocument && photoBuffer) {
                gpsCoords = await extractGpsFromBuffer(photoBuffer);
                if (gpsCoords) {
                    await sendMessage(chatId, `📡 GPS 감지됨 (${gpsCoords.latitude.toFixed(4)}, ${gpsCoords.longitude.toFixed(4)})`);
                }
            }

            const autofillData = await runPlaceAutofill(placeName, photoBuffer ?? undefined, category ?? undefined, neighborhood ?? undefined).catch((e) => { console.error("autofill 실패:", e); return { name: placeName } as any; });

            // GPS가 있으면 카카오 좌표보다 우선 적용
            if (gpsCoords) {
                autofillData.latitude = gpsCoords.latitude;
                autofillData.longitude = gpsCoords.longitude;
            }

            // 영문명으로 S3 업로드
            let imageUrl = "";
            if (photoBuffer) {
                try {
                    imageUrl = await uploadPhotoToS3(photoBuffer, autofillData.name_en || placeName);
                } catch (e) {
                    console.error("S3 업로드 실패:", e);
                }
            }

            // draft 로 DB 저장 (이름은 캡션 원본 유지)
            const saved = await (prisma as any).place.create({
                data: {
                    name: placeName,
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

            if (autofillData.closed_days?.length > 0) {
                await (prisma as any).placeClosedDay.createMany({
                    data: autofillData.closed_days.map((d: { day_of_week: number; note: string | null }) => ({
                        place_id: saved.id,
                        day_of_week: d.day_of_week,
                        specific_date: null,
                        note: d.note || null,
                    })),
                });
            }

            const gpsNote = gpsCoords ? "\n📡 GPS 좌표 자동 적용" : "";
            const catNote = category ? `\n🏷 카테고리: ${category}` : "";
            const neighborNote = neighborhood ? `\n📍 지역: ${neighborhood}` : "";
            await sendMessage(chatId, `✅ "${saved.name}" 저장 완료!\n\nID: ${saved.id}${neighborNote}${catNote}${gpsNote}\n어드민에서 확인·수정 후 발행하세요.`);
            return NextResponse.json({ ok: true });
        }

        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error("텔레그램 webhook 오류:", e);
        return NextResponse.json({ ok: true }); // 텔레그램에 항상 200 반환
    }
}
