// 인스타 DM → 팁: @dona.date로 온 가게 DM을 "가게 공지"(owner_text) 자료로 넣고 팁 후보 생성 → 텔레그램 알림
// Facebook 로그인이 포함된 Instagram API 방식 (DoNa-Content 앱, DoNa 페이지 토큰)
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import prisma from "@/lib/db";
import { defaultCache } from "@/lib/cache";
import { sendTelegram } from "@/lib/telegram";
import { generateTipCandidates, logTipRun, tipReviewUrl } from "@/lib/tipPipeline";

export const GRAPH = "https://graph.facebook.com/v23.0";
const PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 웹훅 서명: X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(앱 시크릿, 받은 본문 바이트 그대로).
 * JSON을 파싱했다가 다시 문자열로 만들면 한글 이스케이프 등이 달라져 안 맞음 → 원본 바이트로만 계산. 시크릿 앞뒤 공백은 제거.
 * META_APP_SECRET(다른 앱, 2398114527253289) 아님
 */
export function validMetaSignature(raw: Buffer | string, header: string | null, secret: string | undefined) {
    const key = secret?.trim();
    if (!key || !header?.startsWith("sha256=")) return false;
    const expected = Buffer.from(createHmac("sha256", key).update(raw).digest("hex"));
    const got = Buffer.from(header.slice("sha256=".length).trim().toLowerCase());
    return got.length === expected.length && timingSafeEqual(got, expected);
}

/** 어느 시크릿으로 서명됐는지: DoNa-Content 앱 / 인스타 로그인 앱 / 둘 다 아님 */
export function signedBy(raw: Buffer, header: string | null): "meta" | "instagram" | null {
    if (validMetaSignature(raw, header, process.env.META_CONTENT_APP_SECRET)) return "meta";
    if (validMetaSignature(raw, header, process.env.INSTAGRAM_LOGIN_APP_SECRET)) return "instagram";
    return null;
}

/** 서명 실패 진단용 (시크릿 값은 안 드러냄): 길이·앞뒤 공백 여부. 메타 앱 시크릿은 보통 32자 */
export function secretShape(name: string) {
    const v = process.env[name];
    if (!v) return `${name}: 없음`;
    return `${name}: ${v.trim().length}자${v !== v.trim() ? " (앞뒤 공백 있었음 → 제거하고 계산)" : ""}`;
}

type Messaging = { sender?: { id?: string }; message?: { mid?: string; text?: string; is_echo?: boolean; is_deleted?: boolean } };

/** 서명 통과한 웹훅 본문 → 처리할 DM 목록. 같은 메시지 ID는 3일 동안 한 번만 (메타가 다시 보내도) */
export async function dmsFromPayload(raw: Buffer): Promise<{ igsid: string; text: string }[]> {
    const body = JSON.parse(raw.toString("utf8"));
    if (body.object !== "instagram") return [];
    const out: { igsid: string; text: string }[] = [];
    for (const entry of body.entry ?? []) {
        for (const m of (entry.messaging ?? []) as Messaging[]) {
            const msg = m.message;
            const sender = m.sender?.id;
            // 우리 계정이 보낸 메시지(echo)·삭제·글자 없는 메시지(사진·스티커 등)는 건너뜀
            if (!msg?.mid || !msg.text?.trim() || msg.is_echo || msg.is_deleted || !sender || sender === entry.id) continue;
            if (await defaultCache.get(`ig:mid:${msg.mid}`)) continue;
            await defaultCache.set(`ig:mid:${msg.mid}`, 1, 3 * 24 * 60 * 60 * 1000);
            out.push({ igsid: sender, text: msg.text.trim() });
        }
    }
    return out;
}

/** 서명 실패한 요청은 30분 보관 → 원인 고친 뒤 텔레그램 "/igretry"로 다시 처리 */
const FAILED_KEY = "ig:failed";
const FAILED_TTL_MS = 30 * 60 * 1000;
type FailedHook = { body: string; header: string | null; at: number }; // body: base64 (바이트 그대로)

