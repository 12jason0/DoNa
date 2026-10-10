import { NextRequest, NextResponse, after } from "next/server";
import { normalizeCostRange } from "@/lib/costRange";
import { kakaoKeywordSearch, runPlaceAutofill, type KakaoPlace } from "@/lib/placeAutofill";
import { defaultCache } from "@/lib/cache";
import { closeTelegramButtons, sendTelegram } from "@/lib/telegram";
import { runTipPipeline } from "@/lib/tipPipeline";
import { getS3Client, getS3Bucket, getS3PublicUrl } from "@/lib/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import prisma from "@/lib/db";
import exifr from "exifr";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // 저장 후 after()로 팁 파이프라인까지 (Hobby 플랜 최대 300초)

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const ALLOWED_IDS = (process.env.TELEGRAM_ADMIN_IDS || "").split(",").map((s) => Number(s.trim())).filter(Boolean);

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

type Pending = {
    placeName: string;
    neighborhood: string | null;
    category: string | null;
    fileId: string;
    isDocument: boolean;
    candidates: KakaoPlace[];
};
const pendingKey = (chatId: number) => `tg:place-pending:${chatId}`;

/** "맞아요"를 누른 뒤: 기존 저장 흐름 그대로 (주소·좌표는 고른 카카오 장소로 확정) → 저장된 장소 id */
async function savePlace(chatId: number, { placeName, neighborhood, category, fileId, isDocument }: Pending, picked: KakaoPlace): Promise<number> {
    const categoryMsg = category ? ` (${category})` : "";
    const neighborhoodMsg = neighborhood ? ` / ${neighborhood}` : "";
    await sendTelegram(chatId, `📍 "${placeName}"${neighborhoodMsg}${categoryMsg} 저장 중...`);

    // 파일 다운로드
    const photoBuffer = await downloadTelegramPhoto(fileId).catch((e) => { console.error("사진 다운로드 실패:", e); return null as Buffer | null; });

    // 파일로 보낸 경우 GPS 추출
    let gpsCoords: { latitude: number; longitude: number } | null = null;
    if (isDocument && photoBuffer) {
        gpsCoords = await extractGpsFromBuffer(photoBuffer);
        if (gpsCoords) {
            await sendTelegram(chatId, `📡 GPS 감지됨 (${gpsCoords.latitude.toFixed(4)}, ${gpsCoords.longitude.toFixed(4)})`);
        }
    }

    const autofillData = await runPlaceAutofill(placeName, photoBuffer ?? undefined, category ?? undefined, neighborhood ?? undefined, picked).catch((e) => { console.error("autofill 실패:", e); return { name: placeName } as any; });

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
            avg_cost_range: normalizeCostRange(autofillData.avg_cost_range) || null,
            opening_hours: autofillData.opening_hours || null,
            phone: autofillData.phone || null,
            website: autofillData.website || null,
            reservation_required: autofillData.reservation_required ?? false,
            google_place_id: autofillData.google_place_id || null,
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
    await sendTelegram(chatId, `✅ "${saved.name}" 저장 완료!\n\nID: ${saved.id}${neighborNote}${catNote}${gpsNote}\n어드민에서 확인·수정 후 발행하세요.`);
    return saved.id;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // 장소 확인 버튼
        const cb = body?.callback_query;
        if (cb) {
            const cbChatId: number = cb.message?.chat?.id;
            if (ALLOWED_IDS.length > 0 && !ALLOWED_IDS.includes(cbChatId)) return NextResponse.json({ ok: true });
            await closeTelegramButtons(cb.id, cbChatId, cb.message.message_id);
            const pending = await defaultCache.get<Pending>(pendingKey(cbChatId));
            defaultCache.delete(pendingKey(cbChatId));
            const pick = String(cb.data ?? "").replace("pick:", "");
            const picked = pending?.candidates[Number(pick)];
            if (!pending) {
                await sendTelegram(cbChatId, "시간이 지나서 취소됐어요. 사진을 다시 보내주세요.");
            } else if (!picked) {
                await sendTelegram(cbChatId, "저장 안 했어요. 이름이나 지역을 바꿔서 다시 보내주세요.");
            } else {
                const placeId = await savePlace(cbChatId, pending, picked);
                await sendTelegram(cbChatId, "📚 팁 자료 모으는 중... 끝나면 알려드릴게요.");
                after(() => runTipPipeline(placeId, cbChatId).catch(() => {}));
            }
            return NextResponse.json({ ok: true });
        }

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
            await sendTelegram(chatId, "안녕하세요!\n\n📎 사진을 파일로 보내면 GPS 자동 인식\n\n형식: 장소이름 | 지역 | 카테고리\n예시: 봉땅 | 홍대 | 카페\n\n카테고리: 카페 / 음식점 / 주점 / 소품샵 / 실내명소 / 야외명소 / 이색데이트 / 액티비티 / 사진관 / 인생네컷 / 향수 / 야경 / 식물원 / 시장 / 쇼핑");
            return NextResponse.json({ ok: true });
        }

        // 사진(압축) 또는 파일(원본) 둘 다 처리
        const isPhoto = !!message.photo;
        const isDocument = !!message.document && message.document.mime_type?.startsWith("image/");

        if (isPhoto || isDocument) {
            const rawCaption = caption.trim();
            if (!rawCaption) {
                await sendTelegram(chatId, "캡션에 장소 이름을 입력해주세요.\n형식: 장소이름 | 카테고리\n예시: 봉땅 | 카페");
                return NextResponse.json({ ok: true });
            }

            const { placeName, neighborhood, category } = parseCaption(rawCaption);
            if (!placeName) {
                await sendTelegram(chatId, "장소 이름을 확인해주세요.");
                return NextResponse.json({ ok: true });
            }

            const fileId = isDocument
                ? message.document.file_id
                : message.photo[message.photo.length - 1].file_id;

            // 카카오 로컬로 "여기 맞아요?" 되묻기. 고를 때까지 1시간 보관
            const found = await kakaoKeywordSearch(neighborhood ? `${placeName} ${neighborhood}` : placeName, 5);
            if (found.length === 0) {
                await sendTelegram(chatId, `🔍 카카오에서 "${placeName}"${neighborhood ? ` (${neighborhood})` : ""}을(를) 못 찾았어요.\n이름이나 지역을 바꿔서 다시 보내주세요.`);
                return NextResponse.json({ ok: true });
            }
            const pending: Pending = { placeName, neighborhood, category, fileId, isDocument, candidates: found };
            await defaultCache.set(pendingKey(chatId), pending, 60 * 60 * 1000);

            const line = (p: KakaoPlace) => `${p.place_name}\n   ${p.road_address_name || p.address_name}`;
            if (found.length === 1) {
                await sendTelegram(chatId, `여기 맞아요?\n\n${line(found[0])}`, [[{ text: "맞아요", data: "pick:0" }, { text: "아니에요", data: "pick:none" }]]);
            } else {
                await sendTelegram(
                    chatId,
                    `여기 중 어디예요?\n\n${found.map((p, i) => `${i + 1}. ${line(p)}`).join("\n")}`,
                    [found.map((_, i) => ({ text: String(i + 1), data: `pick:${i}` })), [{ text: "여기 없어요", data: "pick:none" }]]
                );
            }
            return NextResponse.json({ ok: true });
        }

        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error("텔레그램 webhook 오류:", e);
        return NextResponse.json({ ok: true }); // 텔레그램에 항상 200 반환
    }
}
