/**
 * 기존 places / course_places 행에 대해 address_en/ja/zh, tips_en/ja/zh 를 DeepL로 채웁니다.
 * 사용: DATABASE_URL, DEEPL_AUTH_KEY 필요. 마이그레이션 적용 후 실행.
 *
 *   node scripts/backfill-place-address-tips-i18n.cjs
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const DEEPL = process.env.DEEPL_AUTH_KEY;
const TARGET = { en: "EN", ja: "JA", zh: "ZH" };

async function deepl(text, lang) {
    if (!text || !String(text).trim()) return "";
    if (!DEEPL || !TARGET[lang]) return String(text);
    const form = new URLSearchParams({
        text: String(text).trim(),
        target_lang: TARGET[lang],
        source_lang: "KO",
    });
    const res = await fetch("https://api-free.deepl.com/v2/translate", {
        method: "POST",
        headers: {
            Authorization: `DeepL-Auth-Key ${DEEPL}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
    });
    if (!res.ok) return String(text);
    const data = await res.json();
    return data.translations?.[0]?.text || String(text);
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function translateTipsJson(jsonStr, lang) {
    if (!jsonStr || !String(jsonStr).trim()) return null;
    let arr;
    try {
        arr = JSON.parse(String(jsonStr).trim());
    } catch {
        const t = await deepl(String(jsonStr).trim(), lang);
        return t ? JSON.stringify([{ category: "ETC", content: t }]) : null;
    }
    if (!Array.isArray(arr)) return null;
    const out = [];
    for (const item of arr) {
        if (!item || typeof item.content !== "string") continue;
        const content = await deepl(item.content, lang);
        out.push({
            category: typeof item.category === "string" ? item.category : "ETC",
            content,
        });
        await sleep(80);
    }
    return out.length ? JSON.stringify(out) : null;
}

async function main() {
    if (!DEEPL) {
        console.warn("[backfill] DEEPL_AUTH_KEY 없음 — 번역 없이 종료합니다. 키 설정 후 다시 실행하세요.");
        process.exit(0);
    }

    const places = await prisma.place.findMany({
        select: {
            id: true,
            address: true,
            address_en: true,
            address_ja: true,
            address_zh: true,
        },
    });

    let placeUpdates = 0;
    for (const p of places) {
        if (!p.address || !String(p.address).trim()) continue;
        const patch = {};
        if (!p.address_en?.trim()) patch.address_en = await deepl(p.address, "en");
        await sleep(80);
        if (!p.address_ja?.trim()) patch.address_ja = await deepl(p.address, "ja");
        await sleep(80);
        if (!p.address_zh?.trim()) patch.address_zh = await deepl(p.address, "zh");
        await sleep(80);
        if (Object.keys(patch).length) {
            await prisma.place.update({ where: { id: p.id }, data: patch });
            placeUpdates++;
            console.log(`[place ${p.id}] address i18n updated`);
        }
    }

    const cps = await prisma.coursePlace.findMany({
        select: {
            id: true,
            tips: true,
            tips_en: true,
            tips_ja: true,
            tips_zh: true,
        },
    });

    let cpUpdates = 0;
    for (const cp of cps) {
        if (!cp.tips || !String(cp.tips).trim()) continue;
        const data = {};
        if (!cp.tips_en?.trim()) {
            const t = await translateTipsJson(cp.tips, "en");
            if (t) data.tips_en = t;
        }
        if (!cp.tips_ja?.trim()) {
            const t = await translateTipsJson(cp.tips, "ja");
            if (t) data.tips_ja = t;
        }
        if (!cp.tips_zh?.trim()) {
            const t = await translateTipsJson(cp.tips, "zh");
            if (t) data.tips_zh = t;
        }
        if (Object.keys(data).length) {
            await prisma.coursePlace.update({
                where: { id: cp.id },
                data,
            });
            cpUpdates++;
            console.log(`[course_place ${cp.id}] tips i18n updated`);
        }
    }

    console.log(`Done. places updated: ${placeUpdates}, course_places updated: ${cpUpdates}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