export async function keepFailedWebhook(raw: Buffer, header: string | null) {
    const now = Date.now();
    const list = ((await defaultCache.get<FailedHook[]>(FAILED_KEY)) ?? []).filter((f) => now - f.at < FAILED_TTL_MS);
    list.push({ body: raw.toString("base64"), header, at: now });
    await defaultCache.set(FAILED_KEY, list.slice(-20), FAILED_TTL_MS);
}

/** 보관한 실패 요청을 지금 시크릿으로 다시 검증해서 처리 */
export async function retryFailedWebhooks(chatId: number) {
    const now = Date.now();
    const list = ((await defaultCache.get<FailedHook[]>(FAILED_KEY)) ?? []).filter((f) => now - f.at < FAILED_TTL_MS);
    if (list.length === 0) return sendTelegram(chatId, "다시 처리할 실패 요청이 없어요 (30분 지나면 지워져요).");
    const still: FailedHook[] = [];
    let dms = 0;
    for (const f of list) {
        const raw = Buffer.from(f.body, "base64");
        if (!signedBy(raw, f.header)) {
            still.push(f);
            continue;
        }
        for (const dm of await dmsFromPayload(raw)) {
            dms++;
            await handleInstagramDm(dm.igsid, dm.text);
        }
    }
    await defaultCache.set(FAILED_KEY, still, FAILED_TTL_MS);
    await sendTelegram(
        chatId,
        `실패 요청 ${list.length}건 중 ${list.length - still.length}건 서명 통과 → DM ${dms}개 처리. 아직 안 맞는 것 ${still.length}건\n${secretShape("META_CONTENT_APP_SECRET")}\n${secretShape("INSTAGRAM_LOGIN_APP_SECRET")}`
    );
}

export type InstagramDm = { igsid: string; username: string | null; text: string };

export const telegramAdminIds = () => (process.env.TELEGRAM_ADMIN_IDS || "").split(",").map((s) => Number(s.trim())).filter(Boolean);
const notifyAdmins = (text: string, buttons?: { text: string; data: string }[][]) => Promise.all(telegramAdminIds().map((id) => sendTelegram(id, text, buttons)));

/** 같은 key는 하루(KST 날짜) 한 번만 텔레그램 알림 */
export async function notifyAdminsOncePerDay(key: string, text: string) {
    const dayKey = `${key}:${new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)}`;
    if (await defaultCache.get(dayKey)) return;
    await defaultCache.set(dayKey, 1, 24 * 60 * 60 * 1000);
    await notifyAdmins(text);
}

