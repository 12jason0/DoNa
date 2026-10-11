import { NextRequest, NextResponse, after } from "next/server";
import { kakaoKeywordSearch, runPlaceAutofill, type KakaoPlace } from "@/lib/placeAutofill";
import { defaultCache } from "@/lib/cache";
import { closeTelegramButtons, sendTelegram } from "@/lib/telegram";
import { CLOSED_STATUS, parsePeriod, ymd } from "@/lib/placePeriod";
import { handleAddressButton, handleBuildingMessage, suggestPopupAddress } from "@/lib/popupAddress";
import { translatePopupFields } from "@/lib/popupTranslate";
import { runTipPipeline } from "@/lib/tipPipeline";
import { resolvePendingDm, retryFailedWebhooks } from "@/lib/instagramDm";
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

/** "이름 | 지역 | 카테고리", "이름, 지역", "이름 지역" 모두 받음. 구분자가 없으면 문장 전체가 검색어 */
function parseCaption(caption: string): { placeName: string; neighborhood: string | null; category: string | null; hasSeparator: boolean } {
    const parts = caption.split(/[|,]/).map((s) => s.trim());
    return {
        placeName: parts[0] || "",
        neighborhood: parts[1] || null,
        category: parts[2] || null,
        hasSeparator: parts.length > 1,
    };
}

/** 카카오 키워드 검색. 결과 없으면 마지막 단어를 빼고 한 번 더 */
async function searchKakaoWithFallback(query: string): Promise<KakaoPlace[]> {
    const found = await kakaoKeywordSearch(query, 5);
    const words = query.split(/\s+/);
    if (found.length > 0 || words.length < 2) return found;
    return kakaoKeywordSearch(words.slice(0, -1).join(" "), 5);
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
    hasSeparator: boolean;
    startDate: string | null; // "2026-10-17", null = 상설
    endDate: string | null;
};
const pendingKey = (chatId: number) => `tg:place-pending:${chatId}`;

/**
 * "맞아요"를 누른 뒤: 기존 저장 흐름 그대로 (주소·좌표는 고른 카카오 장소로 확정) → 저장된 장소 id
 * picked가 null이면 "이름 그대로 저장": 보낸 이름으로 저장, 주소·좌표는 비움 (관리자 화면에서 나중에 입력)
 * 같은 카카오 ID(자동 채우기 전)나 google_place_id(자동 채우기 후) 장소가 이미 있으면 저장하지 않고 "팁 다시 모을까요?" 버튼만 보냄 → null
 */
async function askRetip(chatId: number, existing: { id: number; name: string; status: string }) {
    const closedNote = existing.status === CLOSED_STATUS ? " (폐업 처리됨)" : "";
    await sendTelegram(chatId, `이미 있는 장소예요 (ID ${existing.id}, ${existing.name})${closedNote}. 팁 다시 모을까요?`, [
        [{ text: "팁 다시 모으기", data: `retip:${existing.id}` }, { text: "취소", data: "retip:none" }],
    ]);
}

async function savePlace(chatId: number, pending: Pending, picked: KakaoPlace | null): Promise<number | null> {
    const { neighborhood, category, fileId, isDocument } = pending;
    // 구분자 없이 "이름 지역"으로 보냈으면 문장 전체가 이름이 되므로 고른 카카오 장소 이름을 씀
    const placeName = pending.hasSeparator || !picked ? pending.placeName : picked.place_name;
    // 중복 방지 1: 고른 카카오 장소 ID가 이미 있으면 자동 채우기(Claude·구글 비용) 전에 멈춤
    if (picked?.id) {
        const existing = await prisma.place.findFirst({ where: { kakao_place_id: picked.id }, select: { id: true, name: true, status: true } });
        if (existing) {
            await askRetip(chatId, existing);
            return null;
        }
    }
    const categoryMsg = category ? ` (${category})` : "";
    const neighborhoodMsg = neighborhood ? ` / ${neighborhood}` : "";
    await sendTelegram(chatId, `📍 "${placeName}"${neighborhoodMsg}${categoryMsg} 저장 중...`);

    // 파일 다운로드
    const photoBuffer = await downloadTelegramPhoto(fileId).catch((e) => { console.error("사진 다운로드 실패:", e); return null as Buffer | null; });

    // 파일로 보낸 경우 GPS 추출
    let gpsCoords: { latitude: number; longitude: number } | null = null;
    if (isDocument && photoBuffer && picked) {
        gpsCoords = await extractGpsFromBuffer(photoBuffer);
        if (gpsCoords) {
            await sendTelegram(chatId, `📡 GPS 감지됨 (${gpsCoords.latitude.toFixed(4)}, ${gpsCoords.longitude.toFixed(4)})`);
        }
    }

    const autofillData = await runPlaceAutofill(placeName, photoBuffer ?? undefined, category ?? undefined, neighborhood ?? undefined, picked ?? undefined).catch((e) => { console.error("autofill 실패:", e); return { name: placeName } as any; });
    if (!picked) {
        // 카카오에 없는 장소: 이름이 비슷한 다른 가게의 위치·영업시간이 섞이지 않게 비움
        Object.assign(autofillData, {
            address: "", address_en: "", address_ja: "", address_zh: "",
            latitude: null, longitude: null, google_place_id: "",
            opening_hours: "", closed_days: [], phone: "", website: "",
        });
    }

    // GPS가 있으면 카카오 좌표보다 우선 적용
    if (gpsCoords) {
        autofillData.latitude = gpsCoords.latitude;
        autofillData.longitude = gpsCoords.longitude;
    }

    // 중복 방지 2: 카카오 ID가 아직 없는 기존 장소용. 구글 ID는 자동 채우기에서 나오므로 사진 업로드·저장 전에 확인
    if (autofillData.google_place_id) {
        const existing = await prisma.place.findFirst({
            where: { google_place_id: autofillData.google_place_id },
            select: { id: true, name: true, status: true },
        });
        if (existing) {
            await askRetip(chatId, existing);
            return null;
        }
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

    // 팝업·전시(기간 있음) 이름은 번역하지 않음: 비워 두면 팁 자료를 모은 뒤 translatePopupFields가 공식 영문명/원문으로 채움
    if (pending.startDate || pending.endDate) Object.assign(autofillData, { name_en: "", name_ja: "", name_zh: "" });

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
            opening_hours: autofillData.opening_hours || null,
            phone: autofillData.phone || null,
            website: autofillData.website || null,
            reservation_required: autofillData.reservation_required ?? false,
            google_place_id: autofillData.google_place_id || null,
            kakao_place_id: picked?.id || null,
            latitude: autofillData.latitude ?? null,
            longitude: autofillData.longitude ?? null,
            imageUrl: imageUrl || null,
            status: "draft",
            // 위치 없는 장소는 팁 자료를 "이름 + 지역" 블로그 검색으로만 모음
            tip_query: picked ? null : [placeName, neighborhood].filter(Boolean).join(" "),
            start_date: pending.startDate ? new Date(pending.startDate) : null,
            end_date: pending.endDate ? new Date(pending.endDate) : null,
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
    const noLocationNote = picked ? "" : "\n⚠️ 위치 없음: 어드민 장소 화면에서 주소·좌표를 입력해주세요.";
    const periodNote = pending.startDate ? `\n🗓 기간: ${pending.startDate} ~ ${pending.endDate}` : "\n🗓 기간: 상설";
    await sendTelegram(chatId, `✅ "${saved.name}" 저장 완료!\n\nID: ${saved.id}${neighborNote}${catNote}${periodNote}${gpsNote}${noLocationNote}\n어드민에서 확인·수정 후 발행하세요.`);
    return saved.id;
}

export async function POST(request: NextRequest) {
    // 텔레그램 setWebhook의 secret_token과 같은 값이 헤더로 와야 함 (값을 넣기 전에는 검사 안 함)
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secret && request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    try {
        const body = await request.json();

        // 장소 확인 버튼
        const cb = body?.callback_query;
        if (cb) {
            const startedAt = new Date(); // "맞아요" 누른 시각 → 자동 처리 시간 통계
            const cbChatId: number = cb.message?.chat?.id;
            if (ALLOWED_IDS.length > 0 && !ALLOWED_IDS.includes(cbChatId)) return NextResponse.json({ ok: true });
            await closeTelegramButtons(cb.id, cbChatId, cb.message.message_id);
            // 위치 없는 팝업의 주소 확인 버튼
            if (String(cb.data ?? "").startsWith("addr:")) {
                const placeId = await handleAddressButton(cbChatId, String(cb.data));
                if (placeId) after(() => runTipPipeline(placeId, cbChatId).catch(() => {}));
                return NextResponse.json({ ok: true });
            }
            // 인스타 DM 장소 고르기: igpick:키:장소ID (0 = 무시)
            if (String(cb.data ?? "").startsWith("igpick:")) {
                const [, key, placeId] = String(cb.data).split(":");
                after(() => resolvePendingDm(cbChatId, key, Number(placeId)).catch((e) => console.error("인스타 DM 처리 실패:", e)));
                return NextResponse.json({ ok: true });
            }
            // 이미 있는 장소: "팁 다시 모으기" / "취소"
            if (String(cb.data ?? "").startsWith("retip:")) {
                const placeId = Number(String(cb.data).slice("retip:".length));
                if (!placeId) {
                    await sendTelegram(cbChatId, "저장 안 했어요.");
                } else {
                    await sendTelegram(cbChatId, "📚 팁 자료 다시 모으는 중... 끝나면 알려드릴게요.");
                    after(() => runTipPipeline(placeId, cbChatId, startedAt).catch(() => {}));
                }
                return NextResponse.json({ ok: true });
            }
            const pending = await defaultCache.get<Pending>(pendingKey(cbChatId));
            defaultCache.delete(pendingKey(cbChatId));
            const pick = String(cb.data ?? "").replace("pick:", "");
            const picked = pending?.candidates[Number(pick)];
            if (!pending) {
                await sendTelegram(cbChatId, "시간이 지나서 취소됐어요. 사진을 다시 보내주세요.");
            } else if (!picked && pick !== "raw") {
                await sendTelegram(cbChatId, "저장 안 했어요. 이름이나 지역을 바꿔서 다시 보내주세요.");
            } else {
                const placeId = await savePlace(cbChatId, pending, picked ?? null);
                if (!placeId) return NextResponse.json({ ok: true });
                await sendTelegram(cbChatId, "📚 팁 자료 모으는 중... 끝나면 알려드릴게요.");
                after(async () => {
                    await runTipPipeline(placeId, cbChatId, startedAt).catch(() => {});
                    // 팝업(기간 있음): 이름은 공식 영문명 아니면 원문, 주소는 번역 (모은 블로그 자료 사용)
                    if (pending.startDate || pending.endDate) await translatePopupFields(placeId).catch((e) => console.error("팝업 번역 실패:", e));
                    // 카카오에 없어 위치 없이 저장한 장소: 모은 블로그 자료에서 주소 찾아 "여기 맞아요?"
                    if (!picked) await suggestPopupAddress(placeId, cbChatId).catch((e) => console.error("주소 찾기 실패:", e));
                });
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

        // "/igretry": 서명 실패로 보관한 인스타 웹훅(30분)을 지금 시크릿으로 다시 처리
        if (text.trim() === "/igretry") {
            after(() => retryFailedWebhooks(chatId).catch((e) => console.error("인스타 웹훅 재처리 실패:", e)));
            return NextResponse.json({ ok: true });
        }

        // "ig 키 장소ID": 맞는 장소가 없던 인스타 DM을 그 장소에 넣기
        const igPick = text.trim().match(/^ig\s+([0-9a-f]{8})\s+(\d+)$/i);
        if (igPick) {
            after(() => resolvePendingDm(chatId, igPick[1].toLowerCase(), Number(igPick[2])).catch((e) => console.error("인스타 DM 처리 실패:", e)));
            return NextResponse.json({ ok: true });
        }

        // "@건물이름": 위치를 기다리는 팝업 장소의 건물 검색
        if (text.trim().startsWith("@") && text.trim().length > 1) {
            await handleBuildingMessage(chatId, text.trim().slice(1).trim());
            return NextResponse.json({ ok: true });
        }

        // /start 커맨드
        if (text === "/start") {
            await sendTelegram(chatId, "안녕하세요!\n\n📎 사진을 파일로 보내면 GPS 자동 인식\n\n형식: 장소이름 | 지역 | 카테고리 (| 대신 , 도 되고, 그냥 \"봉땅 홍대\"처럼 써도 돼요)\n예시: 봉땅 | 홍대 | 카페\n팝업·전시처럼 기간이 있으면 끝에: 짱구 전시, 성수, 10/17~1/24\n\n카테고리: 카페 / 음식점 / 주점 / 소품샵 / 실내명소 / 야외명소 / 이색데이트 / 액티비티 / 사진관 / 인생네컷 / 향수 / 야경 / 식물원 / 시장 / 쇼핑 / 팝업스토어");
            return NextResponse.json({ ok: true });
        }

        // 사진(압축) 또는 파일(원본) 둘 다 처리
        const isPhoto = !!message.photo;
        const isDocument = !!message.document && message.document.mime_type?.startsWith("image/");

        if (isPhoto || isDocument) {
            const rawCaption = caption.trim();
            if (!rawCaption) {
                await sendTelegram(chatId, "캡션에 장소 이름을 입력해주세요.\n예시: 봉땅 | 홍대  /  봉땅, 홍대  /  봉땅 홍대");
                return NextResponse.json({ ok: true });
            }

            // "이름, 지역, 10/17~1/24"처럼 기간이 있으면 떼어내고 나머지로 이름·지역 해석 (없으면 상설)
            const period = parsePeriod(rawCaption);
            const { placeName, neighborhood, category, hasSeparator } = parseCaption(period?.rest ?? rawCaption);
            if (!placeName) {
                await sendTelegram(chatId, "장소 이름을 확인해주세요.");
                return NextResponse.json({ ok: true });
            }

            const fileId = isDocument
                ? message.document.file_id
                : message.photo[message.photo.length - 1].file_id;

            // 카카오 로컬로 "여기 맞아요?" 되묻기 (어떤 형식이든 저장 전 항상). 고를 때까지 1시간 보관
            const found = await searchKakaoWithFallback(neighborhood ? `${placeName} ${neighborhood}` : placeName);
            const pending: Pending = {
                placeName, neighborhood, category, fileId, isDocument, candidates: found, hasSeparator,
                startDate: ymd(period?.start), endDate: ymd(period?.end),
            };
            await defaultCache.set(pendingKey(chatId), pending, 60 * 60 * 1000);
            if (found.length === 0) {
                await sendTelegram(chatId, "🔍 못 찾았어요. 이름을 다시 보내주세요.\n카카오에 없는 곳(팝업·전시 등)이면 위치 없이 저장할 수 있어요.", [
                    [{ text: "이름 그대로 저장", data: "pick:raw" }],
                ]);
                return NextResponse.json({ ok: true });
            }

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