/** 보낸 사람 IGSID → 인스타 계정 이름 (상대가 먼저 DM을 보낸 경우에만 조회됨) */
export async function fetchInstagramUsername(igsid: string): Promise<string | null> {
    const url = `${GRAPH}/${encodeURIComponent(igsid)}?fields=username&access_token=${process.env.INSTAGRAM_PAGE_ACCESS_TOKEN}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
    if (!res?.ok) {
        console.error("인스타 계정 이름 조회 실패:", res?.status, await res?.text().catch(() => ""));
        return null;
    }
    const data = (await res.json()) as { username?: string };
    return data.username?.toLowerCase() ?? null;
}

const quote = (text: string) => (text.length > 300 ? text.slice(0, 300) + "…" : text);
const who = (dm: InstagramDm) => (dm.username ? `@${dm.username}` : `IGSID ${dm.igsid}`);

/** 웹훅에서 받은 DM 하나 처리: 계정 이름으로 장소 1곳 매칭되면 바로 팁 후보, 아니면 텔레그램으로 어느 장소인지 물음 */
export async function handleInstagramDm(igsid: string, text: string) {
    const username = await fetchInstagramUsername(igsid);
    const dm: InstagramDm = { igsid, username, text };
    const places = username
        ? await prisma.place.findMany({ where: { instagram_handle: username }, select: { id: true, name: true }, orderBy: { id: "asc" } })
        : [];
    if (places.length === 1) return addDmToPlace(places[0].id, dm);

    // 0곳·여러 곳: 7일 보관하고 물어봄. 버튼 데이터는 64바이트 제한이라 짧은 키
    const key = randomBytes(4).toString("hex");
    await defaultCache.set(`ig:dm:${key}`, dm, PENDING_TTL_MS);
    if (places.length > 1) {
        await notifyAdmins(
            `📩 인스타 DM (${who(dm)}) — 이 계정이 장소 ${places.length}곳에 있어요. 어느 장소인가요?\n\n"${quote(text)}"`,
            [...places.slice(0, 8).map((p) => [{ text: `${p.id} ${p.name}`, data: `igpick:${key}:${p.id}` }]), [{ text: "무시", data: `igpick:${key}:0` }]]
        );
    } else {
        await notifyAdmins(
            `📩 인스타 DM (${who(dm)}) — 맞는 장소가 없어요.\n\n"${quote(text)}"\n\n장소 ID를 이렇게 보내주세요 (이 계정을 그 장소에 저장하고 팁 후보를 만들어요):\nig ${key} 장소ID`,
            [[{ text: "무시", data: `igpick:${key}:0` }]]
        );
    }
}

/** 텔레그램에서 장소를 고른 뒤 (버튼 igpick:키:장소ID 또는 "ig 키 장소ID"). 장소ID 0 = 무시 */
export async function resolvePendingDm(chatId: number, key: string, placeId: number) {
    const dm = await defaultCache.get<InstagramDm>(`ig:dm:${key}`);
    if (!dm) return sendTelegram(chatId, "7일이 지났거나 이미 처리한 DM이에요.");
    await defaultCache.delete(`ig:dm:${key}`);
    if (!placeId) return sendTelegram(chatId, "이 DM은 무시했어요.");
    const place = await prisma.place.findUnique({ where: { id: placeId }, select: { id: true, instagram_handle: true } });
    if (!place) {
        await defaultCache.set(`ig:dm:${key}`, dm, PENDING_TTL_MS);
        return sendTelegram(chatId, `장소 ${placeId}를 찾을 수 없어요. 다시 보내주세요: ig ${key} 장소ID`);
    }
    // 다음 DM부터 자동 매칭되게 계정 저장 (이미 다른 계정이 있으면 덮어쓰지 않음)
    if (dm.username && !place.instagram_handle) await prisma.place.update({ where: { id: placeId }, data: { instagram_handle: dm.username } });
    await addDmToPlace(placeId, dm);
}

/** DM 내용을 가게 공지 자료로 저장 → 팁 후보 다시 생성 (관리자 화면 "붙여넣기"와 같은 흐름) → 알림 */
async function addDmToPlace(placeId: number, dm: InstagramDm) {
    const place = await prisma.place.findUniqueOrThrow({ where: { id: placeId }, select: { name: true } });
    await prisma.tipSource.create({
        data: { place_id: placeId, source_type: "owner_text", author: `인스타 DM ${who(dm)}`, title: "인스타 DM", content: dm.text.slice(0, 5000), written_at: new Date() },
    });
    const startedAt = new Date();
    try {
        const r = await generateTipCandidates(placeId);
        await logTipRun({
            place_id: placeId,
            kind: "instagram_dm",
            started_at: startedAt,
            finished_at: new Date(),
            candidate: r.candidate,
            official: r.official,
            needs_check: r.needsCheck,
            input_tokens: r.tokens.input,
            output_tokens: r.tokens.output,
        });
        await notifyAdmins(
            `📩 인스타 DM (${who(dm)}) → "${place.name}"\n"${quote(dm.text)}"\n\n가게 공식 ${r.official}개, 후보 ${r.candidate}개, 확인 필요 ${r.needsCheck}개${r.placeInfo ? `, 장소 정보 칸 후보 ${r.placeInfo}개` : ""}\n검수: ${tipReviewUrl(placeId)}`
        );
    } catch (e) {
        console.error("인스타 DM 팁 생성 실패:", e);
        await logTipRun({ place_id: placeId, kind: "instagram_dm", started_at: startedAt, error: String(e).slice(0, 500) });
        await notifyAdmins(`⚠️ 인스타 DM (${who(dm)}) → "${place.name}" 자료는 저장했지만 팁 생성 실패. 검수 화면에서 다시 해주세요.\n${tipReviewUrl(placeId)}`);
    }
}
